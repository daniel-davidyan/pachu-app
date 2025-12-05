import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '0');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = page * limit;
    
    // Location parameters (optional)
    const latitude = searchParams.get('latitude');
    const longitude = searchParams.get('longitude');
    const radius = parseInt(searchParams.get('radius') || '10000'); // 10km default
    
    // Get current user (optional - for showing friends' reviews first)
    const { data: { user } } = await supabase.auth.getUser();
    
    let friendIds: string[] = [];
    if (user) {
      // Get user's friends
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      
      friendIds = follows?.map(f => f.following_id) || [];
      friendIds.push(user.id); // Include user's own reviews
    }

    // Build the query - get reviews with all necessary data
    let query = supabase
      .from('reviews')
      .select(`
        id,
        rating,
        content,
        created_at,
        likes_count,
        user_id,
        profiles!reviews_user_id_fkey (
          id,
          username,
          full_name,
          avatar_url
        ),
        restaurant:restaurants (
          id,
          name,
          address,
          location,
          image_url,
          average_rating,
          google_place_id
        ),
        review_photos (
          photo_url,
          sort_order
        ),
        review_likes!left (
          user_id
        )
      `)
      .order('created_at', { ascending: false });

    // If location is provided, filter by nearby restaurants
    if (latitude && longitude) {
      // First, get nearby restaurants
      const { data: nearbyRestaurants } = await supabase.rpc(
        'restaurants_nearby',
        {
          lat: parseFloat(latitude),
          lng: parseFloat(longitude),
          radius_meters: radius
        }
      );

      if (nearbyRestaurants && nearbyRestaurants.length > 0) {
        const restaurantIds = nearbyRestaurants.map((r: any) => r.id);
        query = query.in('restaurant_id', restaurantIds);
      } else {
        // No nearby restaurants, return empty
        return NextResponse.json({ 
          reviews: [], 
          hasMore: false,
          nextPage: page + 1 
        });
      }
    }

    // Apply pagination
    const { data: reviews, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching reviews:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reviews', details: error.message },
        { status: 500 }
      );
    }

    // Transform the data
    const transformedReviews = (reviews || []).map((review: any) => {
      const isOwnReview = user && review.user_id === user.id;
      const isFriendReview = friendIds.includes(review.user_id);
      const isLikedByUser = user && review.review_likes?.some((like: any) => like.user_id === user.id);

      return {
        id: review.id,
        rating: review.rating,
        content: review.content,
        createdAt: review.created_at,
        likesCount: review.likes_count,
        isLiked: isLikedByUser,
        user: {
          id: review.profiles?.id,
          username: review.profiles?.username,
          fullName: review.profiles?.full_name,
          avatarUrl: review.profiles?.avatar_url,
        },
        restaurant: {
          id: review.restaurant?.id,
          name: review.restaurant?.name,
          address: review.restaurant?.address,
          imageUrl: review.restaurant?.image_url,
          rating: review.restaurant?.average_rating,
          googlePlaceId: review.restaurant?.google_place_id,
        },
        photos: (review.review_photos || [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((photo: any) => photo.photo_url),
        source: isOwnReview ? 'own' : isFriendReview ? 'friend' : 'nearby',
      };
    });

    // Sort: friends' reviews first, then others
    transformedReviews.sort((a, b) => {
      const aWeight = a.source === 'friend' ? 2 : a.source === 'own' ? 3 : 1;
      const bWeight = b.source === 'friend' ? 2 : b.source === 'own' ? 3 : 1;
      return bWeight - aWeight;
    });

    const hasMore = reviews && reviews.length === limit;

    return NextResponse.json({
      reviews: transformedReviews,
      hasMore,
      nextPage: page + 1,
      total: count,
    });
  } catch (error) {
    console.error('Error in feed API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

