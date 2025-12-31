import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get('page') || '0');
    const limit = parseInt(searchParams.get('limit') || '5');
    const latitude = parseFloat(searchParams.get('latitude') || '0');
    const longitude = parseFloat(searchParams.get('longitude') || '0');
    const radius = parseInt(searchParams.get('radius') || '50000');

    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    let followingIds: string[] = [];
    if (user) {
      // Get user's following list
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      followingIds = (followingData || []).map((f: any) => f.following_id);
    }

    // Try to get reviews from following first
    let restaurants: any[] = [];
    let showingSource: 'following' | 'pachu' | 'google' | null = null;

    if (followingIds.length > 0) {
      // First, get nearby restaurants based on location
      const { data: nearbyRestaurants } = await supabase.rpc(
        'restaurants_nearby',
        {
          lat: latitude,
          lng: longitude,
          radius_meters: radius
        }
      );

      if (nearbyRestaurants && nearbyRestaurants.length > 0) {
        const nearbyRestaurantIds = nearbyRestaurants.map((r: any) => r.id);

        // Get reviews from people user follows for these nearby restaurants
        const { data: allReviews } = await supabase
          .from('reviews')
          .select('restaurant_id, restaurants(*)')
          .in('user_id', followingIds)
          .in('restaurant_id', nearbyRestaurantIds)
          .eq('is_published', true)
          .order('created_at', { ascending: false });

        // Group by restaurant to get unique restaurants
        const restaurantIds = new Set<string>();
        const restaurantsList: any[] = [];
        
        (allReviews || []).forEach((review: any) => {
          if (review.restaurants && !restaurantIds.has(review.restaurants.id)) {
            restaurantIds.add(review.restaurants.id);
            restaurantsList.push(review.restaurants);
          }
        });

        if (restaurantsList.length > 0) {
          showingSource = 'following';
          
          // Get paginated restaurants
          const paginatedRestaurants = restaurantsList.slice(page * limit, (page + 1) * limit);

          // Build restaurant data with reviews
          restaurants = await Promise.all(
            paginatedRestaurants.map(async (restaurant: any) => {
              return await buildRestaurantData(supabase, restaurant, followingIds, user);
            })
          );
        }
      }
    }

    // If no following reviews, try to get all Pachu reviews (filtered by location)
    if (restaurants.length === 0) {
      // First, get nearby restaurants based on location
      const { data: nearbyRestaurants } = await supabase.rpc(
        'restaurants_nearby',
        {
          lat: latitude,
          lng: longitude,
          radius_meters: radius
        }
      );

      if (nearbyRestaurants && nearbyRestaurants.length > 0) {
        const nearbyRestaurantIds = nearbyRestaurants.map((r: any) => r.id);

        // Get all published reviews for these nearby restaurants
        const { data: allPachuReviews } = await supabase
          .from('reviews')
          .select('restaurant_id, restaurants(*)')
          .in('restaurant_id', nearbyRestaurantIds)
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(100);

        // Group by restaurant
        const restaurantIds = new Set<string>();
        const restaurantsList: any[] = [];
        
        (allPachuReviews || []).forEach((review: any) => {
          if (review.restaurants && !restaurantIds.has(review.restaurants.id)) {
            restaurantIds.add(review.restaurants.id);
            restaurantsList.push(review.restaurants);
          }
        });

        if (restaurantsList.length > 0) {
          showingSource = 'pachu';
          
          // Get paginated restaurants
          const paginatedRestaurants = restaurantsList.slice(page * limit, (page + 1) * limit);

          // Build restaurant data with reviews (no friend data needed)
          restaurants = await Promise.all(
            paginatedRestaurants.map(async (restaurant: any) => {
              return await buildRestaurantData(supabase, restaurant, [], user);
            })
          );
        }
      }
    }

    // If still no reviews, fetch from Google Places
    if (restaurants.length === 0) {
      showingSource = 'google';
      
      // Use provided location for Google search
      const googleResponse = await fetch(
        `${request.nextUrl.origin}/api/restaurants/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}`
      );
      const googleData = await googleResponse.json();

      if (googleData.restaurants) {
        // Get paginated restaurants and build with Google reviews
        const paginatedRestaurants = googleData.restaurants.slice(page * limit, (page + 1) * limit);
        
        restaurants = await Promise.all(
          paginatedRestaurants.map(async (restaurant: any) => {
            try {
              // Fetch details for reviews
              const detailsResponse = await fetch(
                `${request.nextUrl.origin}/api/restaurants/details?placeId=${restaurant.googlePlaceId}`
              );
              const detailsData = await detailsResponse.json();
              
              const reviews = (detailsData.reviews || []).slice(0, 10).map((googleReview: any, index: number) => {
                // Extract photos from Google review if available
                const reviewPhotos: string[] = [];
                if (googleReview.photos && Array.isArray(googleReview.photos)) {
                  googleReview.photos.forEach((photo: any) => {
                    if (photo.photo_reference) {
                      reviewPhotos.push(
                        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`
                      );
                    }
                  });
                }
                
                // If no review photos, use restaurant photos
                if (reviewPhotos.length === 0 && detailsData.photos && detailsData.photos[index + 1]) {
                  const photo = detailsData.photos[index + 1];
                  if (photo.photo_reference) {
                    reviewPhotos.push(
                      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`
                    );
                  }
                }
                
                return {
                  id: `google-${restaurant.id}-${googleReview.author_name}-${index}`,
                  rating: googleReview.rating,
                  content: googleReview.text,
                  createdAt: new Date(googleReview.time * 1000).toISOString(),
                  likesCount: 0,
                  commentsCount: 0,
                  isLiked: false,
                  user: {
                    id: `google-user-${googleReview.author_name}`,
                    username: googleReview.author_name,
                    fullName: googleReview.author_name,
                    avatarUrl: googleReview.profile_photo_url || undefined,
                  },
                  photos: reviewPhotos,
                };
              });

              return {
                id: restaurant.id,
                name: restaurant.name,
                address: restaurant.address,
                imageUrl: restaurant.photoUrl,
                rating: restaurant.rating,
                totalReviews: restaurant.totalReviews || 0,
                distance: restaurant.distance,
                matchPercentage: Math.floor(Math.random() * 30 + 70),
                mutualFriends: [],
                reviews,
                googlePlaceId: restaurant.googlePlaceId,
                latitude: restaurant.latitude,
                longitude: restaurant.longitude,
              };
            } catch (error) {
              console.error('Error fetching restaurant details:', error);
              return null;
            }
          })
        );
        
        // Filter out null results
        restaurants = restaurants.filter((r: any) => r !== null);
      }
    }

    // Determine hasMore based on source
    let hasMore = false;
    if (showingSource === 'following' && followingIds.length > 0) {
      // Check if there are more following reviews in this location
      const { data: nearbyRestaurants } = await supabase.rpc(
        'restaurants_nearby',
        {
          lat: latitude,
          lng: longitude,
          radius_meters: radius
        }
      );

      if (nearbyRestaurants && nearbyRestaurants.length > 0) {
        const nearbyRestaurantIds = nearbyRestaurants.map((r: any) => r.id);

        const { data: allReviews } = await supabase
          .from('reviews')
          .select('restaurant_id, restaurants(*)')
          .in('user_id', followingIds)
          .in('restaurant_id', nearbyRestaurantIds)
          .eq('is_published', true);
        
        const restaurantIds = new Set<string>();
        (allReviews || []).forEach((review: any) => {
          if (review.restaurants) restaurantIds.add(review.restaurants.id);
        });
        
        hasMore = restaurantIds.size > (page + 1) * limit;
      }
    } else if (showingSource === 'pachu') {
      // Check if there are more Pachu reviews in this location
      const { data: nearbyRestaurants } = await supabase.rpc(
        'restaurants_nearby',
        {
          lat: latitude,
          lng: longitude,
          radius_meters: radius
        }
      );

      if (nearbyRestaurants && nearbyRestaurants.length > 0) {
        const nearbyRestaurantIds = nearbyRestaurants.map((r: any) => r.id);

        const { data: allReviews } = await supabase
          .from('reviews')
          .select('restaurant_id, restaurants(*)')
          .in('restaurant_id', nearbyRestaurantIds)
          .eq('is_published', true);
        
        const restaurantIds = new Set<string>();
        (allReviews || []).forEach((review: any) => {
          if (review.restaurants) restaurantIds.add(review.restaurants.id);
        });
        
        hasMore = restaurantIds.size > (page + 1) * limit;
      }
    } else if (showingSource === 'google') {
      // Google has more if the original response had more
      const googleResponse = await fetch(
        `${request.nextUrl.origin}/api/restaurants/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}`
      );
      const googleData = await googleResponse.json();
      hasMore = googleData.restaurants && googleData.restaurants.length > (page + 1) * limit;
    }

    return NextResponse.json({
      restaurants,
      hasMore,
      showingSource,
    });
  } catch (error) {
    console.error('Error in prioritized feed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function buildRestaurantData(
  supabase: any,
  restaurant: any,
  followingIds: string[],
  user: any
) {
  // Get all reviews for this restaurant from specified users (or all if empty)
  let reviewsQuery = supabase
    .from('reviews')
    .select(`
      id,
      rating,
      content,
      created_at,
      user_id
    `)
    .eq('restaurant_id', restaurant.id)
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(10);

  // If followingIds provided, filter by them
  if (followingIds.length > 0) {
    reviewsQuery = reviewsQuery.in('user_id', followingIds);
  }

  const { data: reviewsData } = await reviewsQuery;

  // Get user profiles
  const userIds = (reviewsData || []).map((r: any) => r.user_id);
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .in('id', userIds);

  const profilesMap = new Map();
  (profilesData || []).forEach((profile: any) => {
    profilesMap.set(profile.id, profile);
  });

  // Get photos for these reviews
  const reviewIds = (reviewsData || []).map((r: any) => r.id);
  const { data: photosData } = await supabase
    .from('review_photos')
    .select('review_id, photo_url')
    .in('review_id', reviewIds)
    .order('sort_order', { ascending: true });

  // Group photos by review
  const photosByReview = new Map<string, string[]>();
  (photosData || []).forEach((photo: any) => {
    if (!photosByReview.has(photo.review_id)) {
      photosByReview.set(photo.review_id, []);
    }
    const photos = photosByReview.get(photo.review_id);
    if (photos) {
      photos.push(photo.photo_url);
    }
  });

  // Get likes counts
  const { data: likesData } = await supabase
    .from('review_likes')
    .select('review_id')
    .in('review_id', reviewIds);

  const likesCounts: { [key: string]: number } = {};
  (likesData || []).forEach((like: any) => {
    likesCounts[like.review_id] = (likesCounts[like.review_id] || 0) + 1;
  });

  // Get user's likes if logged in
  let userLikes: string[] = [];
  if (user) {
    const { data: userLikesData } = await supabase
      .from('review_likes')
      .select('review_id')
      .eq('user_id', user.id)
      .in('review_id', reviewIds);
    userLikes = (userLikesData || []).map((l: any) => l.review_id);
  }

  // Get comments counts
  const { data: commentsData } = await supabase
    .from('review_comments')
    .select('review_id')
    .in('review_id', reviewIds);

  const commentsCounts: { [key: string]: number } = {};
  (commentsData || []).forEach((comment: any) => {
    commentsCounts[comment.review_id] = (commentsCounts[comment.review_id] || 0) + 1;
  });

  const reviews = (reviewsData || []).map((review: any) => {
    const profile = profilesMap.get(review.user_id);
    const isLiked = userLikes.indexOf(review.id) !== -1;
    return {
      id: review.id,
      rating: review.rating,
      content: review.content || '',
      createdAt: review.created_at,
      likesCount: likesCounts[review.id] || 0,
      commentsCount: commentsCounts[review.id] || 0,
      isLiked: isLiked,
      user: {
        id: review.user_id,
        username: profile?.username || 'Unknown',
        fullName: profile?.full_name || profile?.username || 'Unknown',
        avatarUrl: profile?.avatar_url,
      },
      photos: photosByReview.get(review.id) || [],
    };
  });

  // Get mutual friends if followingIds provided
  let mutualFriends: any[] = [];
  if (followingIds.length > 0) {
    const { data: mutualFriendsData } = await supabase
      .from('reviews')
      .select('user_id')
      .eq('restaurant_id', restaurant.id)
      .in('user_id', followingIds);

    const friendIds: string[] = [];
    const seenIds = new Set<string>();
    (mutualFriendsData || []).forEach((r: any) => {
      if (!seenIds.has(r.user_id)) {
        seenIds.add(r.user_id);
        friendIds.push(r.user_id);
      }
    });
    
    const { data: friendProfiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', friendIds);

    mutualFriends = (friendProfiles || []).map((profile: any) => ({
      id: profile.id,
      name: profile.full_name || profile.username,
      avatarUrl: profile.avatar_url,
    }));
  }

  return {
    id: restaurant.id,
    name: restaurant.name,
    address: restaurant.address,
    imageUrl: restaurant.image_url,
    rating: restaurant.average_rating || 0,
    totalReviews: reviews.length,
    distance: undefined,
    matchPercentage: Math.floor(Math.random() * 30 + 70),
    mutualFriends,
    reviews,
    googlePlaceId: restaurant.google_place_id,
    latitude: 32.0853, // Default - would need PostGIS extraction
    longitude: 34.7818,
  };
}
