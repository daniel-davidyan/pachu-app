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
    console.error('Google Places API key not configured');
    return NextResponse.json(
      { error: 'Search service not configured' },
      { status: 500 }
    );
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Use user location or default to Tel Aviv
    const lat = latitude ? parseFloat(latitude) : 32.0853;
    const lng = longitude ? parseFloat(longitude) : 34.7818;

    // Search Google Places API using Text Search
    // Note: We don't filter by type to include cafes, bars, bakeries, etc.
    const googleUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=50000&key=${apiKey}&language=he`;
    
    console.log(`🔍 Google Places Search: "${query}" near (${lat}, ${lng})`);
    
    const googleResponse = await fetch(googleUrl);
    const googleData = await googleResponse.json();

    if (googleData.status !== 'OK' && googleData.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', googleData.status, googleData.error_message);
      return NextResponse.json({ restaurants: [] });
    }

    const googleResults = googleData.results || [];
    console.log(`📍 Google Places returned ${googleResults.length} results`);

    // Transform Google Places results to match expected format
    const restaurants = googleResults.map((place: any) => {
      const photoRef = place.photos?.[0]?.photo_reference;
      
      return {
        googlePlaceId: place.place_id,
        name: place.name,
        address: place.formatted_address || place.vicinity || '',
        latitude: place.geometry?.location?.lat,
        longitude: place.geometry?.location?.lng,
        photoUrl: photoRef
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${apiKey}`
          : undefined,
        rating: place.rating || 0,
        priceLevel: place.price_level,
        types: place.types || [],
        source: 'google',
        visitedByFollowing: [],
      };
    });

    // Enrich with following data if user is logged in
    if (user && restaurants.length > 0) {
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
    const profile: any = profilesMap.get(review.user_id);
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
