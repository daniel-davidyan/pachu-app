import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const restaurantName = searchParams.get('name');
  const city = searchParams.get('city');

  if (!restaurantName) {
    return NextResponse.json({ error: 'Restaurant name is required' }, { status: 400 });
  }

  try {
    // Step 1: Search for the restaurant on ONTOPO
    const searchTerm = city ? `${restaurantName} ${city}` : restaurantName;
    const searchUrl = `https://ontopo.com/api/venue_search?slug=15171493&version=410&terms=${encodeURIComponent(searchTerm)}&locale=he`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!searchResponse.ok) {
      console.error('ONTOPO search failed:', searchResponse.status);
      return NextResponse.json({ error: 'Failed to search ONTOPO' }, { status: 500 });
    }

    const searchResults = await searchResponse.json();

    // Check if we got any results
    if (!Array.isArray(searchResults) || searchResults.length === 0) {
      return NextResponse.json({ error: 'No results found on ONTOPO' }, { status: 404 });
    }

    // Step 2: Get the first result's venue slug
    const firstResult = searchResults[0];
    const venueSlug = firstResult.slug;
    const venueVersion = firstResult.version;

    if (!venueSlug) {
      return NextResponse.json({ error: 'Invalid venue data' }, { status: 500 });
    }

    // Step 3: Fetch the venue profile to get the page slug
    const profileUrl = `https://ontopo.com/api/venue_profile?slug=${venueSlug}&version=${venueVersion}&locale=he`;
    
    const profileResponse = await fetch(profileUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!profileResponse.ok) {
      console.error('ONTOPO profile fetch failed:', profileResponse.status);
      return NextResponse.json({ error: 'Failed to fetch venue profile' }, { status: 500 });
    }

    const profileData = await profileResponse.json();

    // Step 4: Extract the page slug from the pages array
    if (!profileData.pages || profileData.pages.length === 0) {
      return NextResponse.json({ 
        error: 'No reservation page available',
        venueSlug,
      }, { status: 404 });
    }

    // Find the reservation page (or take the first page)
    const reservationPage = profileData.pages.find((page: any) => 
      page.content_type === 'reservation'
    ) || profileData.pages[0];

    const pageSlug = reservationPage.slug;

    // Step 5: Build the final ONTOPO URL
    const ontopoUrl = `https://ontopo.com/he/il/page/${pageSlug}`;

    return NextResponse.json({
      url: ontopoUrl,
      venueTitle: profileData.title,
      venueSlug,
      pageSlug,
    });

  } catch (error) {
    console.error('Error fetching ONTOPO link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

