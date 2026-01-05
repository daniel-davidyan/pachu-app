import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

/**
 * POST /api/agent/recommend
 * 
 * Full recommendation pipeline:
 * 1. Hard filters (location, opening hours)
 * 2. Vector search
 * 3. Re-ranking with social signals
 * 4. LLM final selection with reasons
 */

interface RecommendationContext {
  where: string | null;           // 'walking_distance' | 'willing_to_travel' | 'outside_city' | specific location
  withWho: string | null;         // 'date' | 'friends' | 'family' | 'solo' | 'work'
  purpose: string | null;         // 'romantic_dinner' | 'casual_meal' | 'quick_bite' | 'drinks' | 'celebration' | 'business'
  budget: string | null;          // 'cheap' | 'moderate' | 'expensive' | 'any'
  when: string | null;            // 'now' | 'tonight' | 'tomorrow' | 'weekend'
  cuisinePreference: string | null;
}

interface Restaurant {
  id: string;
  google_place_id: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  google_rating: number;
  google_reviews_count: number;
  price_level: number;
  categories: string[];
  summary: string;
  opening_hours: any;
  photos: any[];
  distance?: number;
  vectorScore?: number;
  socialScore?: number;
  finalScore?: number;
  friendsWhoVisited?: string[];
}

interface Recommendation {
  restaurant: Restaurant;
  reason: string;
  matchScore: number;
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await request.json();
    const {
      context,
      userLocation,       // { lat, lng }
      conversationSummary, // Text summary of what user is looking for
    } = body;

    if (!context || !userLocation) {
      return NextResponse.json(
        { error: 'context and userLocation are required' },
        { status: 400 }
      );
    }

    console.log('🔍 Starting recommendation pipeline...');
    console.log('📍 Context:', context);
    console.log('📍 User location:', userLocation);

    // ========================================
    // STEP 1: HARD FILTERS (Location + Hours)
    // ========================================
    const filteredRestaurants = await applyHardFilters(
      supabase,
      userLocation,
      context
    );

    console.log(`📊 After hard filters: ${filteredRestaurants.length} restaurants`);

    if (filteredRestaurants.length === 0) {
      return NextResponse.json({
        recommendations: [],
        message: 'לא מצאתי מסעדות שעונות לקריטריונים. אולי תנסה להרחיב את החיפוש?',
      });
    }

    // ========================================
    // STEP 2: VECTOR SEARCH
    // ========================================
    const queryText = buildQueryText(context, conversationSummary);
    const vectorResults = await performVectorSearch(
      supabase,
      filteredRestaurants,
      queryText,
      user?.id
    );

    console.log(`📊 After vector search: ${vectorResults.length} restaurants scored`);

    // ========================================
    // STEP 3: RE-RANKING (Social signals + friends)
    // ========================================
    const rerankedResults = await rerank(
      supabase,
      vectorResults,
      user?.id,
      context
    );

    console.log(`📊 After re-ranking: ${rerankedResults.length} restaurants`);

    // ========================================
    // STEP 4: LLM FINAL SELECTION
    // ========================================
    const topCandidates = rerankedResults.slice(0, 15); // Send top 15 to LLM
    const recommendations = await selectWithLLM(
      topCandidates,
      context,
      conversationSummary
    );

    console.log(`✅ Final recommendations: ${recommendations.length}`);

