import { NextRequest, NextResponse } from 'next/server';

/**
 * Search Google for ONTOPO restaurant page
 */
async function searchGoogleForOntopo(restaurantName: string, city?: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const searchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

  if (!apiKey || !searchEngineId) {
    console.log('⚠️ Google Custom Search not configured, will use fallback');
    return null;
  }

  try {
    // Try both Hebrew and English search terms
    const searchQueries = [
      `אונטופו ${restaurantName}`,
      `ontopo ${restaurantName}`,
    ];

    if (city) {
      searchQueries[0] = `אונטופו ${restaurantName} ${city}`;
      searchQueries[1] = `ontopo ${restaurantName} ${city}`;
    }

    for (const query of searchQueries) {
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=3`;
      
      console.log(`🔍 Searching Google: "${query}"`);
      
      const response = await fetch(searchUrl, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Google search failed:', response.status, errorData);
        
        // If quota exceeded, break and use fallback
        if (response.status === 429 || errorData.error?.message?.includes('quota')) {
          console.log('⚠️ Google API quota exceeded, using fallback');
          return null;
        }
        continue;
      }

      const data = await response.json();

      if (data.items && data.items.length > 0) {
        // Find ONTOPO page link
        for (const item of data.items) {
          const link = item.link;
          // Match ONTOPO page URLs like: https://ontopo.com/he/il/page/44216694
          const ontopoPageMatch = link.match(/https:\/\/ontopo\.com\/[a-z]{2}\/[a-z]{2}\/page\/\d+/);
          
          if (ontopoPageMatch) {
            console.log(`✅ Found ONTOPO link via Google: ${ontopoPageMatch[0]}`);
            return ontopoPageMatch[0];
          }
        }
      }
    }

    console.log('❌ No ONTOPO page found in Google results');
    return null;

  } catch (error: any) {
    console.error('❌ Error searching Google:', error.message || error);
    return null;
  }
}

/**
 * Fallback: Search directly on ONTOPO API
 */
async function searchOntopoDirectly(restaurantName: string, city?: string): Promise<string | null> {
  try {
    console.log('🔄 Using fallback: Direct ONTOPO API search');
    
    // Step 1: Search for the restaurant on ONTOPO
    const searchTerm = city ? `${restaurantName} ${city}` : restaurantName;
    const searchUrl = `https://ontopo.com/api/venue_search?slug=15171493&version=410&terms=${encodeURIComponent(searchTerm)}&locale=he`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!searchResponse.ok) {
      console.error('❌ ONTOPO search failed:', searchResponse.status);
      return null;
    }

    const searchResults = await searchResponse.json();

    if (!Array.isArray(searchResults) || searchResults.length === 0) {
      console.log('❌ No results found on ONTOPO');
      return null;
    }

    // Step 2: Get the first result's venue slug
    const firstResult = searchResults[0];
    const venueSlug = firstResult.slug;
    const venueVersion = firstResult.version;

    if (!venueSlug) {
      return null;
    }

    // Step 3: Fetch the venue profile to get the page slug
    const profileUrl = `https://ontopo.com/api/venue_profile?slug=${venueSlug}&version=${venueVersion}&locale=he`;
    
    const profileResponse = await fetch(profileUrl, {
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!profileResponse.ok) {
      console.error('❌ ONTOPO profile fetch failed:', profileResponse.status);
      return null;
    }

    const profileData = await profileResponse.json();

    // Step 4: Extract the page slug from the pages array
    if (!profileData.pages || profileData.pages.length === 0) {
      return null;
    }

    // Find the reservation page (or take the first page)
    const reservationPage = profileData.pages.find((page: any) => 
      page.content_type === 'reservation'
    ) || profileData.pages[0];

    const pageSlug = reservationPage.slug;

    // Step 5: Build the final ONTOPO URL
    const ontopoUrl = `https://ontopo.com/he/il/page/${pageSlug}`;
    console.log(`✅ Found ONTOPO link via API: ${ontopoUrl}`);
    
    return ontopoUrl;

  } catch (error: any) {
    console.error('❌ Error in ONTOPO fallback search:', error.message || error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const restaurantName = searchParams.get('name');
  const city = searchParams.get('city');

  if (!restaurantName) {
    return NextResponse.json({ error: 'Restaurant name is required' }, { status: 400 });
  }

  console.log(`🔍 Looking for ONTOPO page: "${restaurantName}"${city ? ` in ${city}` : ''}`);

  try {
    // Try Google Custom Search first
    let ontopoUrl = await searchGoogleForOntopo(restaurantName, city || undefined);

    // Fallback to direct ONTOPO API search
    if (!ontopoUrl) {
      ontopoUrl = await searchOntopoDirectly(restaurantName, city || undefined);
    }

    if (!ontopoUrl) {
      console.log(`❌ No ONTOPO page found for "${restaurantName}"`);
      return NextResponse.json({ 
        error: 'Restaurant not found on ONTOPO',
        searched: restaurantName,
      }, { status: 404 });
    }

    // Extract slugs from URL for additional info
    const urlMatch = ontopoUrl.match(/page\/(\d+)/);
    const pageSlug = urlMatch ? urlMatch[1] : null;

    return NextResponse.json({
      url: ontopoUrl,
      pageSlug,
      method: ontopoUrl.includes('ontopo.com') ? 'success' : 'unknown',
    });

  } catch (error: any) {
    console.error('❌ Unexpected error fetching ONTOPO link:', error.message || error);
    // Return 404 instead of 500 - this way the button simply won't show
    return NextResponse.json({ 
      error: 'Unable to connect to ONTOPO',
      message: 'Please try again later',
    }, { status: 404 });
  }
}

