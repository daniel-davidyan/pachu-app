import { NextResponse } from 'next/server';

// Popular cities around the world with coordinates
const POPULAR_CITIES = [
  // Israel
  { id: 'tel-aviv', name: 'Tel Aviv', country: 'Israel', latitude: 32.0853, longitude: 34.7818 },
  { id: 'jerusalem', name: 'Jerusalem', country: 'Israel', latitude: 31.7683, longitude: 35.2137 },
  { id: 'haifa', name: 'Haifa', country: 'Israel', latitude: 32.7940, longitude: 34.9896 },
  { id: 'beer-sheva', name: 'Beer Sheva', country: 'Israel', latitude: 31.2518, longitude: 34.7913 },
  { id: 'eilat', name: 'Eilat', country: 'Israel', latitude: 29.5581, longitude: 34.9482 },
  { id: 'netanya', name: 'Netanya', country: 'Israel', latitude: 32.3336, longitude: 34.8504 },
  { id: 'herzliya', name: 'Herzliya', country: 'Israel', latitude: 32.1624, longitude: 34.8443 },
  { id: 'ramat-gan', name: 'Ramat Gan', country: 'Israel', latitude: 32.0719, longitude: 34.8242 },
  
  // USA
  { id: 'new-york', name: 'New York', country: 'USA', latitude: 40.7128, longitude: -74.0060 },
  { id: 'los-angeles', name: 'Los Angeles', country: 'USA', latitude: 34.0522, longitude: -118.2437 },
  { id: 'chicago', name: 'Chicago', country: 'USA', latitude: 41.8781, longitude: -87.6298 },
  { id: 'san-francisco', name: 'San Francisco', country: 'USA', latitude: 37.7749, longitude: -122.4194 },
  { id: 'miami', name: 'Miami', country: 'USA', latitude: 25.7617, longitude: -80.1918 },
  
  // Europe
  { id: 'london', name: 'London', country: 'UK', latitude: 51.5074, longitude: -0.1278 },
  { id: 'paris', name: 'Paris', country: 'France', latitude: 48.8566, longitude: 2.3522 },
  { id: 'berlin', name: 'Berlin', country: 'Germany', latitude: 52.5200, longitude: 13.4050 },
  { id: 'rome', name: 'Rome', country: 'Italy', latitude: 41.9028, longitude: 12.4964 },
  { id: 'barcelona', name: 'Barcelona', country: 'Spain', latitude: 41.3851, longitude: 2.1734 },
  { id: 'amsterdam', name: 'Amsterdam', country: 'Netherlands', latitude: 52.3676, longitude: 4.9041 },
  { id: 'madrid', name: 'Madrid', country: 'Spain', latitude: 40.4168, longitude: -3.7038 },
  
  // Asia
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', latitude: 35.6762, longitude: 139.6503 },
  { id: 'dubai', name: 'Dubai', country: 'UAE', latitude: 25.2048, longitude: 55.2708 },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', latitude: 1.3521, longitude: 103.8198 },
  { id: 'bangkok', name: 'Bangkok', country: 'Thailand', latitude: 13.7563, longitude: 100.5018 },
  { id: 'hong-kong', name: 'Hong Kong', country: 'China', latitude: 22.3193, longitude: 114.1694 },
  
  // Australia
  { id: 'sydney', name: 'Sydney', country: 'Australia', latitude: -33.8688, longitude: 151.2093 },
  { id: 'melbourne', name: 'Melbourne', country: 'Australia', latitude: -37.8136, longitude: 144.9631 },
];

export async function GET() {
  try {
    // Sort cities alphabetically by name
    const sortedCities = [...POPULAR_CITIES].sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    return NextResponse.json({ cities: sortedCities });
  } catch (error) {
    console.error('Popular cities error:', error);
    return NextResponse.json({ error: 'Failed to fetch popular cities', cities: [] }, { status: 500 });
  }
}

