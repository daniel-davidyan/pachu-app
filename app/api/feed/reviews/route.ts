import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { feedCache, CACHE_TTL, ServerCache } from '@/lib/cache';

// =====================================================
// OPTIMIZED FEED API - TikTok Speed
// =====================================================
// Key optimizations:
// 1. Parallel queries with Promise.all()
// 2. Single batch queries instead of N+1 loops
// 3. Server-side caching (2 min TTL)
// 4. Pre-computed match scores from cache
// =====================================================

// Helper function to check if restaurant is currently open
function isRestaurantOpen(openingHours: any): boolean {
  if (!openingHours) return false;
  
  const now = new Date();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = days[now.getDay()];
  const currentTime = now.getHours() * 100 + now.getMinutes();
  
  const todayHours = openingHours[currentDay];
  if (!todayHours || !todayHours.open || !todayHours.close) return false;
  
  const parseTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 100 + minutes;
  };
  
  const openTime = parseTime(todayHours.open);
  const closeTime = parseTime(todayHours.close);
  
  if (closeTime < openTime) {
    return currentTime >= openTime || currentTime <= closeTime;
  }
  
  return currentTime >= openTime && currentTime <= closeTime;
}

// Cosine similarity for match score
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
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Type for cached restaurant with embedding
interface CachedRestaurant {
  google_place_id: string;
  embedding?: number[];
  google_rating?: number;
}

