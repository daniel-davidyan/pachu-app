import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get('page') || '0');
    const limit = parseInt(searchParams.get('limit') || '5');
    const latitude = parseFloat(searchParams.get('latitude') || '0');
    const longitude = parseFloat(searchParams.get('longitude') || '0');

    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's following list
    const { data: followingData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);

    const followingIds = followingData?.map(f => f.following_id) || [];
    
    if (followingIds.length === 0) {
      return NextResponse.json({ 
        restaurants: [],
        hasMore: false 
      });
    }

    // Get all reviews from people I follow
    const { data: allReviews } = await supabase
      .from('reviews')
      .select('restaurant_id, restaurants(*)')
      .in('user_id', followingIds)
      .eq('is_published', true) // Only show published reviews in feed
      .order('created_at', { ascending: false });

    // Group by restaurant to get unique restaurants
    const restaurantMap = new Map();
    allReviews?.forEach((review: any) => {
      if (review.restaurants && !restaurantMap.has(review.restaurants.id)) {
        restaurantMap.set(review.restaurants.id, review.restaurants);
      }
    });

    // Get paginated restaurants
    const allRestaurants = Array.from(restaurantMap.values());
    const paginatedRestaurants = allRestaurants.slice(page * limit, (page + 1) * limit);

    // Build restaurant data with reviews and mutual friends
    const restaurants = await Promise.all(
      paginatedRestaurants.map(async (restaurant: any) => {
        // Get all reviews for this restaurant from people I follow
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select(`
            id,
            rating,
            content,
            created_at,
            user_id
          `)
          .eq('restaurant_id', restaurant.id)
          .in('user_id', followingIds)
          .eq('is_published', true) // Only show published reviews in feed
          .order('created_at', { ascending: false })
          .limit(10);

        // Get user profiles separately
        const userIds = reviewsData?.map(r => r.user_id) || [];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', userIds);

        // Map profiles to reviews
        const profilesMap = new Map();
        profilesData?.forEach((profile: any) => {
          profilesMap.set(profile.id, profile);
        });

        // Get photos for these reviews
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

        // Get likes counts for reviews
        const { data: likesData } = await supabase
          .from('review_likes')
          .select('review_id')
          .in('review_id', reviewIds);

        const likesCounts: { [key: string]: number } = {};
        likesData?.forEach(like => {
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
          userLikes = userLikesData?.map(l => l.review_id) || [];
        }

        // Get comments counts for reviews
        const { data: commentsData } = await supabase
          .from('review_comments')
          .select('review_id')
          .in('review_id', reviewIds);

        const commentsCounts: { [key: string]: number } = {};
        commentsData?.forEach(comment => {
          commentsCounts[comment.review_id] = (commentsCounts[comment.review_id] || 0) + 1;
        });

        const reviews = reviewsData?.map((review: any) => {
          const profile = profilesMap.get(review.user_id);
          return {
            id: review.id,
            rating: review.rating,
            content: review.content || '',
            createdAt: review.created_at,
            likesCount: likesCounts[review.id] || 0,
            commentsCount: commentsCounts[review.id] || 0,
            isLiked: userLikes.includes(review.id),
            user: {
              id: review.user_id,
              username: profile?.username || 'Unknown',
              fullName: profile?.full_name || profile?.username || 'Unknown',
              avatarUrl: profile?.avatar_url,
            },
            photos: photosByReview.get(review.id) || [],
          };
        }) || [];

        // Get mutual friends (people I follow who reviewed this restaurant)
        const { data: mutualFriendsData } = await supabase
          .from('reviews')
          .select('user_id')
          .eq('restaurant_id', restaurant.id)
          .in('user_id', followingIds);

        // Get unique friend IDs
        const friendIds = [...new Set(mutualFriendsData?.map(r => r.user_id) || [])];
        
        // Get their profiles
        const { data: friendProfiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', friendIds);

        const mutualFriends = friendProfiles?.map((profile: any) => ({
          id: profile.id,
          name: profile.full_name || profile.username,
          avatarUrl: profile.avatar_url,
        })) || [];

        // For now, we'll skip distance calculation
        // PostGIS location field needs proper extraction which we'll add later
        const distance = undefined;
        const restaurantLat = 32.0853; // Default Tel Aviv center
        const restaurantLng = 34.7818;

        return {
          id: restaurant.id,
          name: restaurant.name,
          address: restaurant.address,
          imageUrl: restaurant.image_url,
          rating: restaurant.average_rating || 0,
          totalReviews: reviews.length,
          distance,
          matchPercentage: Math.floor(Math.random() * 30 + 70), // 70-100%
          mutualFriends,
          reviews,
          googlePlaceId: restaurant.google_place_id,
          latitude: restaurantLat,
          longitude: restaurantLng,
        };
      })
    );

    return NextResponse.json({
      restaurants,
      hasMore: allRestaurants.length > (page + 1) * limit,
    });
  } catch (error) {
    console.error('Error in following feed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
