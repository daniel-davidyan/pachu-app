import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

/**
 * POST /api/restaurants/cache/populate
 * 
 * Populates the restaurant_cache table with restaurants from Israel.
 * This is a long-running operation that should be run manually.
 * 
 * The process:
 * 1. Scan Israel using a dense grid of Google Places Nearby Search
 * 2. For each restaurant, fetch Place Details (including reviews)
 * 3. Generate a summary using LLM
 * 4. Generate embedding using text-embedding-3-small
 * 5. Save to restaurant_cache (upsert by google_place_id)
 * 
 * Features:
 * - Deduplication by google_place_id
 * - Resumable: skips restaurants updated within 30 days
 * - Progress logging
 * - Rate limiting to avoid API blocks
 * 
 * Usage:
 * POST /api/restaurants/cache/populate
 * Body: {
 *   "region": "israel" | "tel_aviv" | "center" | "north" | "south",
 *   "forceUpdate": false,
 *   "batchSize": 10,
 *   "delayBetweenBatches": 2000
 * }
 */

// ========================================
// Israel Grid Configuration
// ========================================

// Helper function to generate a dense grid for a bounding box
function generateDenseGrid(
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  stepDegrees: number = 0.008, // ~800m spacing
  namePrefix: string = 'Grid'
): Array<{ lat: number; lng: number; name: string }> {
  const grid: Array<{ lat: number; lng: number; name: string }> = [];
  let pointNum = 1;
  
  for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += stepDegrees) {
    for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += stepDegrees) {
      grid.push({
        lat: Math.round(lat * 10000) / 10000, // Round to 4 decimal places
        lng: Math.round(lng * 10000) / 10000,
        name: `${namePrefix} ${pointNum++}`,
      });
    }
  }
  
  return grid;
}

// Tel Aviv DENSE grid - ~800m spacing for comprehensive coverage
// Tel Aviv bounds: South (Jaffa) to North (Reading), West (Beach) to East (Ayalon)
const TEL_AVIV_DENSE_GRID = generateDenseGrid(
  { minLat: 32.04, maxLat: 32.13, minLng: 34.76, maxLng: 34.82 },
  0.008, // ~800m spacing = ~90 grid points
  'TLV'
);

