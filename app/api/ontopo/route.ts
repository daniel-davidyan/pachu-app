import { NextRequest, NextResponse } from 'next/server';

// Levenshtein distance for fuzzy string matching
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1,
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1
        );
      }
    }
  }

  return dp[m][n];
}

// Normalize string for comparison
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s\u0590-\u05FF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate similarity percentage between two strings
function calculateSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeString(str1);
  const norm2 = normalizeString(str2);
  
  if (!norm1 || !norm2) return 0;
  
  // Exact match
  if (norm1 === norm2) return 100;
  
  // Calculate Levenshtein distance
  const distance = levenshteinDistance(norm1, norm2);
  const maxLength = Math.max(norm1.length, norm2.length);
  const similarity = ((maxLength - distance) / maxLength) * 100;
  
  return Math.max(0, similarity);
}

// Extract city name from address
function extractCity(address: string): string {
  const normalized = normalizeString(address);
  const parts = normalized.split(/[,،]/);
  return parts.length > 0 ? parts[parts.length - 1].trim() : '';
}

// Find best matching result
function findBestMatch(searchResults: any[], targetName: string, targetAddress?: string): any | null {
  if (searchResults.length === 0) return null;
  
  // If we only have one result, return it if similarity is reasonable
  if (searchResults.length === 1) {
    const nameScore = calculateSimilarity(searchResults[0].title || '', targetName);
    console.log(`📊 Single result "${searchResults[0].title}": name score ${nameScore.toFixed(1)}%`);
    
    // Accept single result with at least 40% name match
    if (nameScore >= 40) {
      console.log(`✅ Accepting single result`);
      return searchResults[0];
    }
    return null;
  }

  let bestMatch = null;
  let bestScore = 0;

  for (const result of searchResults) {
    // Name similarity (0-100)
    const nameScore = calculateSimilarity(result.title || '', targetName);
    
    // Address/city similarity if available
    let addressScore = 0;
    if (targetAddress && result.address) {
      // Compare full address
      const fullAddressScore = calculateSimilarity(result.address, targetAddress);
      
      // Compare city names
      const targetCity = extractCity(targetAddress);
      const resultCity = extractCity(result.address);
      const cityScore = calculateSimilarity(targetCity, resultCity);
      
      // Use best of full address or city match
      addressScore = Math.max(fullAddressScore, cityScore);
    }
    
    // Weighted score: name 70%, address 30%
    const totalScore = (nameScore * 0.7) + (addressScore * 0.3);
    
    console.log(`📊 "${result.title}": name=${nameScore.toFixed(1)}%, address=${addressScore.toFixed(1)}%, total=${totalScore.toFixed(1)}%`);
    
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestMatch = result;
    }
  }
  
  // Require at least 40% match confidence
  if (bestScore < 40) {
    console.log(`❌ No confident match found. Best score: ${bestScore.toFixed(1)}%`);
    return null;
  }
  
  console.log(`✅ Best match: "${bestMatch?.title}" with score ${bestScore.toFixed(1)}%`);
  return bestMatch;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const restaurantName = searchParams.get('name');
  const city = searchParams.get('city');
  const address = searchParams.get('address') || undefined; // Convert null to undefined

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

