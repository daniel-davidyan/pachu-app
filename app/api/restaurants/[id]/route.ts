import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get current user (optional for this endpoint)
    const { data: { user } } = await supabase.auth.getUser();

    // Check if ID is a UUID or Google Place ID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    let restaurant;
    let restaurantError;

    if (isUUID) {
      // Try to find by UUID first
      const result = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', id)
        .single();
      restaurant = result.data;
      restaurantError = result.error;
    } else {
      // Try to find by Google Place ID
      const result = await supabase
        .from('restaurants')
        .select('*')
        .eq('google_place_id', id)
        .single();
      restaurant = result.data;
      restaurantError = result.error;
      
      // If not found in database, fetch from Google Places API
      if (restaurantError || !restaurant) {
        try {
          const googleResponse = await fetch(
            `${request.nextUrl.origin}/api/restaurants/details?placeId=${id}`
          );
          const googleData = await googleResponse.json();
          
          if (googleData && googleData.name) {
            // Check if this restaurant exists in our DB under the Google Place ID
            // (it might have been created when someone reviewed it)
            const { data: dbRestaurantCheck } = await supabase
              .from('restaurants')
              .select('id')
              .eq('google_place_id', id)
              .single();

            let friendsWhoReviewed: any[] = [];
            let userHasReviewed = false;
            let isWishlisted = false;
            let ourReviews: any[] = [];
            let followingIds: string[] = [];

            // If restaurant exists in our DB, get friends who reviewed it
            if (dbRestaurantCheck && user) {
              const dbRestaurantId = dbRestaurantCheck.id;

              // Get following users
              const { data: followingData } = await supabase
                .from('follows')
                .select('following_id')
                .eq('follower_id', user.id);

              followingIds = followingData?.map(f => f.following_id) || [];
              
              if (followingIds.length > 0) {
                const { data: friendReviewsData } = await supabase
                  .from('reviews')
                  .select(`
                    user_id,
                    profiles!reviews_user_id_fkey (
                      id,
                      username,
                      full_name,
                      avatar_url
                    )
                  `)
                  .eq('restaurant_id', dbRestaurantId)
                  .in('user_id', followingIds);

                const uniqueFriends = new Map();
                friendReviewsData?.forEach((review: any) => {
                  if (review.profiles && !uniqueFriends.has(review.user_id)) {
                    uniqueFriends.set(review.user_id, {
                      id: review.profiles.id,
                      username: review.profiles.username,
                      fullName: review.profiles.full_name || review.profiles.username,
                      avatarUrl: review.profiles.avatar_url,
                    });
                  }
                });

                friendsWhoReviewed = Array.from(uniqueFriends.values());
              }

              // Check if user has reviewed
              const { data: userReviewData } = await supabase
                .from('reviews')
                .select('id')
                .eq('user_id', user.id)
                .eq('restaurant_id', dbRestaurantId)
                .single();
              
              userHasReviewed = !!userReviewData;

              // Check wishlist status
              const { data: wishlistData } = await supabase
                .from('wishlist')
                .select('id')
                .eq('user_id', user.id)
                .eq('restaurant_id', dbRestaurantId)
                .single();
              
              isWishlisted = !!wishlistData;

              // Get our reviews
              const { data: reviewsData } = await supabase
                .from('reviews')
                .select(`
                  id,
                  rating,
                  title,
                  content,
                  visit_date,
                  created_at,
                  likes_count,
                  user_id,
                  profiles!reviews_user_id_fkey (
                    id,
                    username,
                    full_name,
                    avatar_url
                  )
                `)
                .eq('restaurant_id', dbRestaurantId)
                .order('created_at', { ascending: false });

              // Get photos for reviews
              const reviewIds = reviewsData?.map((r: any) => r.id) || [];
              const { data: photosData } = await supabase
                .from('review_photos')
                .select('review_id, photo_url')
                .in('review_id', reviewIds)
                .order('sort_order', { ascending: true });

              // Group photos by review
              const photosByReview = new Map<string, string[]>();
              photosData?.forEach((photo: any) => {
                if (!photosByReview.has(photo.review_id)) {
                  photosByReview.set(photo.review_id, []);
                }
                photosByReview.get(photo.review_id)?.push(photo.photo_url);
              });

              // Get likes counts
              const { data: likesData } = await supabase
                .from('review_likes')
                .select('review_id')
                .in('review_id', reviewIds);

              const likesCounts: { [key: string]: number } = {};
              likesData?.forEach(like => {
                likesCounts[like.review_id] = (likesCounts[like.review_id] || 0) + 1;
              });

              // Get comments counts
              const { data: commentsData } = await supabase
                .from('review_comments')
                .select('review_id')
                .in('review_id', reviewIds);

              const commentsCounts: { [key: string]: number } = {};
              commentsData?.forEach(comment => {
                commentsCounts[comment.review_id] = (commentsCounts[comment.review_id] || 0) + 1;
              });

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

              ourReviews = reviewsData?.map((review: any) => ({
                id: review.id,
                rating: review.rating,
                title: review.title,
                content: review.content || '',
                visitDate: review.visit_date,
                createdAt: review.created_at,
                likesCount: likesCounts[review.id] || 0,
                commentsCount: commentsCounts[review.id] || 0,
                isLiked: userLikes.includes(review.id),
                user: {
                  id: review.profiles.id,
                  username: review.profiles.username,
                  fullName: review.profiles.full_name || review.profiles.username,
                  avatarUrl: review.profiles.avatar_url,
                },
                photos: photosByReview.get(review.id) || [],
              })) || [];
            }

            // Determine which reviews to show
            let reviewsToShow: any[] = [];
            
            // If we have reviews from following users (friends), show only those
            if (user && followingIds.length > 0) {
              const friendReviews = ourReviews.filter(review => followingIds.includes(review.user.id));
              if (friendReviews.length > 0) {
                reviewsToShow = friendReviews;
              }
            }
            
            // If no friend reviews or user not logged in, show Google reviews with photos only
            if (reviewsToShow.length === 0 && googleData.reviews) {
              reviewsToShow = (googleData.reviews || [])
                .filter((review: any) => {
                  // Only show Google reviews that have photos
                  return review.photos && review.photos.length > 0;
                })
                .map((review: any) => ({
                  id: `google-${review.time}`,
                  rating: review.rating,
                  title: null,
                  content: review.text || '',
                  visitDate: null,
                  createdAt: new Date(review.time * 1000).toISOString(),
                  likesCount: 0,
                  commentsCount: 0,
                  isLiked: false,
                  user: {
                    id: review.author_name,
                    username: review.author_name,
                    fullName: review.author_name,
                    avatarUrl: review.profile_photo_url,
                  },
                  // Map Google photos to photo URLs
                  photos: (review.photos || []).map((photo: any) => 
                    photo.photo_reference 
                      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`
                      : null
                  ).filter((url: string | null) => url !== null),
                }));
            }
            
            // If still no reviews to show, include all our reviews (including user's own)
            if (reviewsToShow.length === 0) {
              reviewsToShow = ourReviews;
            }

            // Return Google data formatted as our restaurant structure
            return NextResponse.json({
              restaurant: {
                id: id,
                name: googleData.name,
                description: googleData.editorial_summary?.overview,
                address: googleData.formatted_address,
                city: googleData.address_components?.find((c: any) => c.types.includes('locality'))?.long_name,
                country: googleData.address_components?.find((c: any) => c.types.includes('country'))?.long_name,
                phone: googleData.formatted_phone_number,
                website: googleData.website,
                priceLevel: googleData.price_level,
                cuisineTypes: googleData.types?.filter((t: string) => 
                  !['point_of_interest', 'establishment', 'food'].includes(t)
                ) || [],
                imageUrl: googleData.photos?.[0]?.photo_reference 
                  ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${googleData.photos[0].photo_reference}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`
                  : null,
                averageRating: googleData.rating || 0,
                totalReviews: googleData.user_ratings_total || 0,
                googlePlaceId: id,
                latitude: googleData.geometry?.location?.lat || 0,
                longitude: googleData.geometry?.location?.lng || 0,
              },
              reviews: reviewsToShow,
              isWishlisted,
              userHasReviewed,
              friendsWhoReviewed,
            });
          }
        } catch (googleError) {
          console.error('Error fetching from Google:', googleError);
        }
        
        return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
      }
    }

    if (restaurantError || !restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    // Get the actual restaurant ID for querying reviews
    const dbRestaurantId = restaurant.id;

    // Get all reviews for this restaurant
    const { data: reviewsData } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        title,
        content,
        visit_date,
        created_at,
        user_id
      `)
      .eq('restaurant_id', dbRestaurantId)
      .order('created_at', { ascending: false });

    // Get user profiles for reviews
    const userIds = reviewsData?.map(r => r.user_id) || [];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', userIds);

    const profilesMap = new Map();
    profilesData?.forEach((profile: any) => {
      profilesMap.set(profile.id, profile);
    });

    // Get photos for reviews
    const reviewIds = reviewsData?.map((r: any) => r.id) || [];
    const { data: photosData } = await supabase
      .from('review_photos')
      .select('review_id, photo_url')
      .in('review_id', reviewIds)
      .order('sort_order', { ascending: true });

    // Group photos by review
    const photosByReview = new Map<string, string[]>();
    photosData?.forEach((photo: any) => {
      if (!photosByReview.has(photo.review_id)) {
        photosByReview.set(photo.review_id, []);
      }
      photosByReview.get(photo.review_id)?.push(photo.photo_url);
    });

    // Get likes counts
    const { data: likesData } = await supabase
      .from('review_likes')
      .select('review_id')
      .in('review_id', reviewIds);

    const likesCounts: { [key: string]: number } = {};
    likesData?.forEach(like => {
      likesCounts[like.review_id] = (likesCounts[like.review_id] || 0) + 1;
    });

    // Get comments counts
    const { data: commentsData } = await supabase
      .from('review_comments')
      .select('review_id')
      .in('review_id', reviewIds);

    const commentsCounts: { [key: string]: number } = {};
    commentsData?.forEach(comment => {
      commentsCounts[comment.review_id] = (commentsCounts[comment.review_id] || 0) + 1;
    });

    // Get review likes if user is logged in
    let likedReviewIds = new Set<string>();
    if (user) {
      const { data: userLikesData } = await supabase
        .from('review_likes')
        .select('review_id')
        .eq('user_id', user.id)
        .in('review_id', reviewIds);
      
      likedReviewIds = new Set(userLikesData?.map(l => l.review_id) || []);
    }

    const allReviews = reviewsData?.map((review: any) => {
      const profile = profilesMap.get(review.user_id);
      return {
        id: review.id,
        rating: review.rating,
        title: review.title,
        content: review.content || '',
        visitDate: review.visit_date,
        createdAt: review.created_at,
        likesCount: likesCounts[review.id] || 0,
        commentsCount: commentsCounts[review.id] || 0,
        isLiked: likedReviewIds.has(review.id),
        user: {
          id: review.user_id,
          username: profile?.username || 'Unknown',
          fullName: profile?.full_name || profile?.username || 'Unknown',
          avatarUrl: profile?.avatar_url,
        },
        photos: photosByReview.get(review.id) || [],
      };
    }) || [];

    // Prioritize friend reviews if user is logged in
    let reviews = allReviews;
    if (user) {
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = followingData?.map(f => f.following_id) || [];
      
      if (followingIds.length > 0) {
        const friendReviews = allReviews.filter(review => followingIds.includes(review.user.id));
        // If there are friend reviews, show only those, otherwise show all
        if (friendReviews.length > 0) {
          reviews = friendReviews;
        }
      }
    }

    // Check if user has wishlisted this restaurant
    let isWishlisted = false;
    if (user) {
      const { data: wishlistData } = await supabase
        .from('wishlist')
        .select('id')
        .eq('user_id', user.id)
        .eq('restaurant_id', dbRestaurantId)
        .single();
      
      isWishlisted = !!wishlistData;
    }

    // Check if user has reviewed this restaurant
    let userHasReviewed = false;
    if (user) {
      const { data: userReviewData } = await supabase
        .from('reviews')
        .select('id')
        .eq('user_id', user.id)
        .eq('restaurant_id', dbRestaurantId)
        .single();
      
      userHasReviewed = !!userReviewData;
    }

    // Get friends who have reviewed this restaurant
    let friendsWhoReviewed: any[] = [];
    if (user) {
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = followingData?.map(f => f.following_id) || [];
      
      if (followingIds.length > 0) {
        const { data: friendReviewsData } = await supabase
          .from('reviews')
          .select('user_id')
          .eq('restaurant_id', dbRestaurantId)
          .in('user_id', followingIds);

        const friendIds = [...new Set(friendReviewsData?.map(r => r.user_id) || [])];
        
        const { data: friendProfiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', friendIds);

        friendsWhoReviewed = friendProfiles?.map((profile: any) => ({
          id: profile.id,
          username: profile.username,
          fullName: profile.full_name || profile.username,
          avatarUrl: profile.avatar_url,
        })) || [];
      }
    }

    // Extract location from PostGIS geography field
    const latitude = 32.0853; // Default Tel Aviv
    const longitude = 34.7818;
    
    // PostGIS location is stored as geography - we'll need to parse it properly
    // For now using defaults, but this can be extracted from the location field

    return NextResponse.json({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        description: restaurant.description,
        address: restaurant.address,
        city: restaurant.city,
        country: restaurant.country,
        phone: restaurant.phone,
        website: restaurant.website,
        priceLevel: restaurant.price_level,
        cuisineTypes: restaurant.cuisine_types || [],
        imageUrl: restaurant.image_url,
        averageRating: restaurant.average_rating || 0,
        totalReviews: restaurant.total_reviews || 0,
        googlePlaceId: restaurant.google_place_id,
        latitude,
        longitude,
      },
      reviews,
      isWishlisted,
      userHasReviewed,
      friendsWhoReviewed,
    });
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