// Batch calculate match scores (FIXED N+1)
async function batchCalculateMatchScores(
  supabase: any,
  userId: string | undefined,
  googlePlaceIds: string[]
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  
  if (!userId || googlePlaceIds.length === 0) {
    // Return default scores
    googlePlaceIds.forEach(id => scores.set(id, 75));
    return scores;
  }

  try {
    // Single query to get user's taste profile
    const { data: tasteProfile } = await supabase
      .from('user_taste_profiles')
      .select('taste_embedding')
      .eq('user_id', userId)
      .single();

    if (!tasteProfile?.taste_embedding) {
      googlePlaceIds.forEach(id => scores.set(id, 75));
      return scores;
    }

    // Single query to get all restaurant embeddings
    const { data: cachedRestaurants } = await supabase
      .from('restaurant_cache')
      .select('google_place_id, embedding, google_rating')
      .in('google_place_id', googlePlaceIds);

    const restaurantMap = new Map<string, CachedRestaurant>(
      (cachedRestaurants || []).map((r: CachedRestaurant) => [r.google_place_id, r])
    );

    // Calculate scores in batch
    for (const placeId of googlePlaceIds) {
      const restaurant = restaurantMap.get(placeId);
      if (restaurant?.embedding) {
        const similarity = cosineSimilarity(
          tasteProfile.taste_embedding,
          restaurant.embedding
        );
        const rating = restaurant.google_rating || 3.5;
        const score = (0.50 * similarity + 0.25 * (rating / 5) + 0.25 * 0.75) * 100;
        scores.set(placeId, Math.max(50, Math.min(100, Math.round(score))));
      } else {
        scores.set(placeId, Math.floor(Math.random() * 20 + 70));
      }
    }

    return scores;
  } catch (error) {
    console.error('Error batch calculating match scores:', error);
    googlePlaceIds.forEach(id => scores.set(id, 75));
    return scores;
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get('page') || '0');
    const limit = parseInt(searchParams.get('limit') || '10');
    const latitude = parseFloat(searchParams.get('latitude') || '0');
    const longitude = parseFloat(searchParams.get('longitude') || '0');
    const radius = parseInt(searchParams.get('radius') || '50000');
    const tab = searchParams.get('tab') || 'foryou';
    const city = searchParams.get('city') || null;

    // Check cache first
    const cacheKey = ServerCache.makeKey('feed', { page, limit, latitude: latitude.toFixed(3), longitude: longitude.toFixed(3), radius, tab, city });
    const cached = feedCache.get<any>(cacheKey);
    if (cached) {
      console.log(`[Feed] Cache hit - ${Date.now() - startTime}ms`);
      return NextResponse.json(cached);
    }

    const supabase = await createClient();
    
    // PARALLEL: Get user and following data simultaneously
    const [userResult, nearbyResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase.rpc('restaurants_nearby', {
        lat: latitude,
        lng: longitude,
        radius_meters: radius
      })
    ]);
    
    const user = userResult.data?.user;
    let nearbyRestaurants = nearbyResult.data || [];
    
    // Get following IDs if user is logged in
    let followingIds: string[] = [];
    if (user) {
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      followingIds = (followingData || []).map((f: any) => f.following_id);
    }

    // Fallback if no nearby restaurants
    if (nearbyRestaurants.length === 0) {
      const { data: allRestaurants } = await supabase
        .from('restaurants')
        .select('id')
        .limit(100);
      nearbyRestaurants = (allRestaurants || []).map(r => ({ id: r.id, distance_meters: 0 }));
    }

    if (nearbyRestaurants.length === 0) {
      return NextResponse.json({ reviews: [], hasMore: false });
    }

    const nearbyRestaurantIds = nearbyRestaurants.map((r: any) => r.id);
    const distanceMap = new Map<string, number>(nearbyRestaurants.map((r: any) => [r.id, r.distance_meters || 0]));

    // Build reviews query based on tab
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

    if (tab === 'following') {
      if (followingIds.length === 0) {
        return NextResponse.json({ reviews: [], hasMore: false });
      }
      reviewsQuery = reviewsQuery.in('user_id', followingIds);
    }

    // PARALLEL: Fetch reviews and videos simultaneously
    const [reviewsResult, videosResult] = await Promise.all([
      reviewsQuery,
      tab === 'foryou' 
        ? supabase
            .from('review_videos')
            .select('review_id, id, video_url, thumbnail_url, duration_seconds, sort_order')
            .order('created_at', { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] })
    ]);

    let reviewsData = reviewsResult.data || [];
    let videosData = (videosResult as any).data || [];

    // For foryou tab, fetch additional reviews with videos
    if (tab === 'foryou' && videosData.length > 0) {
      const existingReviewIds = new Set(reviewsData.map((r: any) => r.id));
      const missingVideoReviewIds = [...new Set(videosData.map((v: any) => v.review_id))]
        .filter(id => !existingReviewIds.has(id));
      
      if (missingVideoReviewIds.length > 0) {
        const { data: videoReviews } = await supabase
          .from('reviews')
          .select(`
            id, rating, content, created_at, user_id, restaurant_id,
            restaurants (id, name, address, city, google_place_id, image_url)
          `)
          .in('id', missingVideoReviewIds)
          .eq('is_published', true);
        
        if (videoReviews) {
          reviewsData = [...reviewsData, ...videoReviews];
        }
      }
    }

    // For following tab, get videos for the reviews we have
    if (tab === 'following' && reviewsData.length > 0) {
      const reviewIds = reviewsData.map((r: any) => r.id);
      const { data: followingVideos } = await supabase
        .from('review_videos')
        .select('review_id, id, video_url, thumbnail_url, duration_seconds, sort_order')
        .in('review_id', reviewIds)
        .order('sort_order', { ascending: true });
      videosData = followingVideos || [];
    }

    const allReviewIds = reviewsData.map((r: any) => r.id);

    // PARALLEL: Fetch all related data at once (FIXED N+1)
    const [
      photosResult,
      likesResult,
      commentsResult,
      userLikesResult,
      profilesResult,
      openingHoursResult
    ] = await Promise.all([
      // Photos for all reviews
      supabase
        .from('review_photos')
        .select('review_id, id, photo_url, sort_order')
        .in('review_id', allReviewIds)
        .order('sort_order', { ascending: true }),
      
      // Likes counts (aggregate in JS, faster than count per review)
      supabase
        .from('review_likes')
        .select('review_id')
        .in('review_id', allReviewIds),
      
      // Comments counts
      supabase
        .from('review_comments')
        .select('review_id')
        .in('review_id', allReviewIds),
      
      // User's own likes
      user 
        ? supabase
            .from('review_likes')
            .select('review_id')
            .eq('user_id', user.id)
            .in('review_id', allReviewIds)
        : Promise.resolve({ data: [] }),
      
      // User profiles for all reviews
      supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', [...new Set(reviewsData.map((r: any) => r.user_id))]),
      
      // Opening hours from cache
      supabase
        .from('restaurant_cache')
        .select('google_place_id, opening_hours')
        .in('google_place_id', reviewsData
          .map((r: any) => r.restaurants?.google_place_id)
          .filter(Boolean))
    ]);

    const photosData = photosResult.data || [];
    const likesData = likesResult.data || [];
    const commentsData = commentsResult.data || [];
    const userLikes = new Set((userLikesResult.data || []).map((l: any) => l.review_id));
    const profilesMap = new Map((profilesResult.data || []).map((p: any) => [p.id, p]));
    const openingHoursMap = new Map((openingHoursResult.data || []).map((c: any) => [c.google_place_id, c.opening_hours]));

    // Build media map
    const mediaByReview = new Map<string, any[]>();
    photosData.forEach((photo: any) => {
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
    videosData.forEach((video: any) => {
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

    // Build counts maps
    const likesCounts: Record<string, number> = {};
    likesData.forEach((like: any) => {
      likesCounts[like.review_id] = (likesCounts[like.review_id] || 0) + 1;
    });
    
    const commentsCounts: Record<string, number> = {};
    commentsData.forEach((comment: any) => {
      commentsCounts[comment.review_id] = (commentsCounts[comment.review_id] || 0) + 1;
    });

    // Filter reviews with media
    let reviewsWithMedia = reviewsData.filter((r: any) => {
      const media = mediaByReview.get(r.id);
      return media && media.length > 0;
    });

    // Fallback: use restaurant images if no media
    let usedFallback = false;
    if (reviewsWithMedia.length === 0 && reviewsData.length > 0) {
      usedFallback = true;
      reviewsWithMedia = reviewsData;
    }

    // Paginate
    const paginatedReviews = reviewsWithMedia.slice(page * limit, (page + 1) * limit);
    const hasMore = reviewsWithMedia.length > (page + 1) * limit;

    // PARALLEL: Get wishlist and mutual friends data (FIXED N+1)
    const paginatedRestaurantIds = [...new Set(paginatedReviews.map((r: any) => r.restaurant_id))];
    const googlePlaceIds = paginatedReviews
      .map((r: any) => r.restaurants?.google_place_id)
      .filter(Boolean);

    const [wishlistResult, mutualFriendsResult, matchScores] = await Promise.all([
      // User's wishlist (single query)
      user 
        ? supabase
            .from('wishlist')
            .select('restaurant_id')
            .eq('user_id', user.id)
            .in('restaurant_id', paginatedRestaurantIds)
        : Promise.resolve({ data: [] }),
      
      // Mutual friends for all restaurants (SINGLE QUERY - FIXED N+1)
      followingIds.length > 0
        ? supabase
            .from('reviews')
            .select(`
              restaurant_id,
              user_id,
              profiles!reviews_user_id_fkey (id, full_name, avatar_url)
            `)
            .in('restaurant_id', paginatedRestaurantIds)
            .in('user_id', followingIds)
            .limit(50)
        : Promise.resolve({ data: [] }),
      
      // Batch match scores (FIXED N+1)
      batchCalculateMatchScores(supabase, user?.id, googlePlaceIds)
    ]);

    const userWishlist = new Set((wishlistResult.data || []).map((w: any) => w.restaurant_id));

    // Build mutual friends map from single query result
    const mutualFriendsMap = new Map<string, any[]>();
    (mutualFriendsResult.data || []).forEach((review: any) => {
      if (!review.profiles) return;
      const restId = review.restaurant_id;
      if (!mutualFriendsMap.has(restId)) {
        mutualFriendsMap.set(restId, []);
      }
      const existing = mutualFriendsMap.get(restId)!;
      if (!existing.find(f => f.id === review.profiles.id)) {
        existing.push({
          id: review.profiles.id,
          name: review.profiles.full_name,
          avatarUrl: review.profiles.avatar_url
        });
      }
    });

    // Build final response
    const reviews = paginatedReviews
      .filter((review: any) => review.restaurants)
      .map((review: any) => {
        const profile = profilesMap.get(review.user_id);
        const restaurant = review.restaurants;
        let media = mediaByReview.get(review.id) || [];
        
        media.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
        
        if (media.length === 0 && usedFallback && restaurant?.image_url) {
          media = [{
            id: `restaurant-${restaurant.id}`,
            type: 'photo',
            url: restaurant.image_url,
            sortOrder: 0
          }];
        }

        const openingHours = restaurant?.google_place_id 
          ? openingHoursMap.get(restaurant.google_place_id) 
          : null;

        const matchPercentage = restaurant?.google_place_id
          ? matchScores.get(restaurant.google_place_id) || 75
          : Math.floor(Math.random() * 20 + 70);

        const distanceMeters: number = distanceMap.get(review.restaurant_id) || 0;

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
            distance: distanceMeters / 1000,
            isOpen: isRestaurantOpen(openingHours),
            matchPercentage,
            googlePlaceId: restaurant.google_place_id,
            imageUrl: restaurant.image_url
          },
          media,
          likesCount: likesCounts[review.id] || 0,
          commentsCount: commentsCounts[review.id] || 0,
          isLiked: userLikes.has(review.id),
          isSaved: userWishlist.has(review.restaurant_id),
          mutualFriends: mutualFriendsMap.get(review.restaurant_id) || []
        };
      });

    const response = { reviews, hasMore };
    
    // Cache the result
    feedCache.set(cacheKey, response, CACHE_TTL.FEED);
    
    console.log(`[Feed] Complete - ${Date.now() - startTime}ms, ${reviews.length} reviews`);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in feed reviews:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