    return NextResponse.json({
      recommendations,
      totalConsidered: filteredRestaurants.length,
      message: generateResultMessage(recommendations, context),
    });

  } catch (error) {
    console.error('Recommendation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}

// ============================================
// STEP 1: Hard Filters
// ============================================

// Tel Aviv city center coordinates
const TEL_AVIV_CENTER = { lat: 32.0853, lng: 34.7818 };

// Check if location is valid (in Israel area)
function isValidIsraelLocation(lat: number, lng: number): boolean {
  // Israel bounding box approximately
  return lat >= 29.5 && lat <= 33.5 && lng >= 34 && lng <= 36;
}

async function applyHardFilters(
  supabase: any,
  userLocation: { lat: number; lng: number },
  context: RecommendationContext
): Promise<Restaurant[]> {
  
  // Determine radius based on "where"
  let radiusMeters = 10000; // Default 10km
  let effectiveLocation = userLocation;
  
  // Handle different "where" values
  const whereValue = context.where?.toLowerCase() || '';
  
  // Check for Hebrew or English city names
  if (whereValue.includes('תל אביב') || whereValue.includes('tel aviv')) {
    // User specified Tel Aviv - use city center
    effectiveLocation = TEL_AVIV_CENTER;
    radiusMeters = 15000; // 15km to cover all of Tel Aviv
  } else if (whereValue === 'walking_distance' || whereValue.includes('הליכה')) {
    radiusMeters = 3000; // 3km - reasonable walking distance
  } else if (whereValue === 'willing_to_travel' || whereValue.includes('נסוע') || whereValue.includes('לנסוע')) {
    radiusMeters = 20000; // 20km
  } else if (whereValue === 'outside_city' || whereValue.includes('מחוץ') || whereValue.includes('חוץ')) {
    radiusMeters = 50000; // 50km
  }
  
  // If user location is not in Israel, use Tel Aviv center
  if (!isValidIsraelLocation(effectiveLocation.lat, effectiveLocation.lng)) {
    console.log(`⚠️ Invalid location detected, using Tel Aviv center`);
    effectiveLocation = TEL_AVIV_CENTER;
  }
  
  console.log(`🎯 Using radius: ${radiusMeters}m, location: (${effectiveLocation.lat}, ${effectiveLocation.lng})`);

  // Build query - support both 'Tel Aviv' and 'Tel Aviv-Yafo'
  let query = supabase
    .from('restaurant_cache')
    .select('*')
    .or('city.eq.Tel Aviv,city.eq.Tel Aviv-Yafo')
    .not('summary_embedding', 'is', null);

  // Budget filter (price_level)
  if (context.budget && context.budget !== 'any') {
    const priceMap: Record<string, number[]> = {
      'cheap': [1],
      'moderate': [1, 2],
      'expensive': [3, 4],
    };
    const priceLevels = priceMap[context.budget];
    if (priceLevels) {
      query = query.in('price_level', priceLevels);
    }
  }

  const { data: restaurants, error } = await query;

  if (error) {
    console.error('Hard filter query error:', error);
    return [];
  }

  console.log(`📊 Query returned ${restaurants?.length || 0} restaurants`);

  // Filter by distance (PostGIS would be better but we'll do it in JS)
  const filtered = (restaurants || []).filter((r: any) => {
    if (!r.latitude || !r.longitude) return false;
    
    const distance = calculateDistance(
      effectiveLocation.lat,
      effectiveLocation.lng,
      r.latitude,
      r.longitude
    );
    
    r.distance = distance;
    return distance <= radiusMeters;
  });

  // Check opening hours (if "when" is specified)
  if (context.when === 'now') {
    return filtered.filter((r: any) => isOpenNow(r.opening_hours));
  }

  return filtered;
}

// ============================================
// STEP 2: Vector Search
// ============================================
async function performVectorSearch(
  supabase: any,
  restaurants: Restaurant[],
  queryText: string,
  userId?: string
): Promise<Restaurant[]> {
  
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(queryText);
  
  // Get user's combined embedding if logged in
  let userEmbedding: number[] | null = null;
  if (userId) {
    const { data: profile } = await supabase
      .from('user_taste_profiles')
      .select('combined_embedding, onboarding_embedding')
      .eq('user_id', userId)
      .single();
    
    if (profile?.combined_embedding) {
      userEmbedding = profile.combined_embedding;
    } else if (profile?.onboarding_embedding) {
      userEmbedding = profile.onboarding_embedding;
    }
  }

  // Combine query and user embeddings (70% query, 30% user)
  const finalEmbedding = userEmbedding
    ? combineEmbeddings(queryEmbedding, userEmbedding, 0.7, 0.3)
    : queryEmbedding;

  // Score each restaurant
  const restaurantIds = restaurants.map(r => r.id);
  
  // Get embeddings for filtered restaurants
  const { data: embeddings } = await supabase
    .from('restaurant_cache')
    .select('id, summary_embedding, reviews_embedding')
    .in('id', restaurantIds);

  const embeddingMap = new Map<string, { id: string; summary_embedding: number[] | null; reviews_embedding: number[] | null }>(
    (embeddings || []).map((e: any) => [e.id, e])
  );

  // Calculate vector scores
  const scored = restaurants.map(r => {
    const embData = embeddingMap.get(r.id);
    if (!embData || !embData.summary_embedding) {
      r.vectorScore = 0;
      return r;
    }

    // Score against summary embedding (primary)
    const summaryScore = cosineSimilarity(finalEmbedding, embData.summary_embedding);
    
    // Score against reviews embedding (secondary, if exists)
    let reviewsScore = 0;
    if (embData.reviews_embedding) {
      reviewsScore = cosineSimilarity(finalEmbedding, embData.reviews_embedding);
    }

    // Weighted combination: 70% summary, 30% reviews
    r.vectorScore = summaryScore * 0.7 + reviewsScore * 0.3;
    return r;
  });

  // Sort by vector score
  return scored.sort((a, b) => (b.vectorScore || 0) - (a.vectorScore || 0));
}

// ============================================
// STEP 3: Re-ranking
// ============================================
async function rerank(
  supabase: any,
  restaurants: Restaurant[],
  userId: string | undefined,
  context: RecommendationContext
): Promise<Restaurant[]> {
  
  // Get friends' reviews if user is logged in
  let friendsReviews: Map<string, string[]> = new Map();
  if (userId) {
    friendsReviews = await getFriendsReviews(supabase, userId);
  }

  // Re-score with social signals
  const reranked = restaurants.map(r => {
    let socialScore = 0;

    // Boost if friends visited
    const friendsWhoVisited = friendsReviews.get(r.google_place_id) || [];
    if (friendsWhoVisited.length > 0) {
      socialScore += 0.2 * Math.min(friendsWhoVisited.length, 3); // Max 0.6 boost
      r.friendsWhoVisited = friendsWhoVisited;
    }

    // Boost based on Google rating
    if (r.google_rating >= 4.5) socialScore += 0.1;
    else if (r.google_rating >= 4.0) socialScore += 0.05;

    // Boost for high review count (popular places)
    if (r.google_reviews_count > 1000) socialScore += 0.1;
    else if (r.google_reviews_count > 500) socialScore += 0.05;

    // Penalize for distance (prefer closer)
    if (r.distance) {
      const distanceKm = r.distance / 1000;
      socialScore -= distanceKm * 0.01; // Small penalty per km
    }

    // Occasion-based boosts
    if (context.withWho === 'date' && r.google_rating >= 4.3) {
      socialScore += 0.1; // Prefer higher-rated for dates
    }
    if (context.purpose === 'quick_bite' && r.price_level && r.price_level <= 2) {
      socialScore += 0.1; // Prefer cheaper for quick bites
    }

    r.socialScore = socialScore;
    r.finalScore = (r.vectorScore || 0) + socialScore;
    return r;
  });

  // Sort by final score
  return reranked.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
}

// ============================================
// STEP 4: LLM Selection
// ============================================
async function selectWithLLM(
  candidates: Restaurant[],
  context: RecommendationContext,
  conversationSummary?: string
): Promise<Recommendation[]> {
  
  if (candidates.length === 0) return [];

  // Build prompt
  const restaurantList = candidates.map((r, i) => {
    const parts = [
      `${i + 1}. ${r.name}`,
      `   Categories: ${(r.categories || []).join(', ')}`,
      `   Rating: ${r.google_rating}/5 (${r.google_reviews_count} reviews)`,
      `   Price: ${'$'.repeat(r.price_level || 2)}`,
      `   Distance: ${r.distance ? Math.round(r.distance / 100) / 10 + 'km' : 'unknown'}`,
      `   Summary: ${r.summary || 'No description'}`,
    ];
    if (r.friendsWhoVisited?.length) {
      parts.push(`   Friends who visited: ${r.friendsWhoVisited.join(', ')}`);
    }
    return parts.join('\n');
  }).join('\n\n');

  const contextDesc = buildContextDescription(context);

  const prompt = `You are a restaurant recommendation expert in Tel Aviv.

User is looking for: ${contextDesc}
${conversationSummary ? `Additional context: ${conversationSummary}` : ''}

Here are the top candidates:

${restaurantList}

Select the TOP 3 best matches and explain why each is a good fit.
Be specific about why each restaurant matches what the user is looking for.

Return ONLY a JSON array:
[
  {
    "index": 1,
    "reason": "Hebrew explanation why this is perfect for them (1-2 sentences)"
  },
  ...
]`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 500,
  });

  try {
    const responseText = response.choices[0].message.content || '[]';
    const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const selections = JSON.parse(cleaned);

    return selections.slice(0, 3).map((sel: any) => {
      const restaurant = candidates[sel.index - 1];
      return {
        restaurant,
        reason: sel.reason,
        matchScore: Math.round((restaurant.finalScore || 0.5) * 100),
      };
    });
  } catch (e) {
    // Fallback: return top 3 with generic reasons
    return candidates.slice(0, 3).map(r => ({
      restaurant: r,
      reason: `מתאים למה שחיפשת - ${r.google_rating}/5 דירוג`,
      matchScore: Math.round((r.finalScore || 0.5) * 100),
    }));
  }
}

