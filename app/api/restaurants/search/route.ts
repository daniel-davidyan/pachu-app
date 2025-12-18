import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');
  const latitude = searchParams.get('latitude');
  const longitude = searchParams.get('longitude');

  if (!query) {
    return NextResponse.json(
      { error: 'Query is required' },
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

    // Use Google Places Text Search API
    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' restaurant')}&key=${apiKey}`;
    
    // Add location bias if available
    if (latitude && longitude) {
      url += `&location=${latitude},${longitude}&radius=5000`;
    }
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', data);
      return NextResponse.json(
        { error: `Google Places API error: ${data.status}` },
        { status: 500 }
      );
    }

    // Transform Google Places data
    const restaurants = data.results?.slice(0, 10).map((place: any) => ({
      googlePlaceId: place.place_id,
      name: place.name,
      address: place.formatted_address,
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      photoUrl: place.photos?.[0]
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photos[0].photo_reference}&key=${apiKey}`
        : undefined,
      rating: place.rating || 0,
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

      console.log('🔍 Search - User following count:', followingIds.length);

      if (followingIds.length > 0 && placeIds.length > 0) {
        // Get restaurants from our database that match the place IDs
        const { data: dbRestaurants } = await supabase
          .from('restaurants')
          .select('id, google_place_id')
          .in('google_place_id', placeIds);

        console.log('🔍 Search - DB restaurants found:', dbRestaurants?.length || 0);
        console.log('🔍 Search - Place IDs searched:', placeIds.length);

        const restaurantIdMap = new Map<string, string>();
        dbRestaurants?.forEach((r: any) => {
          if (r.google_place_id) {
            restaurantIdMap.set(r.google_place_id, r.id);
          }
        });

        const dbRestaurantIds = dbRestaurants?.map(r => r.id) || [];

        console.log('🔍 Search - DB restaurant IDs:', dbRestaurantIds.length);

        if (dbRestaurantIds.length > 0) {
          // Get reviews from following users for these restaurants
          const { data: reviewsData } = await supabase
            .from('reviews')
            .select(`
              restaurant_id,
              user_id,
              profiles!reviews_user_id_fkey (
                id,
                username,
                full_name,
                avatar_url
              )
            `)
            .in('restaurant_id', dbRestaurantIds)
            .in('user_id', followingIds);

          console.log('🔍 Search - Reviews from following:', reviewsData?.length || 0);

          // Group reviews by restaurant_id and deduplicate users
          const reviewsByRestaurant = new Map<string, Map<string, any>>();
          reviewsData?.forEach((review: any) => {
            const restId = review.restaurant_id;
            if (!reviewsByRestaurant.has(restId)) {
              reviewsByRestaurant.set(restId, new Map());
            }
            if (review.profiles) {
              const userId = review.profiles.id;
              // Only add each user once per restaurant
              if (!reviewsByRestaurant.get(restId)?.has(userId)) {
                reviewsByRestaurant.get(restId)?.set(userId, {
                  id: review.profiles.id,
                  username: review.profiles.username,
                  fullName: review.profiles.full_name || review.profiles.username,
                  avatarUrl: review.profiles.avatar_url,
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

          console.log('🔍 Search API - Restaurants with friends:', restaurants.filter((r: any) => r.visitedByFollowing?.length > 0).length);
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
    console.error('Error searching restaurants:', error);
    return NextResponse.json(
      { error: 'Failed to search restaurants' },
      { status: 500 }
    );
  }
}

