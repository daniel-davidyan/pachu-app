import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's friends (people they follow)
    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);

    const friendIds = follows?.map(f => f.following_id) || [];
    
    // Include user's own reviews
    friendIds.push(user.id);

    if (friendIds.length === 0) {
      return NextResponse.json({ restaurants: [] });
    }

    // Get restaurants with reviews from friends (including self)
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        user_id,
        restaurant:restaurants (
          id,
          name,
          address,
          location,
          google_place_id,
          average_rating,
          total_reviews,
          image_url,
          price_level,
          cuisine_types
        ),
        review_photos (
          photo_url
        )
      `)
      .in('user_id', friendIds)
      .order('created_at', { ascending: false });

    if (reviewsError) {
      console.error('Error fetching reviews:', reviewsError);
      return NextResponse.json(
        { error: 'Failed to fetch reviews' },
        { status: 500 }
      );
    }

    // Group reviews by restaurant and transform to our format
    const restaurantMap = new Map();
    
    reviews?.forEach((review: any) => {
      if (!review.restaurant || !review.restaurant.location) return;
      
      const restaurantId = review.restaurant.id;
      const isOwnReview = review.user_id === user.id;
      
      if (!restaurantMap.has(restaurantId)) {
        // Parse PostGIS point format
        // Format is like: "0101000020E6100000..." or POINT(lng lat)
        let longitude = 0;
        let latitude = 0;
        
        try {
          // This is a simplified parser - you might need to adjust based on actual format
          const locationStr = review.restaurant.location;
          if (typeof locationStr === 'string' && locationStr.includes('POINT')) {
            const match = locationStr.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
            if (match) {
              longitude = parseFloat(match[1]);
              latitude = parseFloat(match[2]);
            }
          }
        } catch (e) {
          console.error('Error parsing location:', e);
        }

        restaurantMap.set(restaurantId, {
          id: restaurantId,
          name: review.restaurant.name,
          address: review.restaurant.address,
          latitude,
          longitude,
          rating: review.restaurant.average_rating || 0,
          totalReviews: review.restaurant.total_reviews || 0,
          photoUrl: review.review_photos?.[0]?.photo_url || review.restaurant.image_url,
          priceLevel: review.restaurant.price_level,
          cuisineTypes: review.restaurant.cuisine_types,
          source: isOwnReview ? 'own' : 'friends',
          googlePlaceId: review.restaurant.google_place_id
        });
      }
    });

    const restaurants = Array.from(restaurantMap.values());

    return NextResponse.json({ restaurants });
  } catch (error) {
    console.error('Error in friends-reviews API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

