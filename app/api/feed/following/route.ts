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
        // Get all reviews for this restaurant
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select(`
            id,
            rating,
            content,
            created_at,
            users (
              id,
              username,
              full_name,
              avatar_url
            )
          `)
          .eq('restaurant_id', restaurant.id)
          .order('created_at', { ascending: false })
          .limit(10);

        const reviews = reviewsData?.map((review: any) => ({
          id: review.id,
          rating: review.rating,
          content: review.content || '',
          createdAt: review.created_at,
          user: {
            id: review.users?.id || '',
            username: review.users?.username || 'Unknown',
            fullName: review.users?.full_name || review.users?.username || 'Unknown',
            avatarUrl: review.users?.avatar_url,
          },
          photos: [],
        })) || [];

        // Get mutual friends (people I follow who reviewed this restaurant)
        const { data: mutualFriendsData } = await supabase
          .from('reviews')
          .select(`
            user_id,
            users (
              id,
              username,
              full_name,
              avatar_url
            )
          `)
          .eq('restaurant_id', restaurant.id)
          .in('user_id', followingIds);

        // Remove duplicates
        const uniqueFriends = new Map();
        mutualFriendsData?.forEach((item: any) => {
          if (item.users && !uniqueFriends.has(item.users.id)) {
            uniqueFriends.set(item.users.id, {
              id: item.users.id,
              name: item.users.full_name || item.users.username,
              avatarUrl: item.users.avatar_url,
            });
          }
        });
        const mutualFriends = Array.from(uniqueFriends.values());

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
