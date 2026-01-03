import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/restaurants/cache/search
 * 
 * Search restaurants from the local cache (restaurant_cache table).
 * Fast and free - no external API calls!
 * 
 * Query params:
 * - query: search term (required)
 * - limit: max results (default 10)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');
  const limit = parseInt(searchParams.get('limit') || '10');

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: 'Query must be at least 2 characters' },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();
    const searchTerm = `%${query}%`;

    // Search by name (case-insensitive) using ILIKE
    // Also search in summary and categories for better results
    const { data: restaurants, error } = await supabase
      .from('restaurant_cache')
      .select(`
        google_place_id,
        name,
        address,
        google_rating,
        price_level,
        categories,
        photos,
        latitude,
        longitude
      `)
      .or(`name.ilike.${searchTerm},summary.ilike.${searchTerm}`)
      .order('google_rating', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) {
      console.error('Error searching restaurants:', error);
      return NextResponse.json(
        { error: 'Failed to search restaurants' },
        { status: 500 }
      );
    }

    // Transform to match the expected format
    const results = (restaurants || []).map((r: any) => {
      // Build photo URL from photo reference
      const photoRef = r.photos?.[0]?.photo_reference;
      const photoUrl = photoRef 
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`
        : null;

      return {
        place_id: r.google_place_id,
        name: r.name,
        address: r.address,
        rating: r.google_rating,
        price_level: r.price_level,
        categories: r.categories || [],
        photoUrl,
        latitude: r.latitude,
        longitude: r.longitude,
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error searching restaurants:', error);
    return NextResponse.json(
      { error: 'Failed to search restaurants' },
      { status: 500 }
    );
  }
}
