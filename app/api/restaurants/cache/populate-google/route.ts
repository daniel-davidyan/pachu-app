import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

/**
 * POST /api/restaurants/cache/populate-google
 * 
 * Populates restaurant_cache with Google Places data + LLM enrichment.
 * 
 * Features:
 * - Recursive subdivision to capture >95% of places
 * - LLM-generated categories and summary (optimized for embeddings)
 * - Strict Tel Aviv filtering
 */

// Tel Aviv STRICT boundaries - only Tel Aviv proper
const TEL_AVIV_BOUNDS = {
  south: 32.035,  // Jaffa
  north: 32.135,  // Ramat HaHayal
  west: 34.740,   // Beach
  east: 34.815,   // Before Ramat Gan (tighter!)
};

// Food & drink place types (NO night_club)
const PLACE_TYPES = [
  'restaurant',
  'cafe', 
  'bar',
  'bakery',
  'meal_delivery',
  'meal_takeaway',
];

// Valid categories for LLM to choose from
const VALID_CATEGORIES = [
  // Cuisine
  'Israeli', 'Mediterranean', 'Middle Eastern', 'Italian', 'Asian', 'Japanese', 
  'Chinese', 'Thai', 'Indian', 'Mexican', 'American', 'French', 'Greek', 
  'Turkish', 'Georgian', 'Moroccan', 'Ethiopian',
  // Food type
  'Hummus', 'Falafel', 'Shawarma', 'Sushi', 'Pizza', 'Burger', 'Steak', 
  'Seafood', 'Salads', 'Vegan', 'Vegetarian', 'Kosher', 'Brunch', 'Breakfast',
  // Venue type
  'Fine Dining', 'Casual', 'Fast Food', 'Cafe', 'Bar', 'Wine Bar', 'Pub',
  'Bakery', 'Desserts', 'Ice Cream', 'Juice Bar',
  // Vibe
  'Romantic', 'Family Friendly', 'Business', 'Trendy', 'Cozy', 'Outdoor Seating',
];

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!googleApiKey) {
      return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
    }
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const body = await request.json().catch(() => ({}));
    const { 
      delayMs = 300,
      testMode = false,
      testLat,
      testLng,
      testRadius = 1000,
    } = body;

    // Stats
    let apiCalls = 0;
    let llmCalls = 0;
    let found = 0;
    let saved = 0;
    let filtered = 0;
    let subdivisions = 0;
    const seenIds = new Set<string>();

    console.log('========================================');
    console.log('🚀 RESTAURANT IMPORT - TEL AVIV');
    console.log('📍 With LLM enrichment (categories + summary)');
    if (testMode) {
      console.log(`🧪 TEST MODE: (${testLat}, ${testLng}) r=${testRadius}m`);
    }
    console.log('========================================');

    // Initial grid
    let initialGrid: Array<{ lat: number; lng: number; radius: number }>;
    
    if (testMode && testLat && testLng) {
      initialGrid = [{ lat: testLat, lng: testLng, radius: testRadius }];
    } else {
      initialGrid = generateGrid(TEL_AVIV_BOUNDS, 5, 4, 1500);
    }
    
    console.log(`📍 Starting with ${initialGrid.length} areas`);

    const queue = [...initialGrid];
    let processed = 0;

    while (queue.length > 0) {
      const area = queue.shift()!;
      processed++;

      console.log(`\n[${processed}] Scanning (${area.lat.toFixed(4)}, ${area.lng.toFixed(4)}) r=${area.radius}m`);

      // Fetch from Google
      const { results, hitLimit } = await fetchNearby(googleApiKey, area.lat, area.lng, area.radius);
      apiCalls += PLACE_TYPES.length;

      // Filter: new + strictly within Tel Aviv bounds
      const newPlaces = results.filter(p => {
        if (seenIds.has(p.place_id)) return false;
        const lat = p.geometry?.location?.lat;
        const lng = p.geometry?.location?.lng;
        if (!lat || !lng) return false;
        
        // Strict Tel Aviv bounds check (unless test mode)
        if (!testMode) {
          if (lat < TEL_AVIV_BOUNDS.south || lat > TEL_AVIV_BOUNDS.north) {
            filtered++;
            return false;
          }
          if (lng < TEL_AVIV_BOUNDS.west || lng > TEL_AVIV_BOUNDS.east) {
            filtered++;
            return false;
          }
        }
        
        seenIds.add(p.place_id);
        return true;
      });

      found += newPlaces.length;
      console.log(`   Found: ${results.length} total, ${newPlaces.length} in TLV, ${results.length - newPlaces.length} filtered`);

      // Subdivide if hit limit
      if (hitLimit && area.radius > 300) {
        subdivisions++;
        const subs = subdivideArea(area);
        queue.push(...subs);
        console.log(`   ⚠️ Hit 60 limit → subdivided (queue: ${queue.length})`);
      }

      // Process each place
      for (const place of newPlaces) {
        try {
          await sleep(delayMs);
          
          // Fetch details from Google
          const details = await fetchDetails(googleApiKey, place.place_id);
          apiCalls++;

          // Get reviews for LLM
          const reviews = (details.reviews || []).slice(0, 5);
          const reviewTexts = reviews.map((r: any) => r.text).filter(Boolean);

          // Generate categories and summary via LLM
          let categories: string[] = [];
          let summary: string | null = null;

          if (reviewTexts.length > 0) {
            const llmResult = await generateCategoriesAndSummary(openai, place.name, reviewTexts);
            categories = llmResult.categories;
            summary = llmResult.summary;
            llmCalls++;
          }

          // Save to database
          await saveRestaurant(supabase, place, details, categories, summary);
          saved++;
          console.log(`   ✅ ${place.name} [${categories.join(', ')}]`);
        } catch (err) {
          console.error(`   ❌ ${place.name}:`, err);
        }
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    const googleCost = ((apiCalls / 1000) * 17).toFixed(2);
    const llmCost = ((llmCalls * 0.001)).toFixed(2); // ~$0.001 per call

    console.log('\n========================================');
    console.log('✅ COMPLETE!');
    console.log(`📊 Areas: ${processed} (${subdivisions} subdivisions)`);
    console.log(`📊 Found: ${found} | Saved: ${saved} | Filtered: ${filtered}`);
    console.log(`📊 Google API: ${apiCalls} calls (~$${googleCost})`);
    console.log(`📊 LLM calls: ${llmCalls} (~$${llmCost})`);
    console.log(`⏱️ Duration: ${formatTime(duration)}`);
    console.log('========================================');

    return NextResponse.json({
      success: true,
      stats: { processed, subdivisions, found, saved, filtered, apiCalls, llmCalls },
      cost: { google: `$${googleCost}`, llm: `$${llmCost}` },
      duration,
    });
  } catch (error) {
    console.error('Fatal:', error);
    return NextResponse.json({ error: 'Failed', details: String(error) }, { status: 500 });
  }
}

