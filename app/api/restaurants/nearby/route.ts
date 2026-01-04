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

// Cache for Google Places results (5 minute TTL)
const placesCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  const radiusNum = parseInt(radius);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Check if we're in Tel Aviv - use local DB!
    if (isInTelAviv(lat, lng)) {
      console.log(`📍 Location (${lat.toFixed(4)}, ${lng.toFixed(4)}) is in Tel Aviv - using local DB`);
      
      const restaurants = await fetchFromLocalDB(supabase, lat, lng, radiusNum, apiKey);
      
      if (restaurants.length > 0) {
        // Enrich with following data if user is logged in
        if (user) {
          await enrichWithFollowingData(supabase, user.id, restaurants);
        }
        
        console.log(`✅ Found ${restaurants.length} restaurants from local DB`);
        return NextResponse.json({ restaurants, source: 'local' });
      }
      
      console.log(`⚠️ No local results, falling back to Google`);
    }

    // Not in Tel Aviv or no local results - use Google Places API
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Places API key not configured' },
        { status: 500 }
      );
    }

    console.log(`🌐 Location (${lat.toFixed(4)}, ${lng.toFixed(4)}) - using Google Places API`);
    const restaurants = await fetchFromGoogle(apiKey, lat, lng, radiusNum);
    
    // Enrich with following data if user is logged in
    if (user) {
      await enrichWithFollowingData(supabase, user.id, restaurants);
    }

    return NextResponse.json({ restaurants, source: 'google' });
  } catch (error) {
    console.error('Error fetching nearby restaurants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nearby restaurants' },
      { status: 500 }
    );
  }
}

// Fetch from local restaurant_cache table
async function fetchFromLocalDB(supabase: any, lat: number, lng: number, radiusMeters: number, apiKey: string | undefined) {
  // Convert radius to degrees (approximate)
  const radiusDegrees = radiusMeters / 111000;
  
  const { data: localResults, error } = await supabase
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
      summary,
      photos
    `)
    .gte('latitude', lat - radiusDegrees)
    .lte('latitude', lat + radiusDegrees)
    .gte('longitude', lng - radiusDegrees)
    .lte('longitude', lng + radiusDegrees)
    .order('google_rating', { ascending: false, nullsFirst: false })
    .limit(50);

  if (error) {
    console.error('Error fetching from local DB:', error);
    return [];
  }

  // Transform to Restaurant format
  return (localResults || []).map((place: any) => {
    const rating = place.google_rating || 0;
    const totalReviews = place.google_reviews_count || 0;
    
    // Calculate match percentage
    const ratingScore = (rating / 5) * 70;
    const reviewScore = Math.min(Math.log(totalReviews + 1) * 3, 30);
    const matchPercentage = Math.max(0, Math.min(100, Math.round(ratingScore + reviewScore)));

    const photoRef = place.photos?.[0]?.photo_reference;
    
    return {
      id: place.google_place_id,
      name: place.name,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      rating,
      totalReviews,
      photoUrl: photoRef && apiKey
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${apiKey}`
        : undefined,
      priceLevel: place.price_level,
      cuisineTypes: place.categories || [],
      source: 'cache',
      googlePlaceId: place.google_place_id,
      matchPercentage,
      visitedByFollowing: [],
    };
  });
}

// Fetch from Google Places API
async function fetchFromGoogle(apiKey: string, lat: number, lng: number, radiusMeters: number) {
  const fetchPlacesByType = async (type: string) => {
    const cacheKey = `${lat},${lng},${radiusMeters},${type}`;
    
    const cached = placesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&type=${type}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return [];
    }

    let allResults = data.results || [];
    let nextPageToken = data.next_page_token;

    let pageCount = 1;
    while (nextPageToken && pageCount < 3) {
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      const nextUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${nextPageToken}&key=${apiKey}`;
      const nextResponse = await fetch(nextUrl);
      const nextData = await nextResponse.json();
      
      if (nextData.status === 'OK' && nextData.results) {
        allResults = [...allResults, ...nextData.results];
        nextPageToken = nextData.next_page_token;
      } else {
        break;
      }
      pageCount++;
    }

    placesCache.set(cacheKey, { data: allResults, timestamp: Date.now() });
    
    if (placesCache.size > 100) {
      const oldestKey = Array.from(placesCache.keys())[0];
      placesCache.delete(oldestKey);
    }

    return allResults;
  };

  const types = ['restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway', 'meal_delivery', 'food'];
  const resultsArrays = await Promise.all(types.map(type => fetchPlacesByType(type)));

  const foodRelatedTypes = [
    'restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway', 'meal_delivery', 
    'night_club', 'food', 'liquor_store'
  ];
  
  const excludedTypes = [
    'lodging', 'hotel', 'motel', 'campground', 'rv_park', 'guest_house',
    'moving_company', 'parking', 'car_rental', 'car_repair', 'car_dealer',
    'car_wash', 'gas_station', 'school', 'primary_school', 'secondary_school',
    'university', 'library', 'hospital', 'doctor', 'dentist', 'pharmacy',
  ];
  
  const allResultsMap = new Map();
  resultsArrays.forEach(results => {
    results.forEach((place: any) => {
      const isExcludedType = place.types?.some((type: string) => excludedTypes.includes(type));
      if (isExcludedType) return;
      
      const hasFoodType = place.types?.some((type: string) => foodRelatedTypes.includes(type));
      if (hasFoodType && !allResultsMap.has(place.place_id)) {
        allResultsMap.set(place.place_id, place);
      }
    });
  });

  const allResults = Array.from(allResultsMap.values());

  return allResults.map((place: any) => {
    const rating = place.rating || 0;
    const totalReviews = place.user_ratings_total || 0;
    
    const ratingScore = (rating / 5) * 70;
    const reviewScore = Math.min(Math.log(totalReviews + 1) * 3, 30);
    const matchPercentage = Math.max(0, Math.min(100, Math.round(ratingScore + reviewScore)));
    
    return {
      id: place.place_id,
      name: place.name,
      address: place.vicinity,
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      rating,
      totalReviews,
      photoUrl: place.photos?.[0]
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photos[0].photo_reference}&key=${apiKey}`
        : undefined,
      priceLevel: place.price_level,
      cuisineTypes: place.types?.filter((t: string) => 
        !['restaurant', 'food', 'point_of_interest', 'establishment'].includes(t)
      ),
      source: 'google',
      googlePlaceId: place.place_id,
      matchPercentage,
      visitedByFollowing: [],
    };
  });
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
