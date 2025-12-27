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

    // Transform Google Places data and enrich with Place Details
    const restaurants = await Promise.all(
      (data.results?.slice(0, 10) || []).map(async (place: any) => {
        let enrichedData: any = {
          googlePlaceId: place.place_id,
          name: place.name,
          address: place.formatted_address,
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          photoUrl: place.photos?.[0]
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photos[0].photo_reference}&key=${apiKey}`
            : undefined,
          rating: place.rating || 0,
          priceLevel: place.price_level,
          cuisineTypes: place.types?.filter((t: string) => 
            !['point_of_interest', 'establishment', 'food'].includes(t)
          ) || [],
        };

        // If no photo from Text Search, try to get from Place Details
        if (!enrichedData.photoUrl && place.place_id) {
          try {
            console.log(`📸 No photo for "${place.name}", trying Place Details API...`);
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,photos,formatted_phone_number,opening_hours,website,price_level,types&key=${apiKey}`;
            const detailsResponse = await fetch(detailsUrl);
            const detailsData = await detailsResponse.json();
            
            if (detailsData.status === 'OK' && detailsData.result) {
              const details = detailsData.result;
              
              // Get photo from details
              if (details.photos?.[0]) {
                enrichedData.photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${details.photos[0].photo_reference}&key=${apiKey}`;
                console.log(`✅ Found photo for "${place.name}" from Place Details`);
              } else {
                console.warn(`⚠️ Place Details for "${place.name}" has no photos`);
              }
              
              // Add additional details
              if (details.price_level) enrichedData.priceLevel = details.price_level;
              if (details.types) {
                enrichedData.cuisineTypes = details.types.filter((t: string) => 
                  !['point_of_interest', 'establishment', 'food'].includes(t)
                );
              }
            } else {
              console.warn(`⚠️ Place Details API returned status: ${detailsData.status} for "${place.name}"`);
            }
          } catch (detailsError) {
            console.error(`❌ Error fetching place details for "${place.name}":`, detailsError);
            // Continue without details if there's an error
          }
        }

        return enrichedData;
      })
    );

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
    console.error('Error searching restaurants:', error);
    return NextResponse.json(
      { error: 'Failed to search restaurants' },
      { status: 500 }
    );
  }
}