// Generate categories and summary using LLM
async function generateCategoriesAndSummary(
  openai: OpenAI,
  name: string,
  reviews: string[]
): Promise<{ categories: string[]; summary: string }> {
  const reviewsText = reviews.map((r, i) => `Review ${i + 1}: ${r}`).join('\n\n');

  const prompt = `Analyze this restaurant and its reviews to extract information for a recommendation system.

Restaurant: ${name}

Reviews:
${reviewsText}

Based on the reviews, provide:

1. CATEGORIES: Select 3-6 relevant categories from this list ONLY:
${VALID_CATEGORIES.join(', ')}

2. SUMMARY: Write a 2-3 sentence summary that captures:
- Type of food/cuisine
- Atmosphere and vibe
- What people love about it
- Who would enjoy it (couples, families, business, friends)
- Price/value perception if mentioned

The summary should be optimized for matching with user preferences like "romantic dinner", "quick lunch", "family friendly", "trendy bar", etc.

Respond in JSON format:
{"categories": ["Cat1", "Cat2", ...], "summary": "..."}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 300,
    });

    const content = response.choices[0].message.content?.trim() || '';
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    // Validate categories
    const validCategories = (parsed.categories || [])
      .filter((c: string) => VALID_CATEGORIES.includes(c))
      .slice(0, 6);

    return {
      categories: validCategories,
      summary: parsed.summary || '',
    };
  } catch (error) {
    console.error('   LLM error:', error);
    return { categories: [], summary: '' };
  }
}

// Generate grid of points
function generateGrid(bounds: typeof TEL_AVIV_BOUNDS, rows: number, cols: number, radius: number) {
  const grid: Array<{ lat: number; lng: number; radius: number }> = [];
  const latStep = (bounds.north - bounds.south) / rows;
  const lngStep = (bounds.east - bounds.west) / cols;

  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= cols; j++) {
      grid.push({
        lat: Math.round((bounds.south + i * latStep) * 10000) / 10000,
        lng: Math.round((bounds.west + j * lngStep) * 10000) / 10000,
        radius,
      });
    }
  }
  return grid;
}

// Subdivide area into 4 quadrants
function subdivideArea(area: { lat: number; lng: number; radius: number }) {
  const offset = (area.radius / 1000) / 111 / 2;
  const r = Math.round(area.radius / 2);
  return [
    { lat: area.lat + offset, lng: area.lng - offset, radius: r },
    { lat: area.lat + offset, lng: area.lng + offset, radius: r },
    { lat: area.lat - offset, lng: area.lng - offset, radius: r },
    { lat: area.lat - offset, lng: area.lng + offset, radius: r },
  ];
}

// Fetch nearby for ALL food-related types
async function fetchNearby(apiKey: string, lat: number, lng: number, radius: number) {
  const allResults: any[] = [];
  const seenInThisSearch = new Set<string>();
  let totalHitLimit = false;

  for (const placeType of PLACE_TYPES) {
    const { results, hitLimit } = await fetchNearbyByType(apiKey, lat, lng, radius, placeType);
    
    for (const place of results) {
      if (!seenInThisSearch.has(place.place_id)) {
        seenInThisSearch.add(place.place_id);
        allResults.push(place);
      }
    }
    
    if (hitLimit) totalHitLimit = true;
    await sleep(300);
  }

  return { results: allResults, hitLimit: totalHitLimit };
}

// Fetch nearby for a single type
async function fetchNearbyByType(apiKey: string, lat: number, lng: number, radius: number, placeType: string) {
  const results: any[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  do {
    const url = pageToken
      ? `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${pageToken}&key=${apiKey}`
      : `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${placeType}&key=${apiKey}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'OK') {
      results.push(...data.results);
    } else if (data.status !== 'ZERO_RESULTS') {
      if (data.status === 'INVALID_REQUEST' && pageToken) {
        await sleep(2000);
        continue;
      }
      break;
    }

    pageToken = data.next_page_token;
    pages++;
    if (pageToken && pages < 3) await sleep(2000);
  } while (pageToken && pages < 3);

  return { results, hitLimit: results.length >= 60 };
}

