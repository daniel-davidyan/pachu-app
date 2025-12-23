import { NextRequest, NextResponse } from 'next/server';

// Helper function to normalize strings for comparison
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s\u0590-\u05FF]/g, '') // Keep only alphanumeric and Hebrew
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate similarity score between two strings
function calculateSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeString(str1);
  const norm2 = normalizeString(str2);
  
  // Exact match
  if (norm1 === norm2) return 100;
  
  // Check if one contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 80;
  
  // Check word overlap
  const words1 = new Set(norm1.split(' '));
  const words2 = new Set(norm2.split(' '));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  
  if (intersection.size > 0) {
    const avgSize = (words1.size + words2.size) / 2;
    return (intersection.size / avgSize) * 60;
  }
  
  return 0;
}

// Find best matching result
function findBestMatch(searchResults: any[], targetName: string, targetAddress?: string): any | null {
  let bestMatch = null;
  let bestScore = 0;

  for (const result of searchResults) {
    let score = 0;
    
    // Compare name (most important)
    const nameScore = calculateSimilarity(result.title || '', targetName);
    score += nameScore * 2; // Weight name heavily
    
    // Compare address if available
    if (targetAddress && result.address) {
      const addressScore = calculateSimilarity(result.address, targetAddress);
      score += addressScore;
    }
    
    console.log(`📊 Match score for "${result.title}": ${score}`);
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = result;
    }
  }
  
  // Require at least 40% match confidence
  if (bestScore < 40) {
    console.log(`❌ No confident match found. Best score: ${bestScore}`);
    return null;
  }
  
  console.log(`✅ Best match: "${bestMatch?.title}" with score ${bestScore}`);
  return bestMatch;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const restaurantName = searchParams.get('name');
  const city = searchParams.get('city');
  const address = searchParams.get('address');

  if (!restaurantName) {
    return NextResponse.json({ error: 'Restaurant name is required' }, { status: 400 });
  }

  console.log(`🔍 Searching ONTOPO for: "${restaurantName}" in ${city || 'unknown city'}`);

  try {
    // Step 1: Search for the restaurant on ONTOPO
    const searchTerm = city ? `${restaurantName} ${city}` : restaurantName;
    const searchUrl = `https://ontopo.com/api/venue_search?slug=15171493&version=410&terms=${encodeURIComponent(searchTerm)}&locale=he`;
    
    console.log(`🌐 ONTOPO Search URL: ${searchUrl}`);
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!searchResponse.ok) {
      console.error('❌ ONTOPO search failed:', searchResponse.status, searchResponse.statusText);
      return NextResponse.json({ 
        error: 'Failed to search ONTOPO',
        details: `HTTP ${searchResponse.status}`,
      }, { status: 500 });
    }

    const searchResults = await searchResponse.json();
    console.log(`📋 Found ${searchResults?.length || 0} results from ONTOPO`);

    // Check if we got any results
    if (!Array.isArray(searchResults) || searchResults.length === 0) {
      console.log('❌ No results found on ONTOPO');
      return NextResponse.json({ error: 'No results found on ONTOPO' }, { status: 404 });
    }

    // Step 2: Find the best matching result
    const bestMatch = findBestMatch(searchResults, restaurantName, address);
    
    if (!bestMatch) {
      console.log('❌ No confident match found');
      return NextResponse.json({ 
        error: 'No matching restaurant found on ONTOPO',
        searched: restaurantName,
        resultsCount: searchResults.length,
      }, { status: 404 });
    }

    const venueSlug = bestMatch.slug;
    const venueVersion = bestMatch.version;

    if (!venueSlug) {
      console.error('❌ Invalid venue data - no slug');
      return NextResponse.json({ error: 'Invalid venue data' }, { status: 500 });
    }

    // Step 3: Fetch the venue profile to get the page slug
    const profileUrl = `https://ontopo.com/api/venue_profile?slug=${venueSlug}&version=${venueVersion}&locale=he`;
    
    console.log(`🔍 Fetching venue profile: ${venueSlug}`);
    
    const profileResponse = await fetch(profileUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!profileResponse.ok) {
      console.error('❌ ONTOPO profile fetch failed:', profileResponse.status, profileResponse.statusText);
      return NextResponse.json({ 
        error: 'Failed to fetch venue profile',
        details: `HTTP ${profileResponse.status}`,
      }, { status: 500 });
    }

    const profileData = await profileResponse.json();

    // Step 4: Extract the page slug from the pages array
    if (!profileData.pages || profileData.pages.length === 0) {
      console.log('❌ No reservation pages available');
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

    if (!pageSlug) {
      console.error('❌ No page slug found');
      return NextResponse.json({ 
        error: 'No page slug available',
        venueSlug,
      }, { status: 404 });
    }

    // Step 5: Build the final ONTOPO URL
    const ontopoUrl = `https://ontopo.com/he/il/page/${pageSlug}`;

    console.log(`✅ Successfully found ONTOPO page: ${ontopoUrl}`);

    return NextResponse.json({
      url: ontopoUrl,
      venueTitle: profileData.title,
      venueSlug,
      pageSlug,
    });

  } catch (error: any) {
    console.error('❌ Error fetching ONTOPO link:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
    }, { status: 500 });
  }
}

