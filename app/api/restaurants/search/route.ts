import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Tel Aviv bounds - same as in populate script
const TEL_AVIV_BOUNDS = {
  south: 32.035,
  north: 32.135,
  west: 34.740,
  east: 34.815,
};

function isInTelAviv(lat: number, lng: number): boolean {
  return (
    lat >= TEL_AVIV_BOUNDS.south &&
    lat <= TEL_AVIV_BOUNDS.north &&
    lng >= TEL_AVIV_BOUNDS.west &&
    lng <= TEL_AVIV_BOUNDS.east
  );
}

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

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // STEP 1: Try to find in local DB first (fast & free!)
    const searchTerm = `%${query}%`;
    const { data: localResults, error: localError } = await supabase
      .from('restaurant_cache')
      .select(`
        google_place_id,
        name,
        address,
        latitude,
        longitude,
        google_rating,
        google_reviews_count,
        price_level,
        categories,
        photos
      `)
      .or(`name.ilike.${searchTerm},summary.ilike.${searchTerm}`)
      .order('google_rating', { ascending: false, nullsFirst: false })
      .limit(15);

    if (!localError && localResults && localResults.length > 0) {
      console.log(`🔍 Search "${query}": Found ${localResults.length} in local DB`);
      
      // Transform local results to match expected format
      const restaurants = localResults.map((place: any) => {
        const photoRef = place.photos?.[0]?.photo_reference;
        return {
          googlePlaceId: place.google_place_id,
          name: place.name,
          address: place.address,
          latitude: place.latitude,
          longitude: place.longitude,
          photoUrl: photoRef && apiKey
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${apiKey}`
            : undefined,
          rating: place.google_rating || 0,
          priceLevel: place.price_level,
          cuisineTypes: place.categories || [],
          source: 'cache',
          visitedByFollowing: [],
        };
      });

      // Enrich with following data if user is logged in
      if (user) {
        await enrichWithFollowingData(supabase, user.id, restaurants);
      }

      return NextResponse.json({ restaurants });
    }

    // STEP 2: Fallback to Google Places API
    console.log(`🔍 Search "${query}": Not in local DB, falling back to Google`);
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'No results found and Google Places API key not configured' },
        { status: 500 }
      );
    }

    // Use Google Places Text Search API
    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' restaurant')}&key=${apiKey}`;
    
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
    const restaurants = await Promise.all(
      (data.results?.slice(0, 10) || []).map(async (place: any) => {
        const enrichedData: any = {
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
          source: 'google',
          visitedByFollowing: [],
        };

        // If no photo, try Place Details
        if (!enrichedData.photoUrl && place.place_id) {
          try {
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=photos,price_level,types&key=${apiKey}`;
            const detailsResponse = await fetch(detailsUrl);
            const detailsData = await detailsResponse.json();
            
            if (detailsData.status === 'OK' && detailsData.result) {
              const details = detailsData.result;
              if (details.photos?.[0]) {
                enrichedData.photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${details.photos[0].photo_reference}&key=${apiKey}`;
              }
              if (details.price_level) enrichedData.priceLevel = details.price_level;
            }
          } catch (e) {
            console.error('Error fetching place details:', e);
          }
        }

        return enrichedData;
      })
    );

    // Enrich with following data if user is logged in
    if (user) {
      await enrichWithFollowingData(supabase, user.id, restaurants);
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

// Helper function to add visitedByFollowing data
async function enrichWithFollowingData(supabase: any, userId: string, restaurants: any[]) {
  const placeIds = restaurants.map(r => r.googlePlaceId);
  
  const { data: followingData } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  
  const followingIds = followingData?.map((f: any) => f.following_id) || [];

  if (followingIds.length === 0 || placeIds.length === 0) return;

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

  const dbRestaurantIds = dbRestaurants?.map((r: any) => r.id) || [];
  if (dbRestaurantIds.length === 0) return;

  const { data: reviewsData } = await supabase
    .from('reviews')
    .select('restaurant_id, user_id')
    .in('restaurant_id', dbRestaurantIds)
    .in('user_id', followingIds);

  const userIds = [...new Set(reviewsData?.map((r: any) => r.user_id) || [])];

  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .in('id', userIds);

  const profilesMap = new Map(profilesData?.map((p: any) => [p.id, p]) || []);

  const reviewsByRestaurant = new Map<string, Map<string, any>>();
  reviewsData?.forEach((review: any) => {
    const restId = review.restaurant_id;
    if (!reviewsByRestaurant.has(restId)) {
      reviewsByRestaurant.set(restId, new Map());
    }
    const profile = profilesMap.get(review.user_id);
    if (profile && !reviewsByRestaurant.get(restId)?.has(review.user_id)) {
      reviewsByRestaurant.get(restId)?.set(review.user_id, {
        id: profile.id,
        username: profile.username,
        fullName: profile.full_name || profile.username,
        avatarUrl: profile.avatar_url,
      });
    }
  });

  restaurants.forEach((restaurant: any) => {
    const dbRestaurantId = restaurantIdMap.get(restaurant.googlePlaceId);
    if (dbRestaurantId && reviewsByRestaurant.has(dbRestaurantId)) {
      restaurant.visitedByFollowing = Array.from(reviewsByRestaurant.get(dbRestaurantId)!.values());
    }
  });
}
