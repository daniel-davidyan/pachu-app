import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { profileCache, CACHE_TTL, ServerCache } from '@/lib/cache';

// =====================================================
// OPTIMIZED PROFILE API - TikTok Speed
// =====================================================
// Key optimizations:
// 1. Parallel queries with Promise.all()
// 2. Server-side caching (3 min TTL)
// =====================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { id } = await params;
    
    // Check if ID is a valid UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    if (!isUUID) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Check cache first
    const cacheKey = ServerCache.makeKey('profile', { id });
    const cached = profileCache.get<any>(cacheKey);
    if (cached) {
      console.log(`[Profile] Cache hit - ${Date.now() - startTime}ms`);
      return NextResponse.json(cached);
    }
    
    const supabase = await createClient();

    // PARALLEL: Get user and profile data simultaneously
    const [userResult, profileResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('profiles').select('*').eq('id', id).single()
    ]);

    const user = userResult.data?.user;
    const profile = profileResult.data;
    const profileError = profileResult.error;

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // PARALLEL: Fetch all profile-related data at once
    const [
      followersResult,
      followingResult,
      reviewsResult,
      isFollowingResult
    ] = await Promise.all([
      // Follower count
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id),
      
      // Following count
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
      
      // User's reviews with restaurant info
      supabase
        .from('reviews')
        .select(`
          id,
          rating,
          title,
          content,
          created_at,
          likes_count,
          restaurant_id,
          restaurants (
            id,
            name,
            address,
            image_url,
            average_rating,
            google_place_id
          )
        `)
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
      
      // Check if current user is following
      user && user.id !== id
        ? supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', id).single()
        : Promise.resolve({ data: null })
    ]);

    const followersCount = followersResult.count || 0;
    const followingCount = followingResult.count || 0;
    const reviewsData = reviewsResult.data || [];
    const isFollowing = !!isFollowingResult.data;
    const isOwnProfile = user?.id === id;

    // Get review IDs for photos and comments lookup
    const reviewIds = reviewsData.map((r: any) => r.id);

    // PARALLEL: Fetch photos and comments counts
    const [photosResult, commentsResult] = await Promise.all([
      reviewIds.length > 0
        ? supabase.from('review_photos').select('review_id, photo_url').in('review_id', reviewIds).order('sort_order', { ascending: true })
        : Promise.resolve({ data: [] }),
      
      reviewIds.length > 0
        ? supabase.from('review_comments').select('review_id').in('review_id', reviewIds)
        : Promise.resolve({ data: [] })
    ]);

    // Group photos by review
    const photosByReview = new Map<string, string[]>();
    (photosResult.data || []).forEach((photo: any) => {
      if (!photosByReview.has(photo.review_id)) {
        photosByReview.set(photo.review_id, []);
      }
      photosByReview.get(photo.review_id)?.push(photo.photo_url);
    });

    // Count comments per review
    const commentsCounts: Record<string, number> = {};
    (commentsResult.data || []).forEach((comment: any) => {
      commentsCounts[comment.review_id] = (commentsCounts[comment.review_id] || 0) + 1;
    });

    const reviews = reviewsData.map((review: any) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      content: review.content || '',
      createdAt: review.created_at,
      likesCount: review.likes_count || 0,
      commentsCount: commentsCounts[review.id] || 0,
      photos: photosByReview.get(review.id) || [],
      restaurant: review.restaurants ? {
        id: review.restaurants.id,
        name: review.restaurants.name,
        address: review.restaurants.address,
        imageUrl: review.restaurants.image_url,
        averageRating: review.restaurants.average_rating,
        googlePlaceId: review.restaurants.google_place_id,
      } : null,
    }));

    // Calculate average rating
    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    // Get mutual friends if logged in and not own profile
    let mutualFriends: any[] = [];
    if (user && !isOwnProfile) {
      // PARALLEL: Get current user's following and profile's followers
      const [currentUserFollowingResult, profileFollowersResult] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', user.id),
        supabase.from('follows').select('follower_id').eq('following_id', id)
      ]);

      const currentUserFollowingIds = (currentUserFollowingResult.data || []).map(f => f.following_id);
      const profileFollowerIds = (profileFollowersResult.data || []).map(f => f.follower_id);

      // Find mutual friends
      const mutualIds = currentUserFollowingIds.filter(fid => profileFollowerIds.includes(fid));

      if (mutualIds.length > 0) {
        const { data: mutualProfiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', mutualIds)
          .limit(10);

        mutualFriends = (mutualProfiles || []).map((p: any) => ({
          id: p.id,
          username: p.username,
          fullName: p.full_name || p.username,
          avatarUrl: p.avatar_url,
        }));
      }
    }

    // Get favorite cuisines
    const cuisineMap = new Map<string, number>();
    reviewsData.forEach((review: any) => {
      if (review.restaurants?.cuisine_types) {
        review.restaurants.cuisine_types.forEach((cuisine: string) => {
          cuisineMap.set(cuisine, (cuisineMap.get(cuisine) || 0) + 1);
        });
      }
    });
    const favoriteCuisines = Array.from(cuisineMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cuisine]) => cuisine);

    const response = {
      profile: {
        id: profile.id,
        username: profile.username,
        fullName: profile.full_name,
        avatarUrl: profile.avatar_url,
        bio: profile.bio,
        createdAt: profile.created_at,
      },
      stats: {
        followersCount,
        followingCount,
        reviewsCount: reviews.length,
        averageRating: parseFloat(averageRating.toFixed(1)),
      },
      isFollowing,
      isOwnProfile,
      reviews,
      mutualFriends,
      favoriteCuisines,
    };

    // Cache the result
    profileCache.set(cacheKey, response, CACHE_TTL.PROFILE);
    
    console.log(`[Profile] Complete - ${Date.now() - startTime}ms`);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
