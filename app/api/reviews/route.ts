import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { addTasteSignal, updateUserReviewsEmbedding } from '@/lib/taste-signals';
import { enrichAndCacheRestaurant } from '@/lib/restaurant-enrichment';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { restaurant, rating, content, photoUrls, videoUrls, reviewId, isPublished = true } = await request.json();

    if (!restaurant || !rating) {
      return NextResponse.json(
        { error: 'Restaurant and rating are required' },
        { status: 400 }
      );
    }

    let restaurantId: string | null = null;

    if (restaurant.googlePlaceId) {
      const { data: existingRestaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('google_place_id', restaurant.googlePlaceId)
        .single();

      if (existingRestaurant) {
        restaurantId = existingRestaurant.id;
      } else {
        const restaurantData: any = {
          google_place_id: restaurant.googlePlaceId,
          name: restaurant.name,
          address: restaurant.address,
          image_url: restaurant.photoUrl,
          created_by: user.id,
        };

        if (restaurant.latitude && restaurant.longitude) {
          restaurantData.latitude = restaurant.latitude;
          restaurantData.longitude = restaurant.longitude;
        }

        const { data: newRestaurant, error: createError } = await supabase
          .from('restaurants')
          .insert(restaurantData)
          .select('id')
          .single();

        if (createError) {
          console.error('Error creating restaurant:', createError);
          return NextResponse.json(
            { error: `Failed to create restaurant: ${createError.message}` },
            { status: 500 }
          );
        }

        restaurantId = newRestaurant.id;
        
        if (restaurant.latitude && restaurant.longitude) {
          try {
            await supabase.rpc('update_restaurant_location', {
              p_restaurant_id: restaurantId,
              p_longitude: restaurant.longitude,
              p_latitude: restaurant.latitude,
            });
          } catch {
            // PostGIS location update is optional
          }
        }

        enrichAndCacheRestaurant(restaurant.googlePlaceId, supabase)
          .catch(err => console.error('Background enrichment failed:', err));
      }
    } else if (restaurant.id) {
      restaurantId = restaurant.id;
    }

    if (!restaurantId) {
      return NextResponse.json(
        { error: 'Could not determine restaurant ID' },
        { status: 400 }
      );
    }

    // If reviewId is provided, update existing review (edit mode)
    if (reviewId) {
      const { data: existingReview } = await supabase
        .from('reviews')
        .select('id, user_id')
        .eq('id', reviewId)
        .eq('user_id', user.id)
        .single();

      if (!existingReview) {
        return NextResponse.json(
          { error: 'Review not found or unauthorized' },
          { status: 404 }
        );
      }

      const { error: updateError } = await supabase
        .from('reviews')
        .update({
          rating,
          content,
          is_published: isPublished,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reviewId);

      if (updateError) {
        console.error('Error updating review:', updateError);
        return NextResponse.json(
          { error: 'Failed to update review' },
          { status: 500 }
        );
      }

      // Update photos
      if (photoUrls?.length > 0) {
        await supabase
          .from('review_photos')
          .delete()
          .eq('review_id', reviewId);

        const photoInserts = photoUrls.map((photo: string | { url: string; sortOrder: number }, index: number) => {
          const url = typeof photo === 'string' ? photo : photo.url;
          const sortOrder = typeof photo === 'string' ? index : photo.sortOrder;
          return {
            review_id: reviewId,
            photo_url: url,
            sort_order: sortOrder,
          };
        });

        await supabase.from('review_photos').insert(photoInserts);
      } else {
        await supabase
          .from('review_photos')
          .delete()
          .eq('review_id', reviewId);
      }

      // Handle videos
      if (videoUrls?.length > 0) {
        try {
          await supabase
            .from('review_videos')
            .delete()
            .eq('review_id', reviewId);

          const videoInserts = videoUrls.map((video: { url: string; thumbnailUrl?: string; sortOrder?: number }, index: number) => ({
            review_id: reviewId,
            video_url: video.url,
            thumbnail_url: video.thumbnailUrl,
            sort_order: video.sortOrder !== undefined ? video.sortOrder : index,
          }));

          await supabase.from('review_videos').insert(videoInserts);
        } catch {
          // Video table may not exist yet
        }
      } else {
        try {
          await supabase
            .from('review_videos')
            .delete()
            .eq('review_id', reviewId);
        } catch {
          // Table may not exist
        }
      }

      return NextResponse.json({ 
        success: true, 
        reviewId: reviewId,
        message: 'Review updated'
      });
    }

    // Create a new review
    const { data: newReview, error: createError } = await supabase
      .from('reviews')
      .insert({
        user_id: user.id,
        restaurant_id: restaurantId,
        rating,
        content,
        is_published: isPublished,
      })
      .select('id')
      .single();

    if (createError) {
      console.error('Error creating review:', createError);
      return NextResponse.json(
        { 
          error: 'Failed to create review',
          details: createError.message,
          hint: createError.hint
        },
        { status: 500 }
      );
    }

    // Add photos
    if (photoUrls?.length > 0) {
      const photoInserts = photoUrls.map((photo: string | { url: string; sortOrder: number }, index: number) => {
        const url = typeof photo === 'string' ? photo : photo.url;
        const sortOrder = typeof photo === 'string' ? index : photo.sortOrder;
        return {
          review_id: newReview.id,
          photo_url: url,
          sort_order: sortOrder,
        };
      });

      await supabase.from('review_photos').insert(photoInserts);
    }

    // Add videos
    let videosInserted = 0;
    let videoInsertError: string | null = null;
    
    if (videoUrls?.length > 0) {
      try {
        const videoInserts = videoUrls.map((video: { url: string; thumbnailUrl?: string; sortOrder?: number }, index: number) => ({
          review_id: newReview.id,
          video_url: video.url,
          thumbnail_url: video.thumbnailUrl,
          sort_order: video.sortOrder !== undefined ? video.sortOrder : index,
        }));
        
        const { data: insertedVideos, error: videoError } = await supabase
          .from('review_videos')
          .insert(videoInserts)
          .select();
        
        if (videoError) {
          console.error('Video insert error:', videoError);
          videoInsertError = videoError.message;
        } else {
          videosInserted = insertedVideos?.length || 0;
        }
      } catch (videoError: any) {
        console.error('Video insert exception:', videoError);
        videoInsertError = videoError?.message || 'Unknown error';
      }
    }

    // Add taste signal for the review
    try {
      const isPositive = rating >= 4;
      const signalContent = isPositive
        ? `Visited and liked ${restaurant.name}${restaurant.cuisineTypes?.length ? `, ${restaurant.cuisineTypes.join(', ')}` : ''}`
        : `Visited but didn't like ${restaurant.name}${restaurant.cuisineTypes?.length ? `, ${restaurant.cuisineTypes.join(', ')}` : ''}`;

      await addTasteSignal(supabase, user.id, {
        signalType: 'review',
        signalStrength: 5,
        isPositive,
        restaurantId: restaurantId,
        googlePlaceId: restaurant.googlePlaceId,
        restaurantName: restaurant.name,
        cuisineTypes: restaurant.cuisineTypes || [],
        content: signalContent,
        sourceId: newReview.id,
      });
    } catch (signalError) {
      console.error('Error adding taste signal:', signalError);
    }

    // Trigger reviews embedding update (async)
    updateUserReviewsEmbedding(user.id).catch(err => 
      console.error('Error updating reviews embedding:', err)
    );

    return NextResponse.json({ 
      success: true, 
      reviewId: newReview.id,
      message: 'Review created',
      videosInserted,
      videoInsertError,
    });
  } catch (error) {
    console.error('Error in reviews API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get reviews for a restaurant or user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const restaurantId = searchParams.get('restaurantId');
    const userId = searchParams.get('userId');
    const publishedFilter = searchParams.get('published');

    const { data: { user } } = await supabase.auth.getUser();

    let query = supabase
      .from('reviews')
      .select(`
        id,
        rating,
        content,
        created_at,
        user_id,
        restaurant_id,
        is_published,
        restaurants (
          id,
          name,
          address,
          image_url,
          google_place_id
        ),
        review_photos (
          photo_url,
          sort_order
        ),
        review_videos (
          video_url,
          thumbnail_url,
          duration_seconds,
          sort_order
        )
      `)
      .order('created_at', { ascending: false });

    if (restaurantId) {
      query = query.eq('restaurant_id', restaurantId);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (publishedFilter === 'true') {
      query = query.eq('is_published', true);
    } else if (publishedFilter === 'false') {
      query = query.eq('is_published', false);
    }

    const { data: reviews, error } = await query.limit(50);

    if (error) {
      console.error('Error fetching reviews:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reviews', details: error.message },
        { status: 500 }
      );
    }

    const userIds = [...new Set(reviews?.map(r => r.user_id) || [])];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', userIds);

    const profilesMap = new Map();
    profilesData?.forEach((profile: any) => {
      profilesMap.set(profile.id, profile);
    });

    const reviewIds = reviews?.map(r => r.id) || [];
    
    const { data: likesData } = await supabase
      .from('review_likes')
      .select('review_id')
      .in('review_id', reviewIds);

    let userLikes: string[] = [];
    if (user) {
      const { data: userLikesData } = await supabase
        .from('review_likes')
        .select('review_id')
        .eq('user_id', user.id)
        .in('review_id', reviewIds);
      userLikes = userLikesData?.map(l => l.review_id) || [];
    }

    const { data: commentsData } = await supabase
      .from('review_comments')
      .select('review_id')
      .in('review_id', reviewIds);

    const likesCounts: { [key: string]: number } = {};
    likesData?.forEach(like => {
      likesCounts[like.review_id] = (likesCounts[like.review_id] || 0) + 1;
    });

    const commentsCounts: { [key: string]: number } = {};
    commentsData?.forEach(comment => {
      commentsCounts[comment.review_id] = (commentsCounts[comment.review_id] || 0) + 1;
    });

    const formattedReviews = reviews?.map(review => {
      const profile = profilesMap.get(review.user_id);
      
      const photos = (review.review_photos as any[]) || [];
      const videos = (review.review_videos as any[]) || [];
      
      const mediaItems: Array<{ type: 'photo' | 'video'; url: string; thumbnailUrl?: string; sortOrder: number }> = [
        ...photos.map((p: any) => ({
          type: 'photo' as const,
          url: p.photo_url,
          sortOrder: p.sort_order ?? 0,
        })),
        ...videos.map((v: any) => ({
          type: 'video' as const,
          url: v.video_url,
          thumbnailUrl: v.thumbnail_url,
          sortOrder: v.sort_order ?? 0,
        })),
      ];
      
      mediaItems.sort((a, b) => a.sortOrder - b.sortOrder);
      
      return {
        ...review,
        likesCount: likesCounts[review.id] || 0,
        commentsCount: commentsCounts[review.id] || 0,
        isLiked: userLikes.includes(review.id),
        isPublished: review.is_published,
        media: mediaItems,
        user: profile ? {
          id: profile.id,
          username: profile.username,
          fullName: profile.full_name || profile.username,
          avatarUrl: profile.avatar_url,
        } : undefined,
      };
    });

    return NextResponse.json({ reviews: formattedReviews || [] });
  } catch (error) {
    console.error('Error in reviews API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Delete a review
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const reviewId = searchParams.get('reviewId');

    if (!reviewId) {
      return NextResponse.json(
        { error: 'Review ID is required' },
        { status: 400 }
      );
    }

    const { data: review } = await supabase
      .from('reviews')
      .select('user_id')
      .eq('id', reviewId)
      .single();

    if (!review || review.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Review not found or unauthorized' },
        { status: 404 }
      );
    }

    await supabase
      .from('review_photos')
      .delete()
      .eq('review_id', reviewId);

    const { error: deleteError } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId);

    if (deleteError) {
      console.error('Error deleting review:', deleteError);
      throw deleteError;
    }

    return NextResponse.json({ 
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Error in delete review API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