// ============================================
// Helper Functions
// ============================================

function buildQueryText(context: RecommendationContext, conversationSummary?: string): string {
  const parts: string[] = [];

  if (context.cuisinePreference) {
    parts.push(`${context.cuisinePreference} food`);
  }

  if (context.withWho) {
    const whoMap: Record<string, string> = {
      'date': 'romantic dinner for two',
      'friends': 'casual dinner with friends',
      'family': 'family-friendly restaurant',
      'solo': 'comfortable solo dining',
      'work': 'business meeting venue',
    };
    parts.push(whoMap[context.withWho] || context.withWho);
  }

  if (context.purpose) {
    const purposeMap: Record<string, string> = {
      'romantic_dinner': 'romantic atmosphere',
      'casual_meal': 'casual relaxed vibe',
      'quick_bite': 'quick service',
      'drinks': 'good bar drinks',
      'celebration': 'celebration special occasion',
      'business': 'professional atmosphere',
    };
    parts.push(purposeMap[context.purpose] || context.purpose);
  }

  if (context.budget) {
    const budgetMap: Record<string, string> = {
      'cheap': 'budget friendly affordable',
      'moderate': 'mid-range prices',
      'expensive': 'upscale fine dining',
    };
    parts.push(budgetMap[context.budget] || '');
  }

  if (conversationSummary) {
    parts.push(conversationSummary);
  }

  return parts.filter(Boolean).join('. ') || 'restaurant in Tel Aviv';
}

