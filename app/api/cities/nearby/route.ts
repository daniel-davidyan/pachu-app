import { NextResponse } from 'next/server';

// Calculate distance between two coordinates in km
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const latitude = parseFloat(searchParams.get('latitude') || '0');
    const longitude = parseFloat(searchParams.get('longitude') || '0');

    if (!latitude || !longitude) {
      return NextResponse.json({ cities: [] });
    }

    // Use Google Places API to find nearby cities
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=100000&type=locality&key=${apiKey}`
    );

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', data);
      return NextResponse.json({ cities: [] });
    }

    // Map results to city format with distance
    const cities = (data.results || []).slice(0, 10).map((place: any) => {
      const distance = calculateDistance(
        latitude,
        longitude,
        place.geometry.location.lat,
        place.geometry.location.lng
      );

      return {
        id: place.place_id,
        name: place.name,
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        distance: Math.round(distance * 10) / 10, // Round to 1 decimal
      };
    });

    // Sort by distance
    cities.sort((a: any, b: any) => a.distance - b.distance);

    return NextResponse.json({ cities });
  } catch (error) {
    console.error('Nearby cities error:', error);
    return NextResponse.json({ error: 'Failed to fetch nearby cities', cities: [] }, { status: 500 });
  }
}

