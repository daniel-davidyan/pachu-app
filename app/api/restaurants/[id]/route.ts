import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { restaurantCache, CACHE_TTL, ServerCache } from '@/lib/cache';

// =====================================================
// OPTIMIZED RESTAURANT API - TikTok Speed
// =====================================================
// Key optimizations:
// 1. Parallel queries with Promise.all()
// 2. Server-side caching (5 min TTL)
// 3. Minimal Google API calls (deferred to client)
// =====================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    // Get user first to determine if we can use cache
    // (Cache is only for anonymous users since response contains user-specific data)
    const { data: { user } } = await supabase.auth.getUser();
    
    const cacheKey = ServerCache.makeKey('restaurant', { id });
    
    // Only use cache for anonymous users (response contains user-specific data like isLiked, isWishlisted, friend ordering)
    if (!user) {
      const cached = restaurantCache.get<any>(cacheKey);
      if (cached) {
        console.log(`[Restaurant] Cache hit (anonymous) - ${Date.now() - startTime}ms`);
        return NextResponse.json(cached);
      }
    }

    // Check if ID is a UUID or Google Place ID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    // Fetch restaurant data
    const restaurantResult = isUUID
      ? await supabase.from('restaurants').select('*').eq('id', id).single()
      : await supabase.from('restaurants').select('*').eq('google_place_id', id).single();
    const restaurant = restaurantResult.data;
    const restaurantError = restaurantResult.error;

    // If not found by Google Place ID, try to fetch from Google API
    if (!isUUID && (restaurantError || !restaurant)) {
      return await handleGooglePlaceId(request, id, supabase, user, startTime);
    }

    if (restaurantError || !restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    const dbRestaurantId = restaurant.id;

    // PARALLEL: Fetch all related data at once
    const [
      reviewsResult,
      followingResult,
      wishlistResult
    ] = await Promise.all([
      // Get reviews with user info
      supabase
        .from('reviews')
        .select('id, rating, title, content, visit_date, created_at, user_id')
        .eq('restaurant_id', dbRestaurantId)
        .eq('is_published', true)
        .order('created_at', { ascending: false }),
      
      // Get following IDs (for friend reviews)
      user
        ? supabase.from('follows').select('following_id').eq('follower_id', user.id)
        : Promise.resolve({ data: [] }),
      
      // Check wishlist status
      user
        ? supabase.from('wishlist').select('id').eq('user_id', user.id).eq('restaurant_id', dbRestaurantId).single()
        : Promise.resolve({ data: null })
    ]);

    const reviewsData = reviewsResult.data || [];
    const followingIds = (followingResult.data || []).map((f: any) => f.following_id);
    const isWishlisted = !!wishlistResult.data;

    const reviewIds = reviewsData.map((r: any) => r.id);
    const userIds = [...new Set(reviewsData.map((r: any) => r.user_id))];

    // PARALLEL: Fetch review-related data
    const [
      profilesResult,
      photosResult,
      videosResult,
      likesResult,
      commentsResult,
      userLikesResult
    ] = await Promise.all([
      // User profiles
      supabase.from('profiles').select('id, username, full_name, avatar_url').in('id', userIds),
      
      // Review photos
      reviewIds.length > 0
        ? supabase.from('review_photos').select('review_id, photo_url').in('review_id', reviewIds).order('sort_order', { ascending: true })
        : Promise.resolve({ data: [] }),
      
      // Review videos
      reviewIds.length > 0
        ? supabase.from('review_videos').select('review_id, video_url, thumbnail_url, duration_seconds').in('review_id', reviewIds).order('sort_order', { ascending: true })
        : Promise.resolve({ data: [] }),
      
      // Likes counts
      reviewIds.length > 0
        ? supabase.from('review_likes').select('review_id').in('review_id', reviewIds)
        : Promise.resolve({ data: [] }),
      
      // Comments counts
      reviewIds.length > 0
        ? supabase.from('review_comments').select('review_id').in('review_id', reviewIds)
        : Promise.resolve({ data: [] }),
      
      // User's own likes
      user && reviewIds.length > 0
        ? supabase.from('review_likes').select('review_id').eq('user_id', user.id).in('review_id', reviewIds)
        : Promise.resolve({ data: [] })
    ]);

    // Build lookup maps
    const profilesMap = new Map((profilesResult.data || []).map((p: any) => [p.id, p]));
    
    const photosByReview = new Map<string, string[]>();
    (photosResult.data || []).forEach((photo: any) => {
      if (!photosByReview.has(photo.review_id)) {
        photosByReview.set(photo.review_id, []);
      }
      photosByReview.get(photo.review_id)?.push(photo.photo_url);
    });

    const videosByReview = new Map<string, Array<{ url: string; thumbnailUrl?: string; durationSeconds?: number }>>();
    (videosResult.data || []).forEach((video: any) => {
      if (!videosByReview.has(video.review_id)) {
        videosByReview.set(video.review_id, []);
      }
      videosByReview.get(video.review_id)?.push({
        url: video.video_url,
        thumbnailUrl: video.thumbnail_url,
        durationSeconds: video.duration_seconds,
      });
    });

    const likesCounts: Record<string, number> = {};
    (likesResult.data || []).forEach((like: any) => {
      likesCounts[like.review_id] = (likesCounts[like.review_id] || 0) + 1;
    });

    const commentsCounts: Record<string, number> = {};
    (commentsResult.data || []).forEach((comment: any) => {
      commentsCounts[comment.review_id] = (commentsCounts[comment.review_id] || 0) + 1;
    });

    const likedReviewIds = new Set((userLikesResult.data || []).map((l: any) => l.review_id));

    // Build reviews array
    const allReviews = reviewsData.map((review: any) => {
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
        videos: videosByReview.get(review.id) || [],
      };
    });

    // Show ALL Pachu reviews, sorted with friends first, then other users
    let reviews = allReviews;
    let showingNonFriendReviews = false;

    if (allReviews.length > 0) {
      // Sort: user's own reviews first, then friends, then others (sorted by date within each group)
      reviews = [...allReviews].sort((a, b) => {
        const aIsOwn = user && a.user.id === user.id;
        const bIsOwn = user && b.user.id === user.id;
        const aIsFriend = followingIds.includes(a.user.id);
        const bIsFriend = followingIds.includes(b.user.id);
        
        // Own reviews first
        if (aIsOwn && !bIsOwn) return -1;
        if (!aIsOwn && bIsOwn) return 1;
        // Then friends
        if (aIsFriend && !bIsFriend) return -1;
        if (!aIsFriend && bIsFriend) return 1;
        // Within same priority group, sort by created_at DESC (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      // Check if showing non-friend reviews (for info banner)
      const hasFriendReviews = reviews.some(r => followingIds.includes(r.user.id));
      const hasOwnReviews = user ? reviews.some(r => r.user.id === user.id) : false;
      showingNonFriendReviews = !hasFriendReviews && !hasOwnReviews && reviews.length > 0;
    }

    // Get friends who reviewed
    let friendsWhoReviewed: any[] = [];
    if (followingIds.length > 0) {
      const friendIds = [...new Set(allReviews
        .filter(r => followingIds.includes(r.user.id))
        .map(r => r.user.id))];
      
      friendsWhoReviewed = friendIds.map(fid => {
        const profile = profilesMap.get(fid);
        return {
          id: fid,
          username: profile?.username,
          fullName: profile?.full_name || profile?.username,
          avatarUrl: profile?.avatar_url,
        };
      });
    }

    // Extract location from restaurant data, with fallback to defaults (Tel Aviv)
    const latitude = restaurant.latitude || 32.0853;
    const longitude = restaurant.longitude || 34.7818;

    const response = {
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
      showingNonFriendReviews,
      isWishlisted,
      userHasReviewed: user ? allReviews.some(r => r.user.id === user.id) : false,
      friendsWhoReviewed,
    };

    // Only cache for anonymous users (response contains user-specific data)
    if (!user) {
      restaurantCache.set(cacheKey, response, CACHE_TTL.RESTAURANT);
    }
    
    console.log(`[Restaurant] Complete - ${Date.now() - startTime}ms`);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Handle Google Place ID lookups (separate function for clarity)
async function handleGooglePlaceId(
  request: NextRequest,
  id: string,
  supabase: any,
  user: any,
  startTime: number
) {
  try {
    // Fetch from Google Places API
    const googleResponse = await fetch(
      `${request.nextUrl.origin}/api/restaurants/details?placeId=${id}`
    );
    const googleData = await googleResponse.json();
    
    if (!googleData || !googleData.name) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    // Check if restaurant exists in DB under Google Place ID
    const { data: dbRestaurantCheck } = await supabase
      .from('restaurants')
      .select('id')
      .eq('google_place_id', id)
      .single();

    let friendsWhoReviewed: any[] = [];
    let isWishlisted = false;
    let ourReviews: any[] = [];
    let followingIds: string[] = [];

    if (dbRestaurantCheck && user) {
      const dbRestaurantId = dbRestaurantCheck.id;

      // PARALLEL: Fetch all user-related data
      const [followingResult, wishlistResult, reviewsResult] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', user.id),
        supabase.from('wishlist').select('id').eq('user_id', user.id).eq('restaurant_id', dbRestaurantId).single(),
        supabase
          .from('reviews')
          .select(`
            id, rating, title, content, visit_date, created_at, likes_count, user_id,
            profiles!reviews_user_id_fkey (id, username, full_name, avatar_url)
          `)
          .eq('restaurant_id', dbRestaurantId)
          .eq('is_published', true)
          .order('created_at', { ascending: false })
      ]);

      followingIds = (followingResult.data || []).map((f: any) => f.following_id);
      isWishlisted = !!wishlistResult.data;

      const reviewIds = (reviewsResult.data || []).map((r: any) => r.id);

      // PARALLEL: Fetch photos, videos, likes, comments
      const [photosResult, videosResult, likesResult, commentsResult, userLikesResult] = await Promise.all([
        supabase.from('review_photos').select('review_id, photo_url').in('review_id', reviewIds).order('sort_order', { ascending: true }),
        supabase.from('review_videos').select('review_id, video_url, thumbnail_url, duration_seconds').in('review_id', reviewIds).order('sort_order', { ascending: true }),
        supabase.from('review_likes').select('review_id').in('review_id', reviewIds),
        supabase.from('review_comments').select('review_id').in('review_id', reviewIds),
        supabase.from('review_likes').select('review_id').eq('user_id', user.id).in('review_id', reviewIds)
      ]);

      const photosByReview = new Map<string, string[]>();
      (photosResult.data || []).forEach((photo: any) => {
        if (!photosByReview.has(photo.review_id)) {
          photosByReview.set(photo.review_id, []);
        }
        photosByReview.get(photo.review_id)?.push(photo.photo_url);
      });

      const videosByReview = new Map<string, Array<{ url: string; thumbnailUrl?: string; durationSeconds?: number }>>();
      (videosResult.data || []).forEach((video: any) => {
        if (!videosByReview.has(video.review_id)) {
          videosByReview.set(video.review_id, []);
        }
        videosByReview.get(video.review_id)?.push({
          url: video.video_url,
          thumbnailUrl: video.thumbnail_url,
          durationSeconds: video.duration_seconds,
        });
      });

      const likesCounts: Record<string, number> = {};
      (likesResult.data || []).forEach((like: any) => {
        likesCounts[like.review_id] = (likesCounts[like.review_id] || 0) + 1;
      });

      const commentsCounts: Record<string, number> = {};
      (commentsResult.data || []).forEach((comment: any) => {
        commentsCounts[comment.review_id] = (commentsCounts[comment.review_id] || 0) + 1;
      });

      const userLikes = new Set((userLikesResult.data || []).map((l: any) => l.review_id));

      ourReviews = (reviewsResult.data || []).map((review: any) => ({
        id: review.id,
        rating: review.rating,
        title: review.title,
        content: review.content || '',
        visitDate: review.visit_date,
        createdAt: review.created_at,
        likesCount: likesCounts[review.id] || 0,
        commentsCount: commentsCounts[review.id] || 0,
        isLiked: userLikes.has(review.id),
        user: {
          id: review.profiles.id,
          username: review.profiles.username,
          fullName: review.profiles.full_name || review.profiles.username,
          avatarUrl: review.profiles.avatar_url,
        },
        photos: photosByReview.get(review.id) || [],
        videos: videosByReview.get(review.id) || [],
      }));

      // Get friends who reviewed
      if (followingIds.length > 0) {
        const friendIds = [...new Set(ourReviews
          .filter(r => followingIds.includes(r.user.id))
          .map(r => r.user.id))];
        
        friendsWhoReviewed = friendIds.map(fid => {
          const review = ourReviews.find(r => r.user.id === fid);
          return {
            id: fid,
            username: review?.user.username,
            fullName: review?.user.fullName,
            avatarUrl: review?.user.avatarUrl,
          };
        });
      }
    }

    // Show ALL Pachu reviews (sorted: own first, then friends, then others), fall back to Google only if no Pachu reviews
    let reviewsToShow: any[] = [];
    let showingGoogleReviews = false;

    if (ourReviews.length > 0) {
      // Sort: user's own reviews first, then friends, then others (sorted by date within each group)
      reviewsToShow = [...ourReviews].sort((a, b) => {
        const aIsOwn = user && a.user.id === user.id;
        const bIsOwn = user && b.user.id === user.id;
        const aIsFriend = followingIds.includes(a.user.id);
        const bIsFriend = followingIds.includes(b.user.id);
        
        // Own reviews first
        if (aIsOwn && !bIsOwn) return -1;
        if (!aIsOwn && bIsOwn) return 1;
        // Then friends
        if (aIsFriend && !bIsFriend) return -1;
        if (!aIsFriend && bIsFriend) return 1;
        // Within same priority group, sort by created_at DESC (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (googleData.reviews && googleData.reviews.length > 0) {
      // Fall back to Google reviews only if no Pachu reviews exist
      showingGoogleReviews = true;
      const restaurantPhotos = googleData.photos 
        ? googleData.photos.slice(0, 3).map((photo: any) => 
            photo.photo_reference 
              ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`
              : null
          ).filter(Boolean)
        : [];

      reviewsToShow = (googleData.reviews || []).map((review: any, index: number) => ({
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
        photos: restaurantPhotos.length > 0 && index < restaurantPhotos.length 
          ? [restaurantPhotos[index]] 
          : [],
      }));
    }

    const response = {
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
      showingGoogleReviews,
      isWishlisted,
      userHasReviewed: user ? ourReviews.some(r => r.user.id === user.id) : false,
      friendsWhoReviewed,
    };

    console.log(`[Restaurant Google] Complete - ${Date.now() - startTime}ms`);
    
    return NextResponse.json(response);
  } catch (googleError) {
    console.error('Error fetching from Google:', googleError);
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
  }
}
