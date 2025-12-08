import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if ID is a valid UUID - profiles only exist in database
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    if (!isUUID) {
      // Not a valid UUID, can't be a real user profile
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if current user is following this profile
    let isFollowing = false;
    let isOwnProfile = false;
    if (user) {
      isOwnProfile = user.id === id;
      
      if (!isOwnProfile) {
        const { data: followData } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', id)
          .single();
        
        isFollowing = !!followData;
      }
    }

    // Get follower count
    const { count: followersCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', id);

    // Get following count
    const { count: followingCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', id);

    // Get user's reviews with restaurant info
    const { data: reviewsData } = await supabase
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
          average_rating
        )
      `)
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

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

    const reviews = reviewsData?.map((review: any) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      content: review.content || '',
      createdAt: review.created_at,
      likesCount: review.likes_count || 0,
      photos: photosByReview.get(review.id) || [],
      restaurant: review.restaurants ? {
        id: review.restaurants.id,
        name: review.restaurants.name,
        address: review.restaurants.address,
        imageUrl: review.restaurants.image_url,
        averageRating: review.restaurants.average_rating,
      } : null,
    })) || [];

    // Calculate average rating from user's reviews
    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    // Get mutual friends if logged in and not own profile
    let mutualFriends: any[] = [];
    if (user && !isOwnProfile) {
      // Get current user's following list
      const { data: currentUserFollowing } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const currentUserFollowingIds = currentUserFollowing?.map(f => f.following_id) || [];

      // Get profile's followers
      const { data: profileFollowers } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', id);

      const profileFollowerIds = profileFollowers?.map(f => f.follower_id) || [];

      // Find mutual friends (people current user follows who also follow this profile)
      const mutualIds = currentUserFollowingIds.filter(fid => profileFollowerIds.includes(fid));

      if (mutualIds.length > 0) {
        const { data: mutualProfiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', mutualIds)
          .limit(10);

        mutualFriends = mutualProfiles?.map((p: any) => ({
          id: p.id,
          username: p.username,
          fullName: p.full_name || p.username,
          avatarUrl: p.avatar_url,
        })) || [];
      }
    }

    // Get favorite cuisines (most reviewed cuisine types)
    const cuisineMap = new Map<string, number>();
    reviewsData?.forEach((review: any) => {
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

    return NextResponse.json({
      profile: {
        id: profile.id,
        username: profile.username,
        fullName: profile.full_name,
        avatarUrl: profile.avatar_url,
        bio: profile.bio,
        createdAt: profile.created_at,
      },
      stats: {
        followersCount: followersCount || 0,
        followingCount: followingCount || 0,
        reviewsCount: reviews.length,
        averageRating: parseFloat(averageRating.toFixed(1)),
      },
      isFollowing,
      isOwnProfile,
      reviews,
      mutualFriends,
      favoriteCuisines,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

