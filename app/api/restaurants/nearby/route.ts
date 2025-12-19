import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const latitude = searchParams.get('latitude');
  const longitude = searchParams.get('longitude');
  const radius = searchParams.get('radius') || '2000'; // 2km default

  if (!latitude || !longitude) {
    return NextResponse.json(
      { error: 'Latitude and longitude are required' },
      { status: 400 }
    );
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Places API key not configured' },
      { status: 500 }
    );
  }

  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    // Use Google Places Nearby Search API - Restaurant only
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=restaurant&keyword=restaurant&key=${apiKey}`;
    
    console.log('🔍 Calling Google Places API (restaurants only):', { latitude, longitude, radius });
    
    const response = await fetch(url);
    const data = await response.json();

    console.log('📊 Google Places API status:', data.status);
    console.log('📊 Google Places API results count:', data.results?.length || 0);

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('❌ Google Places API error:', data);
      console.error('Error message:', data.error_message);
      return NextResponse.json(
        { error: `Google Places API error: ${data.status} - ${data.error_message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Transform Google Places data to our Restaurant format (filter out non-restaurants)
    const restaurants = data.results?.filter((place: any) => {
      // Only include places that are clearly restaurants
      const types = place.types || [];
      return types.includes('restaurant') || types.includes('food');
    }).map((place: any) => ({
      id: place.place_id,
      name: place.name,
      address: place.vicinity,
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      rating: place.rating || 0,
      totalReviews: place.user_ratings_total || 0,
      photoUrl: place.photos?.[0]
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photos[0].photo_reference}&key=${apiKey}`
        : undefined,
      priceLevel: place.price_level,
      cuisineTypes: place.types?.filter((t: string) => 
        !['restaurant', 'food', 'point_of_interest', 'establishment'].includes(t)
      ),
      source: 'google',
      googlePlaceId: place.place_id
    })) || [];

    // If user is logged in, get following users who visited these restaurants
    if (user) {
      const placeIds = restaurants.map((r: any) => r.googlePlaceId);
      
      // Get list of users the current user is following
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      
      const followingIds = followingData?.map(f => f.following_id) || [];

      if (followingIds.length > 0 && placeIds.length > 0) {
        // Get restaurants from our database that match the place IDs
        const { data: dbRestaurants } = await supabase
          .from('restaurants')
          .select('id, google_place_id')
          .in('google_place_id', placeIds);

        const restaurantIdMap = new Map<string, string>();
        dbRestaurants?.forEach((r: any) => {
          if (r.google_place_id) {
            restaurantIdMap.set(r.google_place_id, r.id);
          }
        });

        const dbRestaurantIds = dbRestaurants?.map(r => r.id) || [];

        if (dbRestaurantIds.length > 0) {
          // Get reviews from following users for these restaurants
          const { data: reviewsData, error: reviewsError } = await supabase
            .from('reviews')
            .select('restaurant_id, user_id')
            .in('restaurant_id', dbRestaurantIds)
            .in('user_id', followingIds);

          if (reviewsError) {
            console.error('Error fetching reviews:', reviewsError);
          }

          // Get unique user IDs from reviews
          const userIds = [...new Set(reviewsData?.map(r => r.user_id) || [])];

          // Get profiles for these users
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .in('id', userIds);

          // Create a map of user_id to profile
          const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

          // Group reviews by restaurant_id and deduplicate users
          const reviewsByRestaurant = new Map<string, Map<string, any>>();
          reviewsData?.forEach((review: any) => {
            const restId = review.restaurant_id;
            if (!reviewsByRestaurant.has(restId)) {
              reviewsByRestaurant.set(restId, new Map());
            }
            const userId = review.user_id;
            const profile = profilesMap.get(userId);
            if (profile) {
              // Only add each user once per restaurant
              if (!reviewsByRestaurant.get(restId)?.has(userId)) {
                reviewsByRestaurant.get(restId)?.set(userId, {
                  id: profile.id,
                  username: profile.username,
                  fullName: profile.full_name || profile.username,
                  avatarUrl: profile.avatar_url,
                });
              }
            }
          });

          // Add visitedByFollowing to each restaurant
          restaurants.forEach((restaurant: any) => {
            const dbRestaurantId = restaurantIdMap.get(restaurant.googlePlaceId);
            if (dbRestaurantId && reviewsByRestaurant.has(dbRestaurantId)) {
              restaurant.visitedByFollowing = Array.from(reviewsByRestaurant.get(dbRestaurantId)!.values());
            } else {
              restaurant.visitedByFollowing = [];
            }
          });
        } else {
          // No restaurants in DB, set empty arrays
          restaurants.forEach((restaurant: any) => {
            restaurant.visitedByFollowing = [];
          });
        }
      } else {
        // No following users or no places, set empty arrays
        restaurants.forEach((restaurant: any) => {
          restaurant.visitedByFollowing = [];
        });
      }
    } else {
      // User not logged in, set empty arrays
      restaurants.forEach((restaurant: any) => {
        restaurant.visitedByFollowing = [];
      });
    }

    return NextResponse.json({ restaurants });
  } catch (error) {
    console.error('Error fetching nearby restaurants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nearby restaurants' },
      { status: 500 }
    );
  }
}

