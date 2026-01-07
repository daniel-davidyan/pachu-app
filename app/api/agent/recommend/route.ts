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

// Note: Debug data access is now controlled by password in the analytics page
// No email whitelist needed anymore

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await request.json();
    const {
      context,
      userLocation,       // { lat, lng }
      conversationSummary, // Text summary of what user is looking for
      includeDebugData,   // If true, include full pipeline data
      userEmail: passedEmail, // Email passed from chat API (for internal calls)
      userId: passedUserId, // UserId passed directly from chat API for personalization
    } = body;

    if (!context || !userLocation) {
      return NextResponse.json(
        { error: 'context and userLocation are required' },
        { status: 400 }
      );
    }

    // Always include debug data when requested (analytics uses password-based access now)
    const userEmail = (passedEmail || user?.email)?.toLowerCase();
    const canDebug = includeDebugData === true; // Simply check if debug data was requested

    // Use passedUserId if user auth didn't work (internal API calls)
    const effectiveUserId = user?.id || passedUserId;
    
    console.log('🔐 Debug access check:', { userEmail, includeDebugData, canDebug });
    console.log('👤 USER AUTH:', { 
      isLoggedIn: !!user, 
      authUserId: user?.id || 'NOT_LOGGED_IN',
      passedUserId: passedUserId || 'NOT_PASSED',
      effectiveUserId: effectiveUserId || 'NONE',
      userEmail: user?.email || 'N/A'
    });
    console.log('🔍 Starting recommendation pipeline...');
    console.log('📍 Context:', context);
    console.log('📍 User location:', userLocation);

    // For debug: get total restaurant count
    let totalInDb = 0;
    if (canDebug) {
      const { count } = await supabase
        .from('restaurant_cache')
        .select('*', { count: 'exact', head: true });
      totalInDb = count || 0;
    }

    // ========================================
    // STEP 1: HARD FILTERS (Location + Hours)
    // ========================================
    const filteredRestaurants = await applyHardFilters(
      supabase,
      userLocation,
      context
    );

    console.log(`📊 After hard filters: ${filteredRestaurants.length} restaurants`);

    // Debug data for step 1 - return ALL restaurants
    const step1Data = canDebug ? {
      totalInDb,
      afterFilter: filteredRestaurants.length,
      sampleRestaurants: filteredRestaurants.map(r => ({
        id: r.id,
        name: r.name,
        city: r.city,
        distance: r.distance ? Math.round(r.distance) : null,
        categories: r.categories,
      })),
    } : undefined;

    if (filteredRestaurants.length === 0) {
      return NextResponse.json({
        recommendations: [],
        message: 'לא מצאתי מסעדות שעונות לקריטריונים. אולי תנסה להרחיב את החיפוש?',
        debugData: canDebug ? { step1: step1Data, step2: null, step3: null, step4: null } : undefined,
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
      effectiveUserId
    );

    console.log(`📊 After vector search: ${vectorResults.length} restaurants scored`);

    // Debug data for step 2 - return ALL scored restaurants
    const step2Data = canDebug ? {
      queryText,
      totalScored: vectorResults.length,
      topByVector: vectorResults.map(r => ({
        id: r.id,
        name: r.name,
        vectorScore: r.vectorScore ? Math.round(r.vectorScore * 10000) / 10000 : 0,
        categories: r.categories,
        city: r.city,
      })),
    } : undefined;

    // ========================================
    // STEP 3: RE-RANKING (Social signals + friends)
    // ========================================
    const rerankedResults = await rerank(
      supabase,
      vectorResults,
      effectiveUserId,
      context
    );

    console.log(`📊 After re-ranking: ${rerankedResults.length} restaurants`);

    // Debug data for step 3 - return ALL reranked restaurants
    const step3Data = canDebug ? {
      totalReranked: rerankedResults.length,
      topByRerank: rerankedResults.map(r => ({
        id: r.id,
        name: r.name,
        city: r.city,
        vectorScore: r.vectorScore ? Math.round(r.vectorScore * 10000) / 10000 : 0,
        socialScore: r.socialScore ? Math.round(r.socialScore * 10000) / 10000 : 0,
        finalScore: r.finalScore ? Math.round(r.finalScore * 10000) / 10000 : 0,
        googleRating: r.google_rating,
        reviewCount: r.google_reviews_count,
        friendsWhoVisited: r.friendsWhoVisited,
        categories: r.categories,
      })),
    } : undefined;

    // ========================================
    // STEP 4: LLM FINAL SELECTION (with Personal Context)
    // ========================================
    const topCandidates = rerankedResults.slice(0, 15); // Send top 15 to LLM
    const recommendations = await selectWithLLM(
      supabase,
      topCandidates,
      context,
      conversationSummary,
      effectiveUserId
    );

    console.log(`✅ Final recommendations: ${recommendations.length}`);

    // Debug data for step 4 - include full info for LLM candidates
    const step4Data = canDebug ? {
      candidatesSentToLLM: topCandidates.map(r => ({
        id: r.id,
        name: r.name,
        city: r.city,
        finalScore: r.finalScore ? Math.round(r.finalScore * 10000) / 10000 : 0,
        categories: r.categories,
        summary: r.summary,
        googleRating: r.google_rating,
        reviewCount: r.google_reviews_count,
      })),
      finalRecommendations: recommendations.map(r => ({
        id: r.restaurant.id,
        name: r.restaurant.name,
        city: r.restaurant.city,
        matchScore: r.matchScore,
        reason: r.reason,
      })),
    } : undefined;

    return NextResponse.json({
      recommendations,
      totalConsidered: filteredRestaurants.length,
      message: generateResultMessage(recommendations, context),
      debugData: canDebug ? {
        step1: step1Data,
        step2: step2Data,
        step3: step3Data,
        step4: step4Data,
      } : undefined,
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

// Our DB coverage area - restaurants we have mapped (central Tel Aviv area)
// ~2km radius from center covers most of our data
const DB_COVERAGE_CENTER = TEL_AVIV_CENTER;
const DB_COVERAGE_RADIUS_KM = 8; // Our restaurants are within ~8km of Tel Aviv center

// Check if user is within our DB coverage area
function isWithinDbCoverage(lat: number, lng: number): boolean {
  const distance = calculateDistance(lat, lng, DB_COVERAGE_CENTER.lat, DB_COVERAGE_CENTER.lng);
  return distance <= DB_COVERAGE_RADIUS_KM * 1000; // Convert km to meters
}

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
  let radiusMeters = 15000; // Default 15km (all of Tel Aviv)
  let effectiveLocation = userLocation;
  
  // Handle different "where" values
  const whereValue = context.where?.toLowerCase() || '';
  
  // Check if user is within our DB coverage (where we have restaurants)
  const userInCoverage = isWithinDbCoverage(userLocation.lat, userLocation.lng);
  
  console.log(`📍 User location: (${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}) - In DB coverage: ${userInCoverage}`);
  
  // LOGIC:
  // 1. User in Tel Aviv + "walking" → search from their location, 2km radius
  // 2. User outside + "Tel Aviv" → search from Tel Aviv center, 15km radius
  // 3. User outside + "walking" → search from their location, 2km radius → will return 0 results (correct!)
  // 4. User outside + "willing to travel" → search from Tel Aviv center
  
  if (whereValue.includes('walking') || whereValue.includes('הליכה') || whereValue === 'nearby') {
    // User wants walking distance - search from THEIR location
    // If they're not in Tel Aviv, this will correctly return 0 results
    radiusMeters = 2000; // 2km - actual walking distance
    // Keep effectiveLocation = userLocation
    console.log(`🚶 Walking distance mode - searching from user's actual location`);
    
  } else if (whereValue.includes('willing') || whereValue.includes('travel') || 
             whereValue.includes('נסוע') || whereValue.includes('לנסוע')) {
    // User willing to travel - search from Tel Aviv center
    effectiveLocation = TEL_AVIV_CENTER;
    radiusMeters = 25000; // 25km
    console.log(`🚗 Travel mode - searching from Tel Aviv center`);
    
  } else if (whereValue.includes('tel_aviv') || whereValue.includes('תל אביב')) {
    // User explicitly wants Tel Aviv
    effectiveLocation = TEL_AVIV_CENTER;
    radiusMeters = 15000; // All of Tel Aviv
    console.log(`🏙️ Tel Aviv mode - searching from Tel Aviv center`);
    
  } else {
    // No specific preference
    if (userInCoverage) {
      // User is in our coverage area - search from their location
      radiusMeters = 5000;
    } else {
      // User is outside - default to Tel Aviv center
      effectiveLocation = TEL_AVIV_CENTER;
      radiusMeters = 15000;
    }
  }
  
  // Safety check - if location is completely invalid, use Tel Aviv center
  if (!isValidIsraelLocation(effectiveLocation.lat, effectiveLocation.lng)) {
    console.log(`⚠️ Invalid location detected, using Tel Aviv center`);
    effectiveLocation = TEL_AVIV_CENTER;
    radiusMeters = 15000;
  }
  
  console.log(`🎯 Final: radius=${radiusMeters}m, location=(${effectiveLocation.lat.toFixed(4)}, ${effectiveLocation.lng.toFixed(4)})`);

  // Build query - support both 'Tel Aviv' and 'Tel Aviv-Yafo'
  // HARD FILTERS: Only distance and opening hours (budget moved to vector/rerank)
  const query = supabase
    .from('restaurant_cache')
    .select('*')
    .or('city.eq.Tel Aviv,city.eq.Tel Aviv-Yafo')
    .not('summary_embedding', 'is', null);

  // NOTE: Budget is NOT a hard filter - it's handled in vector search and reranking
  // This allows restaurants slightly outside budget to still appear if they're perfect matches

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
// STEP 3: Re-ranking (Social + Budget Signals)
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

    // Boost if friends visited (strong social signal)
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

    // Budget preference (soft filter - boost/penalty instead of hard filter)
    if (context.budget && context.budget !== 'any' && r.price_level) {
      const budgetMatch = {
        'cheap': r.price_level === 1 ? 0.15 : r.price_level === 2 ? 0.05 : -0.1,
        'moderate': r.price_level === 2 ? 0.1 : (r.price_level === 1 || r.price_level === 3) ? 0 : -0.05,
        'expensive': r.price_level >= 3 ? 0.15 : r.price_level === 2 ? 0 : -0.1,
      };
      socialScore += budgetMatch[context.budget as keyof typeof budgetMatch] || 0;
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
// STEP 4: LLM Selection (with Personal Context)
// ============================================

interface UserContext {
  firstName: string;
  onboarding: {
    likes: string[];
    dislikes: string[];
    dietary: string[];
    freeText: string;
  } | null;
  recentReviews: {
    restaurantName: string;
    rating: number;
    content: string;
  }[];
  followingNames: string[];
}

async function getUserContextForLLM(
  supabase: any,
  userId?: string
): Promise<UserContext> {
  const emptyContext: UserContext = {
    firstName: '',
    onboarding: null,
    recentReviews: [],
    followingNames: [],
  };

  if (!userId) return emptyContext;

  try {
    // Get user profile and name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', userId)
      .single();

    const firstName = (profile?.full_name || profile?.username || '').split(' ')[0];

    // Get onboarding preferences
    const { data: tasteProfile } = await supabase
      .from('user_taste_profiles')
      .select('likes, dislikes, is_kosher, is_vegetarian, is_vegan, gluten_free, free_text')
      .eq('user_id', userId)
      .single();

    let onboarding = null;
    if (tasteProfile) {
      const dietary: string[] = [];
      if (tasteProfile.is_kosher) dietary.push('כשר');
      if (tasteProfile.is_vegetarian) dietary.push('צמחוני');
      if (tasteProfile.is_vegan) dietary.push('טבעוני');
      if (tasteProfile.gluten_free) dietary.push('ללא גלוטן');

      onboarding = {
        likes: tasteProfile.likes || [],
        dislikes: tasteProfile.dislikes || [],
        dietary,
        freeText: tasteProfile.free_text || '',
      };
    }

    // Get user's recent reviews (last 10)
    const { data: reviews } = await supabase
      .from('reviews')
      .select(`
        rating,
        content,
        restaurants (name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    const recentReviews = (reviews || []).map((r: any) => ({
      restaurantName: r.restaurants?.name || 'Unknown',
      rating: r.rating,
      content: r.content || '',
    }));

    // Get names of people user follows
    const { data: following } = await supabase
      .from('follows')
      .select(`
        following:following_id (
          full_name,
          username
        )
      `)
      .eq('follower_id', userId)
      .limit(20);

    const followingNames = (following || [])
      .map((f: any) => f.following?.full_name || f.following?.username)
      .filter(Boolean);

    return {
      firstName,
      onboarding,
      recentReviews,
      followingNames,
    };
  } catch (error) {
    console.error('Error fetching user context:', error);
    return emptyContext;
  }
}

async function selectWithLLM(
  supabase: any,
  candidates: Restaurant[],
  context: RecommendationContext,
  conversationSummary?: string,
  userId?: string
): Promise<Recommendation[]> {
  
  if (candidates.length === 0) return [];

  // Get user personal context
  const userContext = await getUserContextForLLM(supabase, userId);
  
  // DEBUG: Log what we got for the user
  console.log('🧑 User context for LLM:', {
    userId,
    firstName: userContext.firstName,
    hasOnboarding: !!userContext.onboarding,
    likesCount: userContext.onboarding?.likes?.length || 0,
    dislikesCount: userContext.onboarding?.dislikes?.length || 0,
    dietaryCount: userContext.onboarding?.dietary?.length || 0,
    reviewsCount: userContext.recentReviews.length,
    followingCount: userContext.followingNames.length,
  });

  // Build restaurant list
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
      parts.push(`   👥 Friends who visited: ${r.friendsWhoVisited.join(', ')}`);
    }
    return parts.join('\n');
  }).join('\n\n');

  // Build user profile section
  let userProfileSection = '';
  
  if (userContext.onboarding || userContext.recentReviews.length > 0) {
    userProfileSection = '\n\n=== USER PROFILE (IMPORTANT - USE THIS TO PERSONALIZE!) ===\n';
    
    if (userContext.firstName) {
      userProfileSection += `Name: ${userContext.firstName}\n`;
    }

    if (userContext.onboarding) {
      if (userContext.onboarding.likes.length > 0) {
        userProfileSection += `❤️ Likes: ${userContext.onboarding.likes.join(', ')}\n`;
      }
      if (userContext.onboarding.dislikes.length > 0) {
        userProfileSection += `👎 Dislikes: ${userContext.onboarding.dislikes.join(', ')}\n`;
      }
      if (userContext.onboarding.dietary.length > 0) {
        userProfileSection += `🥗 Dietary: ${userContext.onboarding.dietary.join(', ')}\n`;
      }
      if (userContext.onboarding.freeText) {
        userProfileSection += `📝 Notes: ${userContext.onboarding.freeText}\n`;
      }
    }

    if (userContext.recentReviews.length > 0) {
      userProfileSection += `\n📋 User's Recent Reviews:\n`;
      userContext.recentReviews.slice(0, 5).forEach(review => {
        const stars = '⭐'.repeat(review.rating);
        userProfileSection += `  - ${review.restaurantName}: ${stars} ${review.content ? `"${review.content.substring(0, 80)}..."` : ''}\n`;
      });
    }

    if (userContext.followingNames.length > 0) {
      userProfileSection += `\n👥 Friends they follow: ${userContext.followingNames.slice(0, 5).join(', ')}\n`;
    }
  }

  const contextDesc = buildContextDescription(context);

  const prompt = `You are Pachu, a PERSONAL restaurant recommendation expert in Tel Aviv.
Your job is to select the 3 BEST restaurants that match this specific user.
${userProfileSection}
=== CURRENT SEARCH ===
Looking for: ${contextDesc}
${conversationSummary ? `Additional context: ${conversationSummary}` : ''}

=== TOP 15 CANDIDATES ===
${restaurantList}

=== YOUR TASK ===
Select the TOP 3 restaurants that are the BEST PERSONAL MATCH for this user.

IMPORTANT RULES:
1. If user has dietary requirements (kosher/vegan/etc) - PRIORITIZE restaurants that fit
2. If user likes certain cuisines - explain how the restaurant matches their taste
3. If user dislikes something - AVOID restaurants with those elements
4. If friends visited a restaurant - MENTION IT in the reason (social proof!)
5. Reference the user's past reviews if relevant (e.g., "Based on your love for Italian at X...")
6. Be PERSONAL - use their name if available, reference their preferences
7. Write reasons in Hebrew, make them feel understood

Return ONLY a JSON array:
[
  {
    "index": 1,
    "reason": "Hebrew PERSONAL explanation why this is perfect for THIS user (2-3 sentences, reference their preferences/reviews/friends)"
  },
  ...
]`;

  // DEBUG: Log if we have user profile section
  console.log('📝 LLM Prompt has user profile section:', userProfileSection.length > 10 ? 'YES ✅' : 'NO ❌');
  if (userProfileSection.length > 10) {
    console.log('📝 User profile section preview:', userProfileSection.substring(0, 300));
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 800,
  });

  try {
    const responseText = response.choices[0].message.content || '[]';
    const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const selections = JSON.parse(cleaned);

    return selections.slice(0, 3).map((sel: any) => {
      const restaurant = candidates[sel.index - 1];
      if (!restaurant) {
        console.error(`Invalid index ${sel.index} in LLM response`);
        return null;
      }
      return {
        restaurant,
        reason: sel.reason,
        matchScore: Math.round((restaurant.finalScore || 0.5) * 100),
      };
    }).filter(Boolean);
  } catch (e) {
    console.error('LLM response parsing error:', e);
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
  
  // Get people the user follows (using follows table)
  const { data: following } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  
  if (!following?.length) return result;
  
  const followingIds = following.map((f: any) => f.following_id);
  
  // Get reviews from people user follows
  const { data: reviews } = await supabase
    .from('reviews')
    .select(`
      user_id,
      restaurants (google_place_id),
      profiles:user_id (full_name, username)
    `)
    .in('user_id', followingIds)
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
