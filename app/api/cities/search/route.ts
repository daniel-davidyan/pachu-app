import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query) {
      return NextResponse.json({ cities: [] });
    }

    // Use Google Places API to search for cities
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=(cities)&key=${apiKey}`
    );

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', data);
      return NextResponse.json({ cities: [] });
    }

    // Get place details for each city to get coordinates
    const cities = await Promise.all(
      (data.predictions || []).slice(0, 10).map(async (prediction: any) => {
        try {
          const detailsResponse = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry,address_components&key=${apiKey}`
          );
          const detailsData = await detailsResponse.json();

          if (detailsData.status === 'OK' && detailsData.result) {
            const countryComponent = detailsData.result.address_components?.find(
              (component: any) => component.types.includes('country')
            );

            return {
              id: prediction.place_id,
              name: prediction.structured_formatting.main_text,
              country: countryComponent?.long_name,
              latitude: detailsData.result.geometry.location.lat,
              longitude: detailsData.result.geometry.location.lng,
            };
          }
          return null;
        } catch (error) {
          console.error('Error fetching place details:', error);
          return null;
        }
      })
    );

    const validCities = cities.filter((city) => city !== null);

    return NextResponse.json({ cities: validCities });
  } catch (error) {
    console.error('City search error:', error);
    return NextResponse.json({ error: 'Failed to search cities', cities: [] }, { status: 500 });
  }
}

