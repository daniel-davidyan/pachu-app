/**
 * Restaurant Enrichment Helper
 * 
 * This module handles the full enrichment of a restaurant when a user
 * writes a review or saves it to their wishlist. It fetches full details
 * from Google Places API, generates an LLM summary, creates embeddings,
 * and stores everything in the restaurant_cache table.
 */

import OpenAI from 'openai';

// Valid categories for the restaurant (used in LLM prompt)
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

interface GooglePlaceDetails {
  name: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  opening_hours?: {
    periods?: any[];
    weekday_text?: string[];
  };
  reviews?: Array<{
    author_name: string;
    rating: number;
    text: string;
    time: number;
    language?: string;
  }>;
  photos?: Array<{
    photo_reference: string;
    width: number;
    height: number;
  }>;
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types?: string[];
  business_status?: string;
}

/**
 * Fetch full place details from Google Places API
 */
async function fetchGooglePlaceDetails(googlePlaceId: string): Promise<GooglePlaceDetails | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('[Enrichment] Google API key not configured');
    return null;
  }

  const fields = [
    'name', 'formatted_address', 'formatted_phone_number', 'website',
    'opening_hours', 'business_status', 'price_level', 'rating',
    'user_ratings_total', 'reviews', 'photos', 'geometry', 'types'
  ].join(',');

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${googlePlaceId}&fields=${fields}&key=${apiKey}&language=en`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('[Enrichment] Google Places API error:', data.status);
      return null;
    }

    return data.result;
  } catch (error) {
    console.error('[Enrichment] Error fetching place details:', error);
    return null;
  }
}

/**
 * Generate categories and summary using LLM
 */
async function generateCategoriesAndSummary(
  openai: OpenAI,
  name: string,
  reviews: string[]
): Promise<{ categories: string[]; summary: string }> {
  const reviewsText = reviews.map((r, i) => `Review ${i + 1}: ${r}`).join('\n\n');

  const prompt = `Analyze this restaurant and its reviews to extract information for a recommendation system.

Restaurant: ${name}

Reviews:
${reviewsText || 'No reviews available'}

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
      summary: parsed.summary || `${name} is a restaurant.`,
    };
  } catch (error) {
    console.error('[Enrichment] LLM error:', error);
    return { categories: [], summary: `${name} is a restaurant.` };
  }
}

/**
 * Generate embedding using OpenAI text-embedding-3-small
 */
async function generateEmbedding(openai: OpenAI, text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: 1536,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('[Enrichment] Embedding error:', error);
    throw error;
  }
}

/**
 * Extract reviews text for embedding generation
 */
function extractReviewsText(reviews: GooglePlaceDetails['reviews']): string {
  if (!reviews || reviews.length === 0) {
    return '';
  }

  const reviewTexts = reviews
    .map(review => review.text || '')
    .filter(text => text.length > 0);

  // Join with separator and limit to ~6000 characters
  return reviewTexts.join(' | ').substring(0, 6000);
}

/**
 * Main function: Enrich a restaurant and add to cache
 * 
 * This function is designed to run in the background and not block the main request.
 * It will:
 * 1. Check if restaurant is already in cache
 * 2. Fetch full details from Google Places API
 * 3. Generate LLM summary and categories
 * 4. Generate embeddings for summary and reviews
 * 5. Insert/update the restaurant_cache table
 */
export async function enrichAndCacheRestaurant(
  googlePlaceId: string,
  supabase: any
): Promise<boolean> {
  console.log(`[Enrichment] Starting enrichment for place: ${googlePlaceId}`);

  try {
    // 1. Check if already in restaurant_cache
    const { data: existing } = await supabase
      .from('restaurant_cache')
      .select('id, updated_at')
      .eq('google_place_id', googlePlaceId)
      .single();

    if (existing) {
      // Check if it was updated recently (within last 7 days)
      const lastUpdate = new Date(existing.updated_at);
      const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceUpdate < 7) {
        console.log(`[Enrichment] Restaurant already in cache and recent, skipping: ${googlePlaceId}`);
        return true;
      }
      console.log(`[Enrichment] Restaurant in cache but stale (${daysSinceUpdate.toFixed(1)} days), updating...`);
    }

    // 2. Fetch full details from Google Places API
    const details = await fetchGooglePlaceDetails(googlePlaceId);
    if (!details) {
      console.error(`[Enrichment] Could not fetch details for: ${googlePlaceId}`);
      return false;
    }

    console.log(`[Enrichment] Fetched details for: ${details.name}`);

    // 3. Initialize OpenAI client
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('[Enrichment] OpenAI API key not configured');
      return false;
    }
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // 4. Generate LLM summary and categories
    const reviewTexts = (details.reviews || [])
      .map(r => r.text)
      .filter(Boolean)
      .slice(0, 5);

    const { categories, summary } = await generateCategoriesAndSummary(
      openai,
      details.name,
      reviewTexts
    );

    console.log(`[Enrichment] Generated summary and categories for: ${details.name}`);

    // 5. Generate embeddings
    let summaryEmbedding: number[] | null = null;
    let reviewsEmbedding: number[] | null = null;
    let reviewsText: string | null = null;

    if (summary) {
      summaryEmbedding = await generateEmbedding(openai, summary);
    }

    reviewsText = extractReviewsText(details.reviews);
    if (reviewsText && reviewsText.length > 50) {
      reviewsEmbedding = await generateEmbedding(openai, reviewsText);
    }

    console.log(`[Enrichment] Generated embeddings for: ${details.name}`);

    // 6. Prepare data for insertion
    const cacheData = {
      google_place_id: googlePlaceId,
      name: details.name,
      address: details.formatted_address || null,
      city: 'Tel Aviv', // Default, could be extracted from address
      latitude: details.geometry?.location?.lat || null,
      longitude: details.geometry?.location?.lng || null,
      phone: details.formatted_phone_number || null,
      website: details.website || null,
      google_rating: details.rating || null,
      google_reviews_count: details.user_ratings_total || 0,
      price_level: details.price_level || null,
      categories: categories.length > 0 ? categories : null,
      business_status: details.business_status || 'OPERATIONAL',
      opening_hours: details.opening_hours ? {
        periods: details.opening_hours.periods,
        weekday_text: details.opening_hours.weekday_text,
      } : null,
      photos: (details.photos || []).slice(0, 10).map(p => ({
        photo_reference: p.photo_reference,
        width: p.width,
        height: p.height,
      })),
      google_reviews: (details.reviews || []).slice(0, 5).map(r => ({
        author_name: r.author_name,
        rating: r.rating,
        text: r.text,
        time: r.time,
        language: r.language,
      })),
      summary: summary || null,
      summary_embedding: summaryEmbedding,
      reviews_text: reviewsText || null,
      reviews_embedding: reviewsEmbedding,
      updated_at: new Date().toISOString(),
    };

    // 7. Upsert to restaurant_cache
    const { error } = await supabase
      .from('restaurant_cache')
      .upsert(cacheData, { onConflict: 'google_place_id' });

    if (error) {
      console.error(`[Enrichment] Error saving to cache:`, error);
      return false;
    }

    console.log(`[Enrichment] ✅ Successfully enriched and cached: ${details.name}`);
    return true;
  } catch (error) {
    console.error(`[Enrichment] Error enriching restaurant ${googlePlaceId}:`, error);
    return false;
  }
}