function buildContextDescription(context: RecommendationContext): string {
  const parts: string[] = [];

  if (context.withWho) {
    const whoMap: Record<string, string> = {
      'date': 'דייט',
      'friends': 'יציאה עם חברים',
      'family': 'ארוחה משפחתית',
      'solo': 'לבד',
      'work': 'פגישת עבודה',
    };
    parts.push(whoMap[context.withWho] || context.withWho);
  }

  if (context.cuisinePreference) {
    parts.push(`אוכל ${context.cuisinePreference}`);
  }

  if (context.budget) {
    const budgetMap: Record<string, string> = {
      'cheap': 'תקציב נמוך',
      'moderate': 'תקציב בינוני',
      'expensive': 'לא מוגבל בתקציב',
    };
    parts.push(budgetMap[context.budget] || '');
  }

  if (context.where) {
    const whereMap: Record<string, string> = {
      'walking_distance': 'במרחק הליכה',
      'willing_to_travel': 'מוכן לנסוע',
      'outside_city': 'מחוץ לעיר',
    };
    parts.push(whereMap[context.where] || context.where);
  }

  return parts.filter(Boolean).join(', ') || 'מסעדה בתל אביב';
}

function generateResultMessage(recommendations: Recommendation[], context: RecommendationContext): string {
  if (recommendations.length === 0) {
    return 'לא מצאתי התאמות מושלמות, אבל אולי תרצה לשנות קצת את הקריטריונים?';
  }

  const intro = context.withWho === 'date' 
    ? 'מצאתי לכם כמה מקומות מושלמים לדייט! 💕'
    : context.withWho === 'friends'
    ? 'הנה כמה מקומות מעולים ליציאה עם חברים! 🎉'
    : 'הנה ההמלצות שלי! 🍽️';

  return intro;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

function combineEmbeddings(
  emb1: number[],
  emb2: number[],
  weight1: number,
  weight2: number
): number[] {
  return emb1.map((val, i) => val * weight1 + emb2[i] * weight2);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function isOpenNow(openingHours: any): boolean {
  if (!openingHours) return true; // Assume open if no data
  
  const now = new Date();
  const day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  const currentTime = now.getHours() * 100 + now.getMinutes();
  
  const todayHours = openingHours[day];
  if (!todayHours) return true;
  
  // Simple check - could be improved
  if (todayHours.open && todayHours.close) {
    const open = parseInt(todayHours.open.replace(':', ''));
    const close = parseInt(todayHours.close.replace(':', ''));
    return currentTime >= open && currentTime <= close;
  }
  
  return true;
}

async function getFriendsReviews(supabase: any, userId: string): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  
  // Get user's friends
  const { data: friendships } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', userId)
    .eq('status', 'accepted');
  
  if (!friendships?.length) return result;
  
  const friendIds = friendships.map((f: any) => f.friend_id);
  
  // Get friends' reviews
  const { data: reviews } = await supabase
    .from('reviews')
    .select(`
      user_id,
      restaurants (google_place_id),
      profiles:user_id (full_name, username)
    `)
    .in('user_id', friendIds)
    .gte('rating', 4); // Only positive reviews
  
  if (!reviews) return result;
  
  // Build map of google_place_id -> friend names
  reviews.forEach((r: any) => {
    const placeId = r.restaurants?.google_place_id;
    if (!placeId) return;
    
    const friendName = r.profiles?.full_name || r.profiles?.username || 'חבר';
    const existing = result.get(placeId) || [];
    if (!existing.includes(friendName)) {
      existing.push(friendName);
      result.set(placeId, existing);
    }
  });
  
  return result;
}