// Comprehensive grid covering all of Israel (for other regions)
const ISRAEL_FULL_GRID = [
  // Tel Aviv - use dense grid
  ...TEL_AVIV_DENSE_GRID,
  
  // Gush Dan (surrounding cities)
  { lat: 32.1100, lng: 34.8400, name: 'Ramat Gan Center' },
  { lat: 32.0900, lng: 34.8500, name: 'Givatayim' },
  { lat: 32.1200, lng: 34.8700, name: 'Bnei Brak' },
  { lat: 32.0550, lng: 34.7550, name: 'Bat Yam North' },
  { lat: 32.0200, lng: 34.7500, name: 'Bat Yam South' },
  { lat: 32.0100, lng: 34.7650, name: 'Holon' },
  { lat: 32.0850, lng: 34.8150, name: 'Kiryat Ono' },
  { lat: 32.1400, lng: 34.8300, name: 'Petah Tikva West' },
  { lat: 32.1500, lng: 34.8800, name: 'Petah Tikva East' },
  { lat: 32.1700, lng: 34.9100, name: 'Rosh HaAyin' },
  { lat: 32.0500, lng: 34.8700, name: 'Or Yehuda' },
  { lat: 32.0300, lng: 34.8500, name: 'Yehud' },
  
  // Sharon Region
  { lat: 32.1800, lng: 34.8700, name: 'Kfar Saba' },
  { lat: 32.1850, lng: 34.9200, name: 'Hod HaSharon' },
  { lat: 32.2200, lng: 34.8500, name: 'Raanana' },
  { lat: 32.2700, lng: 34.8500, name: 'Herzliya' },
  { lat: 32.3215, lng: 34.8532, name: 'Netanya South' },
  { lat: 32.3500, lng: 34.8600, name: 'Netanya Center' },
  { lat: 32.3800, lng: 34.8700, name: 'Netanya North' },
  
  // Hadera & North Sharon
  { lat: 32.4340, lng: 34.9196, name: 'Hadera' },
  { lat: 32.4800, lng: 34.9500, name: 'Pardes Hanna' },
  { lat: 32.5200, lng: 34.9400, name: 'Zichron Yaakov' },
  { lat: 32.4500, lng: 35.0000, name: 'Caesarea' },
  
  // Haifa Region
  { lat: 32.7940, lng: 34.9896, name: 'Haifa Downtown' },
  { lat: 32.8200, lng: 34.9900, name: 'Haifa Carmel' },
  { lat: 32.7700, lng: 35.0200, name: 'Haifa Bay' },
  { lat: 32.8500, lng: 35.0800, name: 'Nesher' },
  { lat: 32.7500, lng: 35.0000, name: 'Tirat Carmel' },
  { lat: 32.7200, lng: 35.0700, name: 'Atlit' },
  
  // Krayot (Haifa suburbs)
  { lat: 32.8300, lng: 35.0700, name: 'Kiryat Ata' },
  { lat: 32.8400, lng: 35.0900, name: 'Kiryat Bialik' },
  { lat: 32.8600, lng: 35.0800, name: 'Kiryat Motzkin' },
  { lat: 32.8900, lng: 35.0700, name: 'Kiryat Yam' },
  
  // Akko & Western Galilee
  { lat: 32.9280, lng: 35.0840, name: 'Akko' },
  { lat: 33.0100, lng: 35.0970, name: 'Nahariya' },
  { lat: 32.9600, lng: 35.1600, name: 'Karmiel' },
  { lat: 32.9200, lng: 35.3000, name: 'Tzfat' },
  
  // Eastern Galilee & Golan
  { lat: 32.7900, lng: 35.4900, name: 'Tiberias' },
  { lat: 32.8500, lng: 35.5400, name: 'Kinneret' },
  { lat: 33.0000, lng: 35.6500, name: 'Kiryat Shmona' },
  { lat: 32.9700, lng: 35.7000, name: 'Metula' },
  { lat: 32.7700, lng: 35.6900, name: 'Katzrin' },
  
  // Lower Galilee & Valleys
  { lat: 32.6900, lng: 35.3000, name: 'Nazareth' },
  { lat: 32.6100, lng: 35.2900, name: 'Afula' },
  { lat: 32.5700, lng: 35.1700, name: 'Yokneam' },
  { lat: 32.5600, lng: 35.3500, name: 'Beit Shean' },
  { lat: 32.4700, lng: 35.4800, name: 'Beit Alfa' },
  
  // Jerusalem & Surroundings
  { lat: 31.7683, lng: 35.2137, name: 'Jerusalem Center' },
  { lat: 31.7857, lng: 35.2007, name: 'Mahane Yehuda' },
  { lat: 31.8000, lng: 35.2300, name: 'Jerusalem North' },
  { lat: 31.7500, lng: 35.2200, name: 'German Colony' },
  { lat: 31.7300, lng: 35.2100, name: 'Baka' },
  { lat: 31.7600, lng: 35.1800, name: 'Ein Kerem' },
  { lat: 31.8500, lng: 35.1800, name: 'Mevaseret Zion' },
  { lat: 31.7100, lng: 35.1000, name: 'Beit Shemesh' },
  { lat: 31.8700, lng: 35.0500, name: 'Modiin West' },
  { lat: 31.9000, lng: 35.0100, name: 'Modiin Center' },
  
  // Central Israel (Judean Lowlands)
  { lat: 31.8900, lng: 34.8100, name: 'Rehovot' },
  { lat: 31.9300, lng: 34.8700, name: 'Rishon LeZion' },
  { lat: 31.9700, lng: 34.7700, name: 'Ness Ziona' },
  { lat: 31.8500, lng: 34.7400, name: 'Ashdod North' },
  { lat: 31.8100, lng: 34.6500, name: 'Ashdod South' },
  { lat: 31.6700, lng: 34.5700, name: 'Ashkelon' },
  { lat: 31.7500, lng: 34.7500, name: 'Kiryat Malachi' },
  { lat: 31.9000, lng: 34.7000, name: 'Ramle' },
  { lat: 31.9300, lng: 34.8900, name: 'Lod' },
  
  // Negev
  { lat: 31.2518, lng: 34.7913, name: 'Beer Sheva Center' },
  { lat: 31.2800, lng: 34.7600, name: 'Beer Sheva North' },
  { lat: 31.2200, lng: 34.8100, name: 'Beer Sheva Old City' },
  { lat: 31.3100, lng: 34.6300, name: 'Ofakim' },
  { lat: 31.3300, lng: 34.8900, name: 'Arad' },
  { lat: 31.0900, lng: 34.8000, name: 'Dimona' },
  { lat: 30.9500, lng: 34.9500, name: 'Mitzpe Ramon' },
  { lat: 30.6100, lng: 34.8000, name: 'Sde Boker' },
  
  // Eilat
  { lat: 29.5577, lng: 34.9519, name: 'Eilat North' },
  { lat: 29.5400, lng: 34.9400, name: 'Eilat Center' },
  { lat: 29.5200, lng: 34.9300, name: 'Eilat South' },
  
  // Dead Sea Region
  { lat: 31.5000, lng: 35.3800, name: 'Ein Gedi' },
  { lat: 31.2000, lng: 35.3600, name: 'Masada' },
  { lat: 31.0500, lng: 35.3500, name: 'Ein Bokek' },
];

