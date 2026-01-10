import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
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
    // Include latitude/longitude directly from restaurants table
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
          google_place_id,
          average_rating,
          total_reviews,
          image_url,
          price_level,
          cuisine_types,
          latitude,
          longitude
        ),
        review_photos (
          photo_url
        )
      `)
      .in('user_id', friendIds)
      .eq('is_published', true) // Only show published reviews
      .order('created_at', { ascending: false });
    
    // Build location map from restaurant data (now includes latitude/longitude from DB)
    // with fallbacks for restaurants that don't have coordinates yet
    let locationMap = new Map<string, { latitude: number; longitude: number }>();
    const restaurantsWithoutCoords: string[] = [];
    
    // First pass: get coordinates directly from restaurant data
    reviews?.forEach((review: any) => {
      if (review.restaurant?.id && review.restaurant.latitude && review.restaurant.longitude) {
        locationMap.set(review.restaurant.id, {
          latitude: review.restaurant.latitude,
          longitude: review.restaurant.longitude,
        });
      } else if (review.restaurant?.id) {
        restaurantsWithoutCoords.push(review.restaurant.id);
      }
    });
    
    // Fallback for restaurants without direct lat/lng columns
    if (restaurantsWithoutCoords.length > 0) {
      try {
        // Try using the RPC function (extracts coordinates from PostGIS location field)
        const { data: locationData, error: rpcError } = await supabase
          .rpc('get_restaurant_coordinates', { restaurant_ids: restaurantsWithoutCoords });
        
        if (!rpcError && locationData) {
          locationData.forEach((loc: any) => {
            if (loc.latitude && loc.longitude) {
              locationMap.set(loc.id, { latitude: loc.latitude, longitude: loc.longitude });
            }
          });
        }
      } catch (e) {
        console.log('RPC fallback not available, trying restaurant_cache');
      }
      
      // Final fallback: Try restaurant_cache table
      const stillMissingIds = restaurantsWithoutCoords.filter(id => !locationMap.has(id));
      if (stillMissingIds.length > 0) {
        const reviewsWithMissingCoords = reviews?.filter((r: any) => 
          stillMissingIds.includes(r.restaurant?.id) && r.restaurant?.google_place_id
        );
        const googlePlaceIds = [...new Set(reviewsWithMissingCoords?.map((r: any) => r.restaurant.google_place_id) || [])];
        
        if (googlePlaceIds.length > 0) {
          const { data: cacheData } = await supabase
            .from('restaurant_cache')
            .select('google_place_id, latitude, longitude')
            .in('google_place_id', googlePlaceIds);
          
          // Build a mapping from google_place_id to coordinates
          const coordsByPlaceId = new Map<string, { latitude: number; longitude: number }>();
          cacheData?.forEach((cache: any) => {
            if (cache.latitude && cache.longitude) {
              coordsByPlaceId.set(cache.google_place_id, {
                latitude: cache.latitude,
                longitude: cache.longitude,
              });
            }
          });
          
          // Map back to restaurant IDs
          reviewsWithMissingCoords?.forEach((review: any) => {
            if (review.restaurant?.id && review.restaurant?.google_place_id) {
              const coords = coordsByPlaceId.get(review.restaurant.google_place_id);
              if (coords) {
                locationMap.set(review.restaurant.id, coords);
              }
            }
          });
        }
      }
    }

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
      if (!review.restaurant) return;
      
      const restaurantId = review.restaurant.id;
      const isOwnReview = review.user_id === user.id;
      
      // Get coordinates from locationMap (fetched via PostGIS functions)
      const coords = locationMap.get(restaurantId);
      const latitude = coords?.latitude || 0;
      const longitude = coords?.longitude || 0;
      
      // Skip restaurants without valid coordinates
      if (latitude === 0 && longitude === 0) return;
      
      if (!restaurantMap.has(restaurantId)) {
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

