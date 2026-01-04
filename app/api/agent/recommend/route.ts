import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { AgentRecommendRequest, AgentRecommendResponse, RestaurantRecommendation } from '@/types/api';
import { addTasteSignal } from '@/lib/taste-signals';

/**
 * POST /api/agent/recommend
 * 
 * New Agent recommendation endpoint using the 4-step search algorithm:
 * 1. SQL Pre-Filter (hard criteria)
 * 2. Vector Search (semantic)
 * 3. Reranking (complex scoring)
 * 4. LLM Final Selection (o1-mini)
 * 
 * Returns 3 highly-matched restaurants within 10 seconds.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    const body: AgentRecommendRequest = await request.json();
    const { 
      conversationId, 
      messages, 
      latitude, 
      longitude, 
      radiusMeters = 5000 
    } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'messages array is required' },
        { status: 400 }
      );
    }

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'latitude and longitude are required' },
        { status: 400 }
      );
    }

    // Initialize OpenAI
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Detect language from first user message
    const firstUserMessage = messages.find(m => m.role === 'user')?.content || '';
    const language = detectLanguage(firstUserMessage);

    // Get user's taste profile
    let tasteProfile: any = null;
    let tasteEmbedding: number[] | null = null;
    
    if (user) {
      const { data: profile } = await supabase
        .from('user_taste_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      tasteProfile = profile;
      tasteEmbedding = profile?.taste_embedding || null;
    }

    console.log(`🤖 Agent recommend: user=${user?.id || 'anon'}, location=${latitude},${longitude}, radius=${radiusMeters}m`);

    // ========================================
    // STEP 1: Extract search intent from conversation
    // ========================================
    const extractionPrompt = buildExtractionPrompt(messages, language);
    
    const extractionResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: extractionPrompt },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const extractionText = extractionResponse.choices[0].message.content || '';
    const searchIntent = parseSearchIntent(extractionText);
    
    console.log('📊 Search intent:', JSON.stringify(searchIntent, null, 2));

    // Save extracted preferences as signals (for learning)
    if (user && searchIntent.preferences) {
      await savePreferencesAsSignals(supabase, user.id, searchIntent.preferences, conversationId);
    }

    // ========================================
    // STEP 2: Create combined query embedding
    // ========================================
    const queryText = buildQueryText(searchIntent, tasteProfile);
    
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: queryText,
    });
    
    const conversationEmbedding = embeddingResponse.data[0].embedding;

    // Combine with taste embedding (65% conversation + 35% taste)
    let queryEmbedding = conversationEmbedding;
    if (tasteEmbedding) {
      queryEmbedding = combineEmbeddings(conversationEmbedding, tasteEmbedding, 0.65, 0.35);
    }

    // ========================================
    // STEP 3: Vector Search from restaurant_cache
    // ========================================
    const { data: searchResults, error: searchError } = await supabase.rpc(
      'search_restaurants_by_embedding',
      {
        query_embedding: queryEmbedding,
        user_lat: latitude,
        user_lng: longitude,
        radius_meters: radiusMeters,
        max_results: 100,
        filter_kosher: tasteProfile?.is_kosher || false,
        filter_vegetarian: (tasteProfile?.is_vegetarian || tasteProfile?.is_vegan) || false,
      }
    );

    console.log(`🔍 Vector search found ${searchResults?.length || 0} restaurants`);

    // LOCAL DB ONLY MODE - No Google API calls
    const candidates: any[] = searchResults || [];
    
    if (candidates.length < 5) {
      console.log('⚠️ Not enough results from cache (DB only mode - no Google fallback)');
    }

    // ========================================
    // STEP 4: Reranking
    // ========================================
    const rankedCandidates = await rerankCandidates(
      candidates,
      searchIntent,
      tasteEmbedding,
      conversationEmbedding,
      supabase,
      user?.id
    );

    console.log(`📊 Reranked ${rankedCandidates.length} candidates`);

    // ========================================
    // STEP 5: LLM Final Selection
    // ========================================
    const top15 = rankedCandidates.slice(0, 15);
    
    const finalSelections = await llmFinalSelection(
      openai,
      top15,
      searchIntent,
      tasteProfile,
      language
    );

    console.log(`✅ LLM selected ${finalSelections.length} restaurants`);

    // Build response
    const recommendations: RestaurantRecommendation[] = finalSelections.map(selection => ({
      restaurant: {
        id: selection.restaurant.id,
        googlePlaceId: selection.restaurant.google_place_id || selection.restaurant.googlePlaceId,
        name: selection.restaurant.name,
        address: selection.restaurant.address,
        city: selection.restaurant.city,
        latitude: selection.restaurant.latitude,
        longitude: selection.restaurant.longitude,
        phone: selection.restaurant.phone,
        website: selection.restaurant.website,
        googleRating: selection.restaurant.google_rating || selection.restaurant.rating,
        googleReviewsCount: selection.restaurant.google_reviews_count,
        priceLevel: selection.restaurant.price_level,
        cuisineTypes: selection.restaurant.cuisine_types || selection.restaurant.cuisineTypes,
        isKosher: selection.restaurant.is_kosher || false,
        isVegetarianFriendly: selection.restaurant.is_vegetarian_friendly || false,
        openingHours: selection.restaurant.opening_hours,
        photos: selection.restaurant.photos,
        summaryText: selection.restaurant.summary_text,
        distanceMeters: selection.restaurant.distance_meters || selection.restaurant.distance,
        similarity: selection.restaurant.similarity,
        matchScore: selection.matchScore,
      },
      matchScore: selection.matchScore,
      explanation: selection.explanation,
      contextMatch: searchIntent.occasion,
    }));

    const duration = Date.now() - startTime;
    console.log(`⏱️ Agent recommend completed in ${duration}ms`);

    const response: AgentRecommendResponse = {
      recommendations,
      conversationId: conversationId || `conv_${Date.now()}`,
      language,
      explanation: buildOverallExplanation(searchIntent, recommendations, language),
      extractedPreferences: searchIntent.preferences,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in agent recommend:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ========================================
// Helper Functions
// ========================================

function detectLanguage(message: string): 'he' | 'en' {
  const hebrewChars = message.match(/[\u0590-\u05FF]/g);
  if (hebrewChars && hebrewChars.length > 3) {
    return 'he';
  }
  return 'en';
}

function buildExtractionPrompt(messages: any[], language: 'he' | 'en'): string {
  return `You are analyzing a conversation about restaurant recommendations.

Extract the following information from the conversation and return as JSON:
{
  "cuisineType": "type of food/cuisine mentioned",
  "occasion": "date/friends/family/solo/work or null",
  "priceLevel": 1-4 or null,
  "atmosphere": "romantic/casual/trendy/quiet/lively or null",
  "specificRequest": "any specific restaurant name mentioned",
  "searchQuery": "best search term for Google Places",
  "distance": "walking/driving/any",
  "timing": "now/tonight/tomorrow or null",
  "city": "city name if mentioned",
  "preferences": {
    "positive": ["list of positive preferences in English"],
    "negative": ["list of negative preferences in English"]
  }
}

Important:
- Extract actual values mentioned, use null if not mentioned
- The searchQuery should be a good term to search for on Google Places
- preferences.positive and preferences.negative should be in ENGLISH for storage
- Look for implicit preferences (e.g., "romantic" implies quiet, nice atmosphere)
- If a specific restaurant name is mentioned, put it in specificRequest

Respond ONLY with the JSON, no other text.`;
}

function parseSearchIntent(text: string): any {
  try {
    // Try to parse JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Error parsing search intent:', e);
  }
  
  return {
    cuisineType: null,
    occasion: null,
    priceLevel: null,
    atmosphere: null,
    specificRequest: null,
    searchQuery: 'restaurant',
    distance: 'any',
    timing: null,
    city: null,
    preferences: { positive: [], negative: [] },
  };
}

function buildQueryText(searchIntent: any, tasteProfile: any): string {
  const parts: string[] = [];

  // Add search intent
  if (searchIntent.cuisineType) {
    parts.push(`Looking for ${searchIntent.cuisineType} food.`);
  }
  if (searchIntent.occasion) {
    parts.push(`For a ${searchIntent.occasion} occasion.`);
  }
  if (searchIntent.atmosphere) {
    parts.push(`${searchIntent.atmosphere} atmosphere.`);
  }
  if (searchIntent.priceLevel) {
    const priceLabels = ['cheap', 'moderate', 'upscale', 'luxury'];
    parts.push(`${priceLabels[searchIntent.priceLevel - 1]} price range.`);
  }

  // Add positive preferences from intent
  if (searchIntent.preferences?.positive?.length > 0) {
    parts.push(`Likes: ${searchIntent.preferences.positive.join(', ')}.`);
  }

  // Add context from taste profile
  if (tasteProfile) {
    if (tasteProfile.likes?.length > 0) {
      parts.push(`Generally likes: ${tasteProfile.likes.slice(0, 5).join(', ')}.`);
    }
  }

  return parts.join(' ') || 'Looking for a good restaurant.';
}

function combineEmbeddings(a: number[], b: number[], weightA: number, weightB: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < a.length; i++) {
    result.push(a[i] * weightA + b[i] * weightB);
  }
  
  // Normalize
  const norm = Math.sqrt(result.reduce((sum, val) => sum + val * val, 0));
  return result.map(val => val / norm);
}

async function searchGooglePlaces(
  request: NextRequest,
  query: string,
  latitude: number,
  longitude: number,
  radiusMeters: number
): Promise<any[]> {
  try {
    const searchUrl = `${request.nextUrl.origin}/api/restaurants/search?query=${encodeURIComponent(query)}&latitude=${latitude}&longitude=${longitude}&radius=${radiusMeters}`;
    const response = await fetch(searchUrl, { headers: request.headers });
    const data = await response.json();
    
    return (data.restaurants || []).map((r: any) => ({
      id: r.id,
      google_place_id: r.googlePlaceId,
      name: r.name,
      address: r.address,
      google_rating: r.rating,
      cuisine_types: r.cuisineTypes,
      distance_meters: r.distance,
      photos: r.photoUrl ? [{ url: r.photoUrl }] : [],
      source: 'google',
    }));
  } catch (error) {
    console.error('Error searching Google Places:', error);
    return [];
  }
}

async function rerankCandidates(
  candidates: any[],
  searchIntent: any,
  tasteEmbedding: number[] | null,
  conversationEmbedding: number[],
  supabase: any,
  userId?: string
): Promise<any[]> {
  // Get friends scores if user is logged in
  const friendsScores = new Map<string, number>();
  
  if (userId) {
    const { data: followingData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);
    
    const followingIds = (followingData || []).map((f: any) => f.following_id);
    
    if (followingIds.length > 0) {
      const googlePlaceIds = candidates
        .map(c => c.google_place_id || c.googlePlaceId)
        .filter(Boolean);
      
      const { data: dbRestaurants } = await supabase
        .from('restaurants')
        .select('id, google_place_id')
        .in('google_place_id', googlePlaceIds);
      
      const restaurantIds = (dbRestaurants || []).map((r: any) => r.id);
      
      if (restaurantIds.length > 0) {
        const { data: friendsReviews } = await supabase
          .from('reviews')
          .select('restaurant_id, rating')
          .in('restaurant_id', restaurantIds)
          .in('user_id', followingIds);
        
        (friendsReviews || []).forEach((review: any) => {
          const current = friendsScores.get(review.restaurant_id) || 0;
          friendsScores.set(review.restaurant_id, current + review.rating);
        });
        
        // Map back to google_place_id
        (dbRestaurants || []).forEach((r: any) => {
          if (friendsScores.has(r.id)) {
            friendsScores.set(r.google_place_id, friendsScores.get(r.id)!);
          }
        });
      }
    }
  }

  // Calculate rerank score for each candidate
  const scored = candidates.map(candidate => {
    let score = 0;

    // 30% conversation similarity (from vector search)
    const convSimilarity = candidate.similarity || 0.7;
    score += 0.30 * convSimilarity;

    // 20% taste similarity (if available)
    // Note: This would need the restaurant embedding, which we have from search
    score += 0.20 * convSimilarity; // Simplified - using same similarity

    // 20% context match
    let contextScore = 0.5; // Default
    if (searchIntent.occasion) {
      // Check if restaurant matches the occasion
      const name = (candidate.name || '').toLowerCase();
      const summary = (candidate.summary_text || '').toLowerCase();
      
      const occasionKeywords: Record<string, string[]> = {
        'date': ['romantic', 'intimate', 'cozy', 'wine', 'candle'],
        'friends': ['bar', 'pub', 'casual', 'lively', 'fun'],
        'family': ['family', 'kids', 'casual', 'spacious'],
        'work': ['business', 'meeting', 'quiet', 'professional'],
        'solo': ['bar', 'counter', 'casual'],
      };
      
      const keywords = occasionKeywords[searchIntent.occasion] || [];
      const matches = keywords.filter(kw => 
        name.includes(kw) || summary.includes(kw)
      );
      contextScore = matches.length > 0 ? 0.8 : 0.5;
    }
    score += 0.20 * contextScore;

    // 15% Google rating
    const rating = candidate.google_rating || candidate.rating || 3.5;
    score += 0.15 * (rating / 5);

    // 15% friends score
    const placeId = candidate.google_place_id || candidate.googlePlaceId;
    const friendsScore = friendsScores.get(placeId);
    if (friendsScore) {
      score += 0.15 * Math.min(friendsScore / 20, 1);
    } else {
      score += 0.15 * 0.5; // Default
    }

    return {
      ...candidate,
      rerankScore: score,
      matchScore: Math.round(score * 100),
    };
  });

  // Sort by rerank score
  scored.sort((a, b) => b.rerankScore - a.rerankScore);

  return scored;
}

async function llmFinalSelection(
  openai: OpenAI,
  candidates: any[],
  searchIntent: any,
  tasteProfile: any,
  language: 'he' | 'en'
): Promise<{ restaurant: any; matchScore: number; explanation: string }[]> {
  // Build candidate summaries
  const candidateSummaries = candidates.slice(0, 15).map((c, i) => 
    `${i + 1}. ${c.name}
   Rating: ${c.google_rating || c.rating || 'N/A'}
   Cuisine: ${(c.cuisine_types || c.cuisineTypes || []).join(', ') || 'Unknown'}
   Distance: ${c.distance_meters ? `${Math.round(c.distance_meters)}m` : 'Unknown'}
   Summary: ${c.summary_text || 'No summary available'}
   Match Score: ${c.matchScore || 'N/A'}%`
  ).join('\n\n');

  const selectionPrompt = language === 'he'
    ? `אתה מומחה מסעדות. בחר את 3 המסעדות הטובות ביותר עבור הלקוח.

הבקשה של הלקוח:
- סוג אוכל: ${searchIntent.cuisineType || 'לא צוין'}
- אירוע: ${searchIntent.occasion || 'לא צוין'}
- אווירה: ${searchIntent.atmosphere || 'לא צוין'}
- תקציב: ${searchIntent.priceLevel ? `רמה ${searchIntent.priceLevel}` : 'לא צוין'}

פרופיל טעם:
${tasteProfile ? `- כשרות: ${tasteProfile.is_kosher ? 'כן' : 'לא'}
- צמחוני: ${tasteProfile.is_vegetarian ? 'כן' : 'לא'}
- אוהב: ${tasteProfile.likes?.join(', ') || 'לא צוין'}` : 'אין פרופיל'}

המסעדות האפשריות:
${candidateSummaries}

בחר 3 מסעדות וענה בפורמט JSON:
[
  {"index": 1, "explanation": "הסבר קצר למה המסעדה מתאימה"},
  {"index": 2, "explanation": "הסבר קצר"},
  {"index": 3, "explanation": "הסבר קצר"}
]

ענה רק ב-JSON.`
    : `You are a restaurant expert. Select the 3 best restaurants for the customer.

Customer request:
- Cuisine: ${searchIntent.cuisineType || 'Not specified'}
- Occasion: ${searchIntent.occasion || 'Not specified'}
- Atmosphere: ${searchIntent.atmosphere || 'Not specified'}
- Budget: ${searchIntent.priceLevel ? `Level ${searchIntent.priceLevel}` : 'Not specified'}

Taste profile:
${tasteProfile ? `- Kosher: ${tasteProfile.is_kosher ? 'Yes' : 'No'}
- Vegetarian: ${tasteProfile.is_vegetarian ? 'Yes' : 'No'}
- Likes: ${tasteProfile.likes?.join(', ') || 'Not specified'}` : 'No profile'}

Candidate restaurants:
${candidateSummaries}

Select 3 restaurants and respond in JSON format:
[
  {"index": 1, "explanation": "Brief explanation why this restaurant matches"},
  {"index": 2, "explanation": "Brief explanation"},
  {"index": 3, "explanation": "Brief explanation"}
]

Respond only with JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using gpt-4o-mini instead of o1-mini for speed
      messages: [{ role: 'user', content: selectionPrompt }],
      temperature: 0.3,
      max_tokens: 500,
    });

    const responseText = response.choices[0].message.content || '';
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      const selections = JSON.parse(jsonMatch[0]);
      return selections.map((sel: any) => {
        const candidate = candidates[sel.index - 1];
        return {
          restaurant: candidate,
          matchScore: candidate.matchScore || 85,
          explanation: sel.explanation,
        };
      }).filter((s: any) => s.restaurant);
    }
  } catch (error) {
    console.error('Error in LLM selection:', error);
  }

  // Fallback: return top 3 candidates
  return candidates.slice(0, 3).map(c => ({
    restaurant: c,
    matchScore: c.matchScore || 80,
    explanation: language === 'he' 
      ? 'מסעדה מומלצת על סמך ההעדפות שלך'
      : 'Recommended based on your preferences',
  }));
}

async function savePreferencesAsSignals(
  supabase: any,
  userId: string,
  preferences: { positive: string[]; negative: string[] },
  conversationId?: string
) {
  try {
    // Save positive preferences
    for (const pref of preferences.positive.slice(0, 5)) {
      await addTasteSignal(supabase, userId, {
        signalType: 'chat',
        signalStrength: 4,
        isPositive: true,
        content: pref,
        sourceId: conversationId,
      });
    }

    // Save negative preferences
    for (const pref of preferences.negative.slice(0, 5)) {
      await addTasteSignal(supabase, userId, {
        signalType: 'chat',
        signalStrength: 4,
        isPositive: false,
        content: pref,
        sourceId: conversationId,
      });
    }
  } catch (error) {
    console.error('Error saving preferences as signals:', error);
  }
}

function buildOverallExplanation(
  searchIntent: any,
  recommendations: RestaurantRecommendation[],
  language: 'he' | 'en'
): string {
  if (recommendations.length === 0) {
    return language === 'he'
      ? 'לא מצאתי מסעדות מתאימות באזור שלך.'
      : 'I could not find suitable restaurants in your area.';
  }

  const topMatch = recommendations[0];
  
  if (language === 'he') {
    let explanation = `מצאתי לך ${recommendations.length} מסעדות מושלמות`;
    if (searchIntent.cuisineType) {
      explanation += ` ל${searchIntent.cuisineType}`;
    }
    if (searchIntent.occasion) {
      explanation += ` ל${searchIntent.occasion}`;
    }
    explanation += `! ההתאמה הגבוהה ביותר היא ${topMatch.restaurant.name} עם ${topMatch.matchScore}% התאמה.`;
    return explanation;
  } else {
    let explanation = `I found ${recommendations.length} perfect restaurants`;
    if (searchIntent.cuisineType) {
      explanation += ` for ${searchIntent.cuisineType}`;
    }
    if (searchIntent.occasion) {
      explanation += ` for your ${searchIntent.occasion}`;
    }
    explanation += `! The top match is ${topMatch.restaurant.name} with ${topMatch.matchScore}% match.`;
    return explanation;
  }
}