// Region subsets for partial scans
const REGIONS: Record<string, typeof ISRAEL_FULL_GRID> = {
  israel: ISRAEL_FULL_GRID,
  // Tel Aviv ONLY - dense grid focused on Tel Aviv city limits
  tel_aviv: TEL_AVIV_DENSE_GRID,
  // Gush Dan - Tel Aviv + surrounding cities
  gush_dan: [
    ...TEL_AVIV_DENSE_GRID,
    ...ISRAEL_FULL_GRID.filter(p => 
      p.lat >= 32.0 && p.lat <= 32.2 && p.lng >= 34.7 && p.lng <= 34.95 &&
      !TEL_AVIV_DENSE_GRID.some(t => t.lat === p.lat && t.lng === p.lng)
  ),
  ],
  center: ISRAEL_FULL_GRID.filter(p => 
    p.lat >= 31.7 && p.lat <= 32.4 && p.lng >= 34.6 && p.lng <= 35.1
  ),
  north: ISRAEL_FULL_GRID.filter(p => 
    p.lat >= 32.4
  ),
  south: ISRAEL_FULL_GRID.filter(p => 
    p.lat < 31.5
  ),
  jerusalem: ISRAEL_FULL_GRID.filter(p => 
    p.lat >= 31.7 && p.lat <= 31.95 && p.lng >= 35.0 && p.lng <= 35.3
  ),
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    
    const body = await request.json().catch(() => ({}));
    const {
      region = 'israel',
      forceUpdate = false,
      batchSize = 5, // Reduced for stability
      delayBetweenBatches = 3000, // 3 seconds between batches
      delayBetweenAreas = 5000, // 5 seconds between areas
      radius = 1500, // 1.5km radius - works well with dense grid (800m spacing)
    } = body;

    // API keys
    const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!googleApiKey) {
      return NextResponse.json(
        { error: 'Google Places API key not configured' },
        { status: 500 }
      );
    }

    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });
    const scanAreas = REGIONS[region] || REGIONS.israel;
    
    // Statistics
    let areasScanned = 0;
    let restaurantsFound = 0;
    let restaurantsProcessed = 0;
    let restaurantsAdded = 0;
    let restaurantsSkipped = 0;
    let restaurantsFiltered = 0; // Not in Tel Aviv
    let errors = 0;
    const seenPlaceIds = new Set<string>();

    console.log('========================================');
    console.log(`🚀 STARTING RESTAURANT CACHE POPULATION`);
    console.log(`📍 Region: ${region}`);
    console.log(`📍 Total areas to scan: ${scanAreas.length}`);
    console.log(`📍 Radius per area: ${radius}m`);
    console.log(`📍 Force update: ${forceUpdate}`);
    console.log('========================================');

    for (const area of scanAreas) {
      areasScanned++;
      console.log(`\n📍 [${areasScanned}/${scanAreas.length}] Scanning: ${area.name}`);
      console.log(`   Coordinates: ${area.lat}, ${area.lng}`);

      try {
        // Fetch restaurants from Google Places (with recursive subdivision for dense areas)
        // The function handles deduplication internally via seenPlaceIds
        const newPlaces = await fetchNearbyRestaurants(
          googleApiKey, 
          area.lat, 
          area.lng, 
          radius,
          seenPlaceIds // Pass shared set for cross-area deduplication
        );
        
        restaurantsFound += newPlaces.length;
        console.log(`   Found: ${newPlaces.length} new restaurants (total unique so far: ${seenPlaceIds.size})`);

        // Process in batches
        for (let i = 0; i < newPlaces.length; i += batchSize) {
          const batch = newPlaces.slice(i, Math.min(i + batchSize, newPlaces.length));
          console.log(`   Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(newPlaces.length / batchSize)}`);

          // Process batch in parallel
          const results = await Promise.allSettled(
            batch.map(place => processRestaurant(
              supabase, openai, googleApiKey, place, forceUpdate
            ))
          );

          // Count results
          results.forEach((result, idx) => {
            restaurantsProcessed++;
            if (result.status === 'fulfilled') {
              if (result.value === 'added') restaurantsAdded++;
              else if (result.value === 'skipped') restaurantsSkipped++;
              else if (result.value === 'filtered') restaurantsFiltered++;
            } else {
              errors++;
              console.error(`   ❌ Error processing ${batch[idx].name}:`, result.reason);
            }
          });

          // Rate limiting between batches
          if (i + batchSize < newPlaces.length) {
            await sleep(delayBetweenBatches);
          }
        }
      } catch (areaError) {
        console.error(`   ❌ Error scanning area ${area.name}:`, areaError);
        errors++;
      }

      // Progress report
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const estimatedTotal = Math.round((elapsed / areasScanned) * scanAreas.length);
      console.log(`   📊 Progress: ${areasScanned}/${scanAreas.length} areas | ${restaurantsAdded} added | ${restaurantsFiltered} filtered (not TLV) | ${errors} errors`);
      console.log(`   ⏱️ Elapsed: ${formatDuration(elapsed)} | Est. remaining: ${formatDuration(estimatedTotal - elapsed)}`);

      // Delay between areas
      if (areasScanned < scanAreas.length) {
        await sleep(delayBetweenAreas);
      }
    }

    const duration = Date.now() - startTime;

    console.log('\n========================================');
    console.log(`✅ POPULATION COMPLETE!`);
    console.log(`📊 Areas scanned: ${areasScanned}`);
    console.log(`📊 Restaurants found: ${restaurantsFound}`);
    console.log(`📊 Restaurants processed: ${restaurantsProcessed}`);
    console.log(`📊 Restaurants added/updated: ${restaurantsAdded}`);
    console.log(`📊 Restaurants skipped (recent): ${restaurantsSkipped}`);
    console.log(`📊 Restaurants filtered (not Tel Aviv): ${restaurantsFiltered}`);
    console.log(`📊 Errors: ${errors}`);
    console.log(`⏱️ Total duration: ${formatDuration(Math.round(duration / 1000))}`);
    console.log('========================================');

    return NextResponse.json({
      success: true,
      stats: {
        areasScanned,
        restaurantsFound,
        restaurantsProcessed,
        restaurantsAdded,
        restaurantsSkipped,
        restaurantsFiltered,
        errors,
      },
      duration: Math.round(duration / 1000),
      region,
    });
  } catch (error) {
    console.error('Fatal error in cache population:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ========================================
// Core Processing Functions
// ========================================

// Valid Tel Aviv city names (in English and Hebrew) - expanded list
const TEL_AVIV_CITY_NAMES = new Set([
  'Tel Aviv-Yafo',
  'Tel Aviv',
  'Tel Aviv Yafo',
  'Tel-Aviv',
  'Tel-Aviv-Yafo',
  'תל אביב-יפו',
  'תל אביב',
  'Jaffa',
  'יפו',
  'TLV',
  'tel aviv',
  'tel-aviv',
  'telaviv',
  'Tel Aviv District', // Sometimes Google returns the district
  'מחוז תל אביב',
]);

// Tel Aviv approximate bounding box for coordinate-based filtering
// Slightly larger than the grid to catch edge cases
const TEL_AVIV_BOUNDS = {
  minLat: 32.035,
  maxLat: 32.135,
  minLng: 34.755,
  maxLng: 34.825,
};

// Function to check if coordinates are in Tel Aviv
function isInTelAviv(lat: number, lng: number): boolean {
  return lat >= TEL_AVIV_BOUNDS.minLat && 
         lat <= TEL_AVIV_BOUNDS.maxLat && 
         lng >= TEL_AVIV_BOUNDS.minLng && 
         lng <= TEL_AVIV_BOUNDS.maxLng;
}

async function processRestaurant(
  supabase: any,
  openai: OpenAI,
  googleApiKey: string,
  place: any,
  forceUpdate: boolean
): Promise<'added' | 'skipped' | 'filtered'> {
  // Check if already in cache (and recently updated)
  if (!forceUpdate) {
    const { data: existing } = await supabase
      .from('restaurant_cache')
      .select('id, last_updated')
      .eq('google_place_id', place.place_id)
      .single();

    if (existing) {
      const lastUpdated = new Date(existing.last_updated);
      const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 30) {
        return 'skipped';
      }
    }
  }

  // Fetch place details (English) and Hebrew name in parallel
  const [details, nameHe] = await Promise.all([
    fetchPlaceDetails(googleApiKey, place.place_id),
    fetchHebrewName(googleApiKey, place.place_id),
  ]);
  
  // Extract coordinates
  const lat = place.geometry.location.lat;
  const lng = place.geometry.location.lng;
  
  // Filter by Tel Aviv - use BOTH city name AND coordinates
  const city = extractCity(details.address_components);
  const inTelAvivByCoordinates = isInTelAviv(lat, lng);
  const inTelAvivByName = city && TEL_AVIV_CITY_NAMES.has(city);
  
  // Accept if EITHER coordinates OR name match (coordinates are more reliable)
  if (!inTelAvivByCoordinates && !inTelAvivByName) {
    console.log(`   ⏭️ Filtered: ${place.name} (city: ${city || 'unknown'}, coords: ${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    return 'filtered';
  }
  
  // If coordinates say Tel Aviv but name doesn't match, override the city name
  const finalCity = inTelAvivByCoordinates ? 'Tel Aviv-Yafo' : city;
  
  // Generate summary AND cuisine types with LLM (single call)
  const { summary, cuisineTypes } = await retryOperation(() => 
    generateSummaryAndCuisine(openai, place, details)
  );
  
  // Generate embedding with retry (include cuisine types for better search)
  const embedding = await retryOperation(() => 
    generateEmbedding(openai, place, details, summary, cuisineTypes)
  );

  // Prepare data - use proper PostGIS format
  const restaurantData = {
    google_place_id: place.place_id,
    name_en: place.name, // English name (from language=en search)
    name_he: nameHe,     // Hebrew name for local search
    address: details.formatted_address || place.vicinity,
    city: finalCity, // Use the corrected city name
    // PostGIS GEOGRAPHY format - use raw SQL for location
    phone: details.formatted_phone_number || null,
    website: details.website || null,
    google_rating: place.rating || null,
    google_reviews_count: place.user_ratings_total || 0,
    price_level: place.price_level || null,
    // Use LLM-generated cuisine types (more accurate), fallback to Google types
    cuisine_types: cuisineTypes.length > 0 ? cuisineTypes : extractCuisineTypes(place.types),
    is_kosher: detectKosher(place.name, details),
    is_vegetarian_friendly: detectVegetarian(place.name, details),
    opening_hours: details.opening_hours ? {
      periods: details.opening_hours.periods,
      weekday_text: details.opening_hours.weekday_text,
    } : null,
    photos: (details.photos || []).slice(0, 5).map((p: any) => ({
      photo_reference: p.photo_reference,
      width: p.width,
      height: p.height,
    })),
    google_reviews: (details.reviews || []).slice(0, 5).map((r: any) => ({
      author_name: r.author_name,
      rating: r.rating,
      text: r.text,
      time: r.time,
      language: r.language,
    })),
    summary_text: summary,
    embedding: embedding.length > 0 ? embedding : null,
    last_updated: new Date().toISOString(),
  };

  // Use raw SQL for proper PostGIS point insertion
  const { error: upsertError } = await supabase.rpc('upsert_restaurant_cache', {
    p_google_place_id: restaurantData.google_place_id,
    p_name_en: restaurantData.name_en,
    p_name_he: restaurantData.name_he,
    p_address: restaurantData.address,
    p_city: restaurantData.city,
    p_lat: lat,
    p_lng: lng,
    p_phone: restaurantData.phone,
    p_website: restaurantData.website,
    p_google_rating: restaurantData.google_rating,
    p_google_reviews_count: restaurantData.google_reviews_count,
    p_price_level: restaurantData.price_level,
    p_cuisine_types: restaurantData.cuisine_types,
    p_is_kosher: restaurantData.is_kosher,
    p_is_vegetarian_friendly: restaurantData.is_vegetarian_friendly,
    p_opening_hours: restaurantData.opening_hours,
    p_photos: restaurantData.photos,
    p_google_reviews: restaurantData.google_reviews,
    p_summary_text: restaurantData.summary_text,
    p_embedding: restaurantData.embedding,
  });

  if (upsertError) {
    // Fallback to direct insert without location
    console.log(`   ⚠️ RPC failed, trying direct insert for ${place.name}`);
    const { error: directError } = await supabase
      .from('restaurant_cache')
      .upsert({
        ...restaurantData,
        // Skip location for now, will update via SQL later
      }, {
        onConflict: 'google_place_id',
      });

    if (directError) {
      throw new Error(`Failed to save: ${directError.message}`);
    }
    
    // Update location separately using raw query
    await supabase.rpc('update_restaurant_location', {
      p_google_place_id: place.place_id,
      p_lat: lat,
      p_lng: lng,
    }).catch(() => {
      // Location update failed, but data is saved
      console.log(`   ⚠️ Location update failed for ${place.name}, will need manual fix`);
    });
  }

  console.log(`   ✅ ${place.name}`);
  return 'added';
}

// ========================================
// Google Places API Functions
// ========================================

// Single area search - returns results and whether it hit the limit
async function fetchNearbyRestaurantsSingle(
  apiKey: string,
  lat: number,
  lng: number,
  radius: number
): Promise<{ results: any[]; hitLimit: boolean }> {
  const allResults: any[] = [];
  let nextPageToken: string | undefined;
  let pageCount = 0;
  const maxPages = 3; // Google returns max 60 results (3 pages of 20)

  do {
    // Use language=en for English names (with Hebrew fallback from Google)
    const url = nextPageToken
      ? `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${nextPageToken}&key=${apiKey}&language=en`
      : `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=restaurant&key=${apiKey}&language=en`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK') {
      allResults.push(...(data.results || []));
    } else if (data.status === 'ZERO_RESULTS') {
      break;
    } else if (data.status === 'INVALID_REQUEST' && nextPageToken) {
      // Token not ready yet, wait and retry
      await sleep(2000);
      continue;
    } else {
      console.error(`   Google Places error: ${data.status} - ${data.error_message || ''}`);
      break;
    }

    nextPageToken = data.next_page_token;
    pageCount++;

    // Wait for next page token to become valid (Google requirement)
    if (nextPageToken && pageCount < maxPages) {
      await sleep(2500);
    }
  } while (nextPageToken && pageCount < maxPages);

  // If we got exactly 60 results, we likely hit the Google limit
  const hitLimit = allResults.length >= 60;
  
  return { results: allResults, hitLimit };
}

// Recursive search that subdivides dense areas into 4 quadrants
// This ensures we capture all restaurants even in very dense areas
async function fetchNearbyRestaurants(
  apiKey: string,
  lat: number,
  lng: number,
  radius: number,
  seenPlaceIds: Set<string> = new Set(),
  depth: number = 0,
  maxDepth: number = 3, // Max 3 levels of subdivision (1 -> 4 -> 16 -> 64 areas)
  minRadius: number = 200 // Stop subdividing below 200m radius
): Promise<any[]> {
  const { results, hitLimit } = await fetchNearbyRestaurantsSingle(apiKey, lat, lng, radius);
  
  // Filter out already seen places
  const newResults = results.filter(r => !seenPlaceIds.has(r.place_id));
  newResults.forEach(r => seenPlaceIds.add(r.place_id));
  
  // If we didn't hit the limit, or we've subdivided enough, return what we have
  if (!hitLimit || depth >= maxDepth || radius <= minRadius) {
    if (hitLimit && depth >= maxDepth) {
      console.log(`   ⚠️ Still hitting limit at max depth ${depth}, radius ${radius}m - some restaurants may be missed`);
    }
    return newResults;
  }
  
  // Hit the limit - subdivide into 4 quadrants and search each
  console.log(`   🔄 Area at (${lat.toFixed(4)}, ${lng.toFixed(4)}) hit 60 limit, subdividing (depth ${depth + 1})`);
  
  // Calculate offset for quadrants (roughly half the radius in degrees)
  // 1 degree lat ≈ 111km, 1 degree lng ≈ 85km at Israel's latitude
  const latOffset = (radius / 1000) / 111 / 2; // Half radius in degrees
  const lngOffset = (radius / 1000) / 85 / 2;  // Half radius in degrees
  const newRadius = Math.round(radius / 2);     // Half the radius for quadrants
  
  // 4 quadrants: NW, NE, SW, SE
  const quadrants = [
    { lat: lat + latOffset, lng: lng - lngOffset, name: 'NW' },
    { lat: lat + latOffset, lng: lng + lngOffset, name: 'NE' },
    { lat: lat - latOffset, lng: lng - lngOffset, name: 'SW' },
    { lat: lat - latOffset, lng: lng + lngOffset, name: 'SE' },
  ];
  
  // Search each quadrant (with delay to avoid rate limiting)
  const allQuadrantResults: any[] = [...newResults];
  
  for (const quadrant of quadrants) {
    await sleep(1000); // Small delay between quadrant searches
    
    const quadrantResults = await fetchNearbyRestaurants(
      apiKey,
      quadrant.lat,
      quadrant.lng,
      newRadius,
      seenPlaceIds,
      depth + 1,
      maxDepth,
      minRadius
    );
    
    allQuadrantResults.push(...quadrantResults);
  }
  
  return allQuadrantResults;
}

async function fetchPlaceDetails(apiKey: string, placeId: string): Promise<any> {
  const fields = [
    'formatted_address',
    'formatted_phone_number',
    'website',
    'opening_hours',
    'reviews',
    'photos',
    'address_components',
  ].join(',');
  
  // Use language=en for English names and addresses
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}&reviews_sort=most_relevant&language=en`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status !== 'OK') {
    console.error(`   Place Details error for ${placeId}: ${data.status}`);
    return {};
  }
  
  return data.result || {};
}

// Fetch Hebrew name for a place (separate call to avoid mixing languages)
async function fetchHebrewName(apiKey: string, placeId: string): Promise<string | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name&key=${apiKey}&language=iw`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.result?.name) {
      return data.result.name;
    }
    return null;
  } catch (error) {
    console.error(`   Error fetching Hebrew name for ${placeId}:`, error);
    return null;
  }
}

// ========================================
// AI Functions
// ========================================

// Fixed list of cuisine categories for consistent filtering
const CUISINE_CATEGORIES = [
  // Cuisines (only if clearly identifiable)
  'Italian', 'Japanese', 'Chinese', 'Thai', 'Indian', 'Mexican', 
  'Mediterranean', 'Middle Eastern', 'American', 'French', 'Greek', 
  'Turkish', 'Israeli', 'Asian', 'Georgian', 'Korean', 'Vietnamese',
  // Food types (only if the main focus)
  'Sushi', 'Pizza', 'Burgers', 'Steak', 'Seafood', 'Hummus', 'Shawarma', 'Falafel',
  // Dietary
  'Vegetarian', 'Vegan',
  // Venue types
  'Cafe', 'Bar', 'Pub', 'Wine Bar', 'Bakery', 'Desserts',
  // Meal types
  'Breakfast', 'Brunch',
  // Style
  'Fast Food', 'Fine Dining',
];

async function generateSummaryAndCuisine(
  openai: OpenAI, 
  place: any, 
  details: any
): Promise<{ summary: string; cuisineTypes: string[] }> {
  const reviews = (details.reviews || []).slice(0, 3);
  const reviewTexts = reviews.map((r: any) => `- ${r.text}`).join('\n');

  const prompt = `Analyze this restaurant and provide:
1. A 2-3 sentence summary in English
2. Cuisine categories ONLY if clearly evident from the name or reviews

Name: ${place.name}
Rating: ${place.rating || 'N/A'} (${place.user_ratings_total || 0} reviews)
Address: ${details.formatted_address || place.vicinity || 'N/A'}

Reviews:
${reviewTexts || 'No reviews'}

RULES for cuisineTypes:
- ONLY include categories you are VERY CONFIDENT about
- If it's a generic restaurant with no clear cuisine, return empty array []
- Maximum 2 categories
- Choose ONLY from this list: ${CUISINE_CATEGORIES.join(', ')}

Respond in JSON ONLY:
{"summary": "...", "cuisineTypes": []}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2, // Lower temperature for consistency
      max_tokens: 200,
    });

    const content = response.choices[0].message.content?.trim() || '';
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    
    // Validate cuisine types against our fixed list
    const validCuisines = (parsed.cuisineTypes || [])
      .filter((t: string) => CUISINE_CATEGORIES.includes(t))
      .slice(0, 2); // Max 2 categories
    
    return {
      summary: parsed.summary || '',
      cuisineTypes: validCuisines,
    };
  } catch (error) {
    console.error('   Error generating summary/cuisine:', error);
    return { summary: '', cuisineTypes: [] };
  }
}

