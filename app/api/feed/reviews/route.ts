import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Helper function to check if restaurant is currently open
function isRestaurantOpen(openingHours: any): boolean {
  if (!openingHours) return false;
  
  const now = new Date();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = days[now.getDay()];
  const currentTime = now.getHours() * 100 + now.getMinutes();
  
  const todayHours = openingHours[currentDay];
  if (!todayHours || !todayHours.open || !todayHours.close) return false;
  
  // Parse time strings like "09:00" to number like 900
  const parseTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 100 + minutes;
  };
  
  const openTime = parseTime(todayHours.open);
  const closeTime = parseTime(todayHours.close);
  
  // Handle overnight hours (close time is next day)
  if (closeTime < openTime) {
    return currentTime >= openTime || currentTime <= closeTime;
  }
  
  return currentTime >= openTime && currentTime <= closeTime;
}

// Helper function to calculate match score
async function calculateMatchScore(
  supabase: any,
  userId: string | undefined,
  restaurantId: string,
  googlePlaceId: string | undefined
): Promise<number> {
  if (!userId) return 75;

  try {
    const { data: tasteProfile } = await supabase
      .from('user_taste_profiles')
      .select('taste_embedding')
      .eq('user_id', userId)
      .single();

    if (!tasteProfile?.taste_embedding) return 75;

    if (googlePlaceId) {
      const { data: cachedRestaurant } = await supabase
        .from('restaurant_cache')
        .select('embedding, google_rating')
        .eq('google_place_id', googlePlaceId)
        .single();

      if (cachedRestaurant?.embedding) {
        const similarity = cosineSimilarity(
          tasteProfile.taste_embedding,
          cachedRestaurant.embedding
        );
        const rating = cachedRestaurant.google_rating || 3.5;
        const score = (0.50 * similarity + 0.25 * (rating / 5) + 0.25 * 0.75) * 100;
        return Math.max(50, Math.min(100, Math.round(score)));
      }
    }

    return Math.floor(Math.random() * 20 + 70);
  } catch (error) {
    console.error('Error calculating match score:', error);
    return 75;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0.7;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0.7;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Calculate distance between two points in meters
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get('page') || '0');
    const limit = parseInt(searchParams.get('limit') || '10');
    const latitude = parseFloat(searchParams.get('latitude') || '0');
    const longitude = parseFloat(searchParams.get('longitude') || '0');
    const radius = parseInt(searchParams.get('radius') || '50000');
    const tab = searchParams.get('tab') || 'foryou'; // 'following' or 'foryou'
    const city = searchParams.get('city') || null;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    let followingIds: string[] = [];
    if (user) {
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      followingIds = (followingData || []).map((f: any) => f.following_id);
    }

    // Get nearby restaurants first
    let nearbyRestaurants: any[] = [];
    let distanceMap = new Map<string, number>();
    let useAllRestaurants = false;

    try {
      const { data, error } = await supabase.rpc(
        'restaurants_nearby',
        {
          lat: latitude,
          lng: longitude,
          radius_meters: radius
        }
      );
      
      if (error) {
        console.error('[Feed Reviews] Error in restaurants_nearby:', error);
      }
      
      nearbyRestaurants = data || [];
      console.log('[Feed Reviews] Nearby restaurants found:', nearbyRestaurants.length);
    } catch (e) {
      console.error('[Feed Reviews] RPC call failed:', e);
    }

    // If no nearby restaurants found, get all restaurants as fallback
    if (nearbyRestaurants.length === 0) {
      console.log('[Feed Reviews] No nearby restaurants, fetching all restaurants');
      useAllRestaurants = true;
      
      const { data: allRestaurants } = await supabase
        .from('restaurants')
        .select('id')
        .limit(100);
      
      nearbyRestaurants = (allRestaurants || []).map(r => ({ id: r.id, distance_meters: 0 }));
      console.log('[Feed Reviews] All restaurants fallback:', nearbyRestaurants.length);
    }

    if (nearbyRestaurants.length === 0) {
      console.log('[Feed Reviews] Still no restaurants, returning empty');
      return NextResponse.json({ reviews: [], hasMore: false });
    }

    const nearbyRestaurantIds = nearbyRestaurants.map((r: any) => r.id);
    distanceMap = new Map(nearbyRestaurants.map((r: any) => [r.id, r.distance_meters || 0]));

    // Build the reviews query based on tab
    let reviewsQuery = supabase
      .from('reviews')
      .select(`
        id,
        rating,
        content,
        created_at,
        user_id,
        restaurant_id,
        restaurants (
          id,
          name,
          address,
          city,
          google_place_id,
          image_url
        )
      `)
      .in('restaurant_id', nearbyRestaurantIds)
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    // Filter by tab
    if (tab === 'following') {
      if (followingIds.length === 0) {
        return NextResponse.json({ reviews: [], hasMore: false });
      }
      reviewsQuery = reviewsQuery.in('user_id', followingIds);
    }

    // Filter by city if provided
    if (city) {
      reviewsQuery = reviewsQuery.eq('restaurants.city', city);
    }

    // Execute query
    const { data: reviewsData, error: reviewsError } = await reviewsQuery;

    if (reviewsError) {
      console.error('Error fetching reviews:', reviewsError);
      return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
    }

    // Filter out reviews without media (photos or videos)
    const reviewIds = (reviewsData || []).map((r: any) => r.id);

    // Get photos for all reviews
    const { data: photosData } = await supabase
      .from('review_photos')
      .select('review_id, id, photo_url, sort_order')
      .in('review_id', reviewIds)
      .order('sort_order', { ascending: true });

    // Get videos for all reviews (if table exists)
    let videosData: any[] = [];
    try {
      const { data } = await supabase
        .from('review_videos')
        .select('review_id, id, video_url, thumbnail_url, duration_seconds, sort_order')
        .in('review_id', reviewIds)
        .order('sort_order', { ascending: true });
      videosData = data || [];
    } catch (e) {
      // Table might not exist yet
      console.log('review_videos table not found, skipping');
    }

    // Group media by review
    const mediaByReview = new Map<string, any[]>();
    
    (photosData || []).forEach((photo: any) => {
      if (!mediaByReview.has(photo.review_id)) {
        mediaByReview.set(photo.review_id, []);
      }
      mediaByReview.get(photo.review_id)!.push({
        id: photo.id,
        type: 'photo',
        url: photo.photo_url,
        sortOrder: photo.sort_order
      });
    });

    (videosData || []).forEach((video: any) => {
      if (!mediaByReview.has(video.review_id)) {
        mediaByReview.set(video.review_id, []);
      }
      mediaByReview.get(video.review_id)!.push({
        id: video.id,
        type: 'video',
        url: video.video_url,
        thumbnailUrl: video.thumbnail_url,
        durationSeconds: video.duration_seconds,
        sortOrder: video.sort_order
      });
    });

    // Debug logging
    console.log('[Feed Reviews] Total reviews found:', reviewsData?.length || 0);
    console.log('[Feed Reviews] Total photos found:', photosData?.length || 0);
    console.log('[Feed Reviews] Total videos found:', videosData?.length || 0);
    console.log('[Feed Reviews] Reviews with media map size:', mediaByReview.size);

    // Filter reviews that have at least one media item
    const reviewsWithMedia = (reviewsData || []).filter((r: any) => {
      const media = mediaByReview.get(r.id);
      return media && media.length > 0;
    });

    console.log('[Feed Reviews] Reviews with media:', reviewsWithMedia.length);

    // If no reviews with media, fall back to showing reviews with restaurant images
    let reviewsToShow = reviewsWithMedia;
    let usedFallback = false;
    
    if (reviewsWithMedia.length === 0 && reviewsData && reviewsData.length > 0) {
      console.log('[Feed Reviews] No reviews with media, using fallback with restaurant images');
      usedFallback = true;
      // Show all reviews, we'll use restaurant image as fallback
      reviewsToShow = reviewsData;
    }

    // Paginate
    const paginatedReviews = reviewsToShow.slice(page * limit, (page + 1) * limit);
    const hasMore = reviewsToShow.length > (page + 1) * limit;

    // Get user profiles for all reviews
    const userIds = paginatedReviews.map((r: any) => r.user_id);
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', userIds);

    const profilesMap = new Map(
      (profilesData || []).map((p: any) => [p.id, p])
    );

    // Get likes counts
    const paginatedReviewIds = paginatedReviews.map((r: any) => r.id);
    const { data: likesData } = await supabase
      .from('review_likes')
      .select('review_id')
      .in('review_id', paginatedReviewIds);

    const likesCounts: Record<string, number> = {};
    (likesData || []).forEach((like: any) => {
      likesCounts[like.review_id] = (likesCounts[like.review_id] || 0) + 1;
    });

    // Get user's likes
    let userLikes: string[] = [];
    if (user) {
      const { data: userLikesData } = await supabase
        .from('review_likes')
        .select('review_id')
        .eq('user_id', user.id)
        .in('review_id', paginatedReviewIds);
      userLikes = (userLikesData || []).map((l: any) => l.review_id);
    }

    // Get comments counts
    const { data: commentsData } = await supabase
      .from('review_comments')
      .select('review_id')
      .in('review_id', paginatedReviewIds);

    const commentsCounts: Record<string, number> = {};
    (commentsData || []).forEach((comment: any) => {
      commentsCounts[comment.review_id] = (commentsCounts[comment.review_id] || 0) + 1;
    });

    // Get user's wishlist items
    let userWishlist: string[] = [];
    if (user) {
      const restaurantIds = paginatedReviews.map((r: any) => r.restaurant_id);
      const { data: wishlistData } = await supabase
        .from('wishlist')
        .select('restaurant_id')
        .eq('user_id', user.id)
        .in('restaurant_id', restaurantIds);
      userWishlist = (wishlistData || []).map((w: any) => w.restaurant_id);
    }

    // Get mutual friends for each restaurant
    const mutualFriendsMap = new Map<string, any[]>();
    if (followingIds.length > 0) {
      const restaurantIds = [...new Set(paginatedReviews.map((r: any) => r.restaurant_id))];
      
      for (const restaurantId of restaurantIds) {
        const { data: friendReviews } = await supabase
          .from('reviews')
          .select('user_id')
          .eq('restaurant_id', restaurantId)
          .in('user_id', followingIds)
          .limit(5);

        if (friendReviews && friendReviews.length > 0) {
          const friendIds = friendReviews.map((fr: any) => fr.user_id);
          const { data: friendProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', friendIds);

          mutualFriendsMap.set(restaurantId, (friendProfiles || []).map((p: any) => ({
            id: p.id,
            name: p.full_name,
            avatarUrl: p.avatar_url
          })));
        }
      }
    }

    // Get google_place_ids for opening hours lookup
    const googlePlaceIds = paginatedReviews
      .map((r: any) => r.restaurants?.google_place_id)
      .filter(Boolean);
    
    let openingHoursMap = new Map<string, any>();
    if (googlePlaceIds.length > 0) {
      const { data: cacheData } = await supabase
        .from('restaurant_cache')
        .select('google_place_id, opening_hours')
        .in('google_place_id', googlePlaceIds);
      
      (cacheData || []).forEach((c: any) => {
        if (c.opening_hours) {
          openingHoursMap.set(c.google_place_id, c.opening_hours);
        }
      });
    }

    // Filter out reviews without restaurant data
    const validReviews = paginatedReviews.filter((review: any) => review.restaurants);

    // Build response
    const reviews = await Promise.all(
      validReviews.map(async (review: any) => {
        const profile = profilesMap.get(review.user_id);
        const restaurant = review.restaurants;
        let media = mediaByReview.get(review.id) || [];
        
        // Sort media by sortOrder
        media.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
        
        // If no media and we're using fallback, create a placeholder from restaurant image
        if (media.length === 0 && usedFallback && restaurant?.image_url) {
          media = [{
            id: `restaurant-${restaurant.id}`,
            type: 'photo',
            url: restaurant.image_url,
            sortOrder: 0
          }];
        }

        // Get opening hours from cache
        const openingHours = restaurant?.google_place_id 
          ? openingHoursMap.get(restaurant.google_place_id) 
          : null;

        // Calculate match percentage
        const matchPercentage = user
          ? await calculateMatchScore(supabase, user.id, restaurant.id, restaurant.google_place_id)
          : Math.floor(Math.random() * 20 + 70);

        // Get distance
        const distanceMeters = distanceMap.get(review.restaurant_id) || 0;
        const distanceKm = distanceMeters / 1000;

        return {
          id: review.id,
          rating: review.rating,
          content: review.content || '',
          createdAt: review.created_at,
          user: {
            id: review.user_id,
            username: profile?.username || 'Unknown',
            fullName: profile?.full_name || profile?.username || 'Unknown',
            avatarUrl: profile?.avatar_url
          },
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
            address: restaurant.address,
            city: restaurant.city,
            distance: distanceKm,
            isOpen: isRestaurantOpen(openingHours),
            matchPercentage,
            googlePlaceId: restaurant.google_place_id,
            imageUrl: restaurant.image_url
          },
          media,
          likesCount: likesCounts[review.id] || 0,
          commentsCount: commentsCounts[review.id] || 0,
          isLiked: userLikes.includes(review.id),
          isSaved: userWishlist.includes(review.restaurant_id),
          mutualFriends: mutualFriendsMap.get(review.restaurant_id) || []
        };
      })
    );

    return NextResponse.json({ reviews, hasMore });
  } catch (error) {
    console.error('Error in feed reviews:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
