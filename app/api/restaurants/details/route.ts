import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const placeId = searchParams.get('placeId');

  if (!placeId) {
    return NextResponse.json(
      { error: 'Place ID is required' },
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
    // Use Google Places Details API to get full restaurant information
    const fields = [
      'name',
      'formatted_address',
      'address_components',
      'geometry',
      'formatted_phone_number',
      'website',
      'price_level',
      'rating',
      'user_ratings_total',
      'reviews',
      'photos',
      'types',
      'editorial_summary',
      'opening_hours',
      'current_opening_hours'
    ].join(',');
    
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;
    
    console.log('🔍 Fetching Google Place details for:', placeId);
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('❌ Google Places API error:', data);
      return NextResponse.json(
        { error: `Google Places API error: ${data.status}` },
        { status: 500 }
      );
    }

    const result = data.result || {};
    
    // Extract country and city from address_components
    let country = '';
    let city = '';
    
    if (result.address_components) {
      for (const component of result.address_components) {
        if (component.types.includes('country')) {
          country = component.long_name;
        }
        if (component.types.includes('locality')) {
          city = component.long_name;
        }
      }
    }

    // Return the complete place details with parsed country and city
    return NextResponse.json({
      ...result,
      country,
      city,
    });
  } catch (error) {
    console.error('Error fetching place details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch place details' },
      { status: 500 }
    );
  }
}