async function generateEmbedding(
  openai: OpenAI,
  place: any,
  details: any,
  summary: string,
  cuisineTypes: string[] = []
): Promise<number[]> {
  // Build comprehensive text for embedding
  const textParts = [
    place.name,
    summary || '',
    cuisineTypes.join(', '), // Use LLM-generated cuisine types
    extractCity(details.address_components) || '',
  ];

  // Add review snippets (limited)
  const reviews = (details.reviews || []).slice(0, 3);
  reviews.forEach((r: any) => {
    if (r.text) {
      textParts.push(r.text.slice(0, 200));
    }
  });

  const embeddingText = textParts.filter(Boolean).join(' ').slice(0, 8000); // OpenAI limit

  if (!embeddingText.trim()) {
    return [];
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: embeddingText,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('   Error generating embedding:', error);
    return [];
  }
}

// ========================================
// Helper Functions
// ========================================

function extractCity(addressComponents: any[]): string | null {
  if (!addressComponents) return null;

  // Priority: locality > sublocality > administrative_area_level_2 > administrative_area_level_1
  const priorities = ['locality', 'sublocality', 'administrative_area_level_2', 'administrative_area_level_1'];
  
  for (const type of priorities) {
    const component = addressComponents.find((c: any) => c.types.includes(type));
    if (component) return component.long_name;
  }

  return null;
}

