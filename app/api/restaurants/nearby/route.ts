import { NextRequest, NextResponse } from 'next/server';

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
    // Use Google Places Nearby Search API
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=restaurant&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', data);
      return NextResponse.json(
        { error: `Google Places API error: ${data.status}` },
        { status: 500 }
      );
    }

    // Transform Google Places data to our Restaurant format
    const restaurants = data.results?.map((place: any) => ({
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

    return NextResponse.json({ restaurants });
  } catch (error) {
    console.error('Error fetching nearby restaurants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nearby restaurants' },
      { status: 500 }
    );
  }
}

