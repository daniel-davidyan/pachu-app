import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { addTasteSignal, updateUserReviewsEmbedding } from '@/lib/taste-signals';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
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

    // Always use Google Place ID to find or create restaurant
    let restaurantId: string | null = null;

    if (restaurant.googlePlaceId) {
      // Check if restaurant exists by Google Place ID
      const { data: existingRestaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('google_place_id', restaurant.googlePlaceId)
        .single();

      if (existingRestaurant) {
        restaurantId = existingRestaurant.id;
      } else {
        // Create new restaurant with Google Place ID
        const { data: newRestaurant, error: createError } = await supabase
          .from('restaurants')
          .insert({
            google_place_id: restaurant.googlePlaceId,
            name: restaurant.name,
            address: restaurant.address,
            image_url: restaurant.photoUrl,
            created_by: user.id,
          })
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
        
        // Update location separately using SQL if PostGIS is set up
        if (restaurant.latitude && restaurant.longitude) {
          try {
            await supabase.rpc('update_restaurant_location', {
              p_restaurant_id: restaurantId,
              p_longitude: restaurant.longitude,
              p_latitude: restaurant.latitude,
            });
          } catch (e) {
            // Location update is optional, continue without it
            console.log('Location update skipped (PostGIS function may not exist)');
          }
        }
      }
    } else if (restaurant.id) {
      // Fallback: use provided restaurant ID (for legacy support)
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
      // Verify the review belongs to the user
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

      // Update existing review
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
      console.log('[API reviews] Updating photos for review:', reviewId);
      console.log('[API reviews] Received photoUrls:', photoUrls?.length, 'photos');
      
      if (photoUrls?.length > 0) {
        // First, check how many photos exist before delete
        const { data: existingPhotos, error: countError } = await supabase
          .from('review_photos')
          .select('id, photo_url')
          .eq('review_id', reviewId);
        
        console.log('[API reviews] Existing photos before delete:', existingPhotos?.length || 0);
        
        // Delete old photos
        const { error: deleteError, count: deleteCount } = await supabase
          .from('review_photos')
          .delete()
          .eq('review_id', reviewId)
          .select();

        if (deleteError) {
          console.error('[API reviews] Delete error:', deleteError);
        } else {
          console.log('[API reviews] Deleted photos count:', deleteCount);
        }

        // Add new photos
        const photoInserts = photoUrls.map((url: string, index: number) => ({
          review_id: reviewId,
          photo_url: url,
          sort_order: index,
        }));

        console.log('[API reviews] Inserting photos:', photoInserts.length);
        const { error: insertError } = await supabase.from('review_photos').insert(photoInserts);
        
        if (insertError) {
          console.error('[API reviews] Insert error:', insertError);
        }
        
        // Verify final count
        const { data: finalPhotos } = await supabase
          .from('review_photos')
          .select('id')
          .eq('review_id', reviewId);
        console.log('[API reviews] Final photos count after update:', finalPhotos?.length || 0);
      } else {
        // If no photos provided, delete all existing photos
        const { error: deleteError } = await supabase
          .from('review_photos')
          .delete()
          .eq('review_id', reviewId);
        
        if (deleteError) {
          console.error('[API reviews] Delete all error:', deleteError);
        }
      }

      // Handle videos (if review_videos table exists)
      if (videoUrls?.length > 0) {
        try {
          // Delete old videos
          await supabase
            .from('review_videos')
            .delete()
            .eq('review_id', reviewId);

          // Add new videos
          const videoInserts = videoUrls.map((video: { url: string; thumbnailUrl?: string }, index: number) => ({
            review_id: reviewId,
            video_url: video.url,
            thumbnail_url: video.thumbnailUrl,
            sort_order: index,
          }));

          await supabase.from('review_videos').insert(videoInserts);
        } catch (videoError) {
          // Video table may not exist yet, continue without error
          console.log('[API reviews] Video update skipped:', videoError);
        }
      } else {
        // Delete all existing videos if none provided
        try {
          await supabase
            .from('review_videos')
            .delete()
            .eq('review_id', reviewId);
        } catch (e) {
          // Table may not exist
        }
      }

      return NextResponse.json({ 
        success: true, 
        reviewId: reviewId,
        message: 'Review updated'
      });
    }

    // Otherwise, create a new review (allows multiple reviews per restaurant)
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
      console.error('Error details:', {
        message: createError.message,
        details: createError.details,
        hint: createError.hint,
        code: createError.code
      });
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
      const photoInserts = photoUrls.map((url: string, index: number) => ({
        review_id: newReview.id,
        photo_url: url,
        sort_order: index,
      }));

      await supabase.from('review_photos').insert(photoInserts);
    }

    // Add videos (if review_videos table exists)
    if (videoUrls?.length > 0) {
      try {
        const videoInserts = videoUrls.map((video: { url: string; thumbnailUrl?: string }, index: number) => ({
          review_id: newReview.id,
          video_url: video.url,
          thumbnail_url: video.thumbnailUrl,
          sort_order: index,
        }));

        await supabase.from('review_videos').insert(videoInserts);
      } catch (videoError) {
        // Video table may not exist yet, continue without error
        console.log('[API reviews] Video insert skipped:', videoError);
      }
    }

    // Add taste signal for the review (strongest signal - user actually visited)
    try {
      const isPositive = rating >= 4; // 4-5 stars = positive, 1-3 = negative
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
      // Don't fail the review if signal fails
      console.error('Error adding taste signal for review:', signalError);
    }

    // Trigger reviews embedding update (async, don't wait)
    updateUserReviewsEmbedding(user.id).catch(err => 
      console.error('Error updating reviews embedding:', err)
    );

    return NextResponse.json({ 
      success: true, 
      reviewId: newReview.id,
      message: 'Review created'
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
    const publishedFilter = searchParams.get('published'); // 'true', 'false', or null for all

    // Get current user to check for likes
    const { data: { user } } = await supabase.auth.getUser();

    // Query reviews with restaurant and photo data
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

    // Filter by published status if specified
    if (publishedFilter === 'true') {
      query = query.eq('is_published', true);
    } else if (publishedFilter === 'false') {
      query = query.eq('is_published', false);
    }
    // If publishedFilter is null, return all reviews (for user's own profile)

    const { data: reviews, error } = await query.limit(50);

    if (error) {
      console.error('Error fetching reviews - Details:', error);
      console.error('Query params:', { restaurantId, userId });
      return NextResponse.json(
        { 
          error: 'Failed to fetch reviews',
          details: error.message,
          hint: error.hint 
        },
        { status: 500 }
      );
    }

    // Get user profiles for all reviews
    const userIds = [...new Set(reviews?.map(r => r.user_id) || [])];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', userIds);

    const profilesMap = new Map();
    profilesData?.forEach((profile: any) => {
      profilesMap.set(profile.id, profile);
    });

    // Get likes and comments counts for all reviews
    const reviewIds = reviews?.map(r => r.id) || [];
    
    // Get likes counts
    const { data: likesData } = await supabase
      .from('review_likes')
      .select('review_id')
      .in('review_id', reviewIds);

    // Get user's likes if logged in
    let userLikes: string[] = [];
    if (user) {
      const { data: userLikesData } = await supabase
        .from('review_likes')
        .select('review_id')
        .eq('user_id', user.id)
        .in('review_id', reviewIds);
      userLikes = userLikesData?.map(l => l.review_id) || [];
    }

    // Get comments counts
    const { data: commentsData } = await supabase
      .from('review_comments')
      .select('review_id')
      .in('review_id', reviewIds);

    // Count likes and comments per review
    const likesCounts: { [key: string]: number } = {};
    likesData?.forEach(like => {
      likesCounts[like.review_id] = (likesCounts[like.review_id] || 0) + 1;
    });

    const commentsCounts: { [key: string]: number } = {};
    commentsData?.forEach(comment => {
      commentsCounts[comment.review_id] = (commentsCounts[comment.review_id] || 0) + 1;
    });

    // Format reviews with counts and user profiles
    const formattedReviews = reviews?.map(review => {
      const profile = profilesMap.get(review.user_id);
      return {
        ...review,
        likesCount: likesCounts[review.id] || 0,
        commentsCount: commentsCounts[review.id] || 0,
        isLiked: userLikes.includes(review.id),
        isPublished: review.is_published,
        user: profile ? {
          id: profile.id,
          username: profile.username,
          fullName: profile.full_name || profile.username,
          avatarUrl: profile.avatar_url,
        } : undefined,
      };
    });

    // Return empty array if no reviews
    return NextResponse.json({ reviews: formattedReviews || [] });
  } catch (error) {
    console.error('Error in reviews API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Delete a review
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
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

    // Check if review belongs to user
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

    // Delete review photos first
    await supabase
      .from('review_photos')
      .delete()
      .eq('review_id', reviewId);

    // Delete review
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