function extractCuisineTypes(types: string[]): string[] {
  if (!types) return [];

  // Only exclude truly generic types - keep cafe, bar, bakery, etc.
  const excludeTypes = new Set([
    'point_of_interest', 
    'establishment',
    'store', 
    'health', 
    'lodging', 
    'finance', 
    'real_estate_agency',
    'political',
    'general_contractor',
  ]);

  // Format types nicely: meal_takeaway -> Meal Takeaway
  return types
    .filter(t => !excludeTypes.has(t))
    .map(t => t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
}

function detectKosher(name: string, details: any): boolean {
  const kosherKeywords = ['כשר', 'kosher', 'mehadrin', 'מהדרין', 'badatz', 'בד"ץ'];
  const searchText = [
    name,
    details.formatted_address || '',
    ...(details.reviews || []).map((r: any) => r.text || ''),
  ].join(' ').toLowerCase();
  
  return kosherKeywords.some(kw => searchText.includes(kw.toLowerCase()));
}

function detectVegetarian(name: string, details: any): boolean {
  const vegKeywords = ['vegan', 'vegetarian', 'plant-based', 'טבעוני', 'צמחוני', 'plant based'];
  const searchText = [
    name,
    ...(details.reviews || []).map((r: any) => r.text || ''),
  ].join(' ').toLowerCase();
  
  return vegKeywords.some(kw => searchText.includes(kw.toLowerCase()));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        await sleep(delayMs * attempt); // Exponential backoff
      }
    }
  }
  
  throw lastError;
}

// ========================================
// GET - Status endpoint
// ========================================

export async function GET() {
  try {
    const supabase = await createClient();

    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from('restaurant_cache')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return NextResponse.json({ error: 'Failed to get cache status' }, { status: 500 });
    }

    // Get count with embeddings
    const { count: withEmbeddings } = await supabase
      .from('restaurant_cache')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);

    // Get city breakdown
    const { data: restaurants } = await supabase
      .from('restaurant_cache')
      .select('city');

    const cityStats: Record<string, number> = {};
    (restaurants || []).forEach((r: any) => {
      const city = r.city || 'Unknown';
      cityStats[city] = (cityStats[city] || 0) + 1;
    });

    // Sort cities by count
    const sortedCities = Object.entries(cityStats)
      .sort(([, a], [, b]) => b - a)
      .reduce((acc, [city, count]) => ({ ...acc, [city]: count }), {});

    return NextResponse.json({
      totalRestaurants: totalCount || 0,
      restaurantsWithEmbeddings: withEmbeddings || 0,
      cityCounts: sortedCities,
      lastChecked: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting cache status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
