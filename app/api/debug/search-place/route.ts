import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/debug/search-place?query=cafe+meyer+tel+aviv
 * 
 * Debug endpoint to search Google Places and see what types a place has
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query');
  
  if (!query) {
    return NextResponse.json({ error: 'query parameter required' }, { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    // Text Search to find the place
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchData.results || searchData.results.length === 0) {
      return NextResponse.json({ error: 'Place not found', status: searchData.status });
    }

    const place = searchData.results[0];
    
    // Get full details
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,types,formatted_address,geometry,rating,user_ratings_total,price_level,business_status&key=${apiKey}`;
    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();

    const details = detailsData.result || place;

    return NextResponse.json({
      name: details.name,
      place_id: place.place_id,
      types: details.types || place.types,
      address: details.formatted_address || place.formatted_address,
      location: details.geometry?.location || place.geometry?.location,
      rating: details.rating,
      reviews_count: details.user_ratings_total,
      business_status: details.business_status,
      // Check if it matches our PLACE_TYPES
      matches_our_types: (details.types || place.types || []).some((t: string) => 
        ['restaurant', 'cafe', 'bar', 'bakery', 'meal_delivery', 'meal_takeaway'].includes(t)
      ),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
