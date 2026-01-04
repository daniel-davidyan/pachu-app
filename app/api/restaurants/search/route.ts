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

    // LOCAL DB ONLY MODE with FUZZY SEARCH
    const { data: localResults, error: localError } = await supabase.rpc(
      'search_restaurants_fuzzy',
      {
        search_query: query,
        max_results: 15
      }
    );

    if (localError) {
      console.error('Error searching local DB:', localError);
      return NextResponse.json({ restaurants: [] });
    }

    console.log(`🔍 Fuzzy Search "${query}": Found ${localResults?.length || 0} in local DB`);
    
    // Transform local results to match expected format
    const restaurants = (localResults || []).map((place: any) => {
      // photos is JSONB, need to parse if string
      let photos = place.photos;
      if (typeof photos === 'string') {
        try { photos = JSON.parse(photos); } catch { photos = []; }
      }
      const photoRef = photos?.[0]?.photo_reference;
      
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
        similarityScore: place.similarity_score, // Include fuzzy match score
      };
    });

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