// Fetch place details
async function fetchDetails(apiKey: string, placeId: string) {
  const fields = [
    'name', 'formatted_address', 'formatted_phone_number', 'website',
    'opening_hours', 'business_status', 'price_level', 'rating',
    'user_ratings_total', 'reviews', 'photos'
  ].join(',');

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}&language=en`;
  const res = await fetch(url);
  const data = await res.json();
  return data.status === 'OK' ? data.result : {};
}

// Save to database
async function saveRestaurant(
  supabase: any,
  place: any,
  details: any,
  categories: string[],
  summary: string | null
) {
  const data = {
    google_place_id: place.place_id,
    name: details.name || place.name,
    country: 'Israel',
    city: 'Tel Aviv',
    address: details.formatted_address || place.vicinity,
    latitude: place.geometry.location.lat,
    longitude: place.geometry.location.lng,
    phone: details.formatted_phone_number || null,
    website: details.website || null,
    google_rating: details.rating || place.rating || null,
    google_reviews_count: details.user_ratings_total || place.user_ratings_total || 0,
    price_level: details.price_level ?? place.price_level ?? null,
    categories: categories.length > 0 ? categories : null,
    summary: summary || null,
    business_status: details.business_status || 'OPERATIONAL',
    opening_hours: details.opening_hours ? {
      periods: details.opening_hours.periods,
      weekday_text: details.opening_hours.weekday_text,
    } : null,
    photos: (details.photos || []).slice(0, 10).map((p: any) => ({
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
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('restaurant_cache')
    .upsert(data, { onConflict: 'google_place_id' });

  if (error) throw error;
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// GET - Status
export async function GET() {
  const supabase = await createClient();
  const { count } = await supabase.from('restaurant_cache').select('*', { count: 'exact', head: true });
  return NextResponse.json({ restaurants: count || 0 });
}
