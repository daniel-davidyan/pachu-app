import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

/**
 * POST /api/agent/recommend
 * 
 * SIMPLIFIED Pipeline (V3):
 * 1. Vector Search: All restaurants → Top 30 by embedding similarity
 * 2. LLM Selection: 30 → 3 best matches with personalized reasons
 */

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
  vectorScore?: number;
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
      messages,           // Full conversation history [{role, content}, ...]
      conversationSummary, // Alternative: text summary of conversation
      includeDebugData,
    } = body;

    // Build conversation text from messages or use summary
    let conversationText = '';
    let userMessagesOnly = '';
    
    if (messages && Array.isArray(messages)) {
      conversationText = messages
        .map((m: { role: string; content: string }) => 
          `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
        )
        .join('\n');
      
      // Extract only user messages for better embedding
      userMessagesOnly = messages
        .filter((m: { role: string }) => m.role === 'user')
        .map((m: { content: string }) => m.content)
        .join(' ');
    } else if (conversationSummary) {
      conversationText = conversationSummary;
      userMessagesOnly = conversationSummary;
    }

    if (!conversationText) {
      return NextResponse.json(
        { error: 'messages or conversationSummary is required' },
        { status: 400 }
      );
    }

    console.log('\n========================================');
    console.log('🚀 SIMPLIFIED PIPELINE V3.1');
    console.log('========================================\n');
    console.log('📝 User messages:', userMessagesOnly.substring(0, 200));

    // ================================================
    // STEP 0: EXTRACT SEARCH INTENT
    // ================================================
    console.log('\n🎯 STEP 0: Extract Search Intent');
    const searchIntent = await extractSearchIntent(userMessagesOnly);
    console.log('   Search intent:', searchIntent);

    // ================================================
    // STEP 1: VECTOR SEARCH (All → Top 30)
    // Using pgvector for efficient database-side similarity search
    // ================================================
    console.log('\n📊 STEP 1: Vector Search');
    
    // Generate embedding for the SEARCH INTENT
    console.log('   🧠 Generating search embedding...');
    const searchEmbedding = await generateEmbedding(searchIntent);
    console.log(`   🧠 Search embedding length: ${searchEmbedding.length}`);

    // Try to use the optimized database function first
    let top30: Restaurant[] = [];
    let totalInDb = 0;
    
    try {
      // Use pgvector's database-side similarity search (MUCH faster, no JSON parsing issues)
      console.log('   📡 Calling database vector search function...');
      const { data: vectorResults, error: rpcError } = await supabase.rpc('search_restaurants_simple', {
        query_embedding: JSON.stringify(searchEmbedding), // pgvector expects string format
        max_results: 30,
      });

      if (rpcError) {
        console.error('   ⚠️ RPC error:', rpcError.message);
        throw new Error(rpcError.message);
      }

      if (vectorResults && vectorResults.length > 0) {
        console.log(`   ✅ Database returned ${vectorResults.length} results`);
        top30 = vectorResults.map((r: any) => ({
          ...r,
          vectorScore: r.similarity || 0,
        }));
        
        // Get total count for debug
        const { count } = await supabase
          .from('restaurant_cache')
          .select('id', { count: 'exact', head: true })
          .not('summary_embedding', 'is', null);
        totalInDb = count || vectorResults.length;
      } else {
        throw new Error('No results from database function');
      }
    } catch (dbError) {
      // Fallback: Fetch ALL restaurants and filter by search intent keywords
      console.log('   ⚠️ Database function failed, using keyword fallback...');
      console.log(`   ⚠️ Error: ${dbError}`);
      
      // Fetch ALL restaurants (no embedding needed)
      // Using ACTUAL column names from the enrich script (which populated the DB)
      const { data: allRestaurants, error: fetchError } = await supabase
        .from('restaurant_cache')
        .select('id, google_place_id, name, address, city, latitude, longitude, google_rating, google_reviews_count, price_level, categories, summary, opening_hours, photos')
        .not('summary_embedding', 'is', null);

      if (fetchError) {
        console.error('Error fetching restaurants:', fetchError);
        return NextResponse.json({ error: 'Failed to fetch restaurants' }, { status: 500 });
      }

      totalInDb = allRestaurants?.length || 0;
      console.log(`   📦 Fallback: fetched ${totalInDb} restaurants total`);

      if (!allRestaurants || allRestaurants.length === 0) {
        return NextResponse.json({
          recommendations: [],
          message: 'אין מסעדות במערכת',
        });
      }

      // Extract keywords from search intent for filtering
      const keywords = searchIntent.toLowerCase().split(/\s+/).filter(k => k.length > 2);
      console.log(`   🔍 Filtering by keywords: ${keywords.join(', ')}`);

      // Score restaurants by keyword matches in categories and summary
      const scoredRestaurants = allRestaurants.map(r => {
        const categoriesText = ((r.categories || []) as string[]).join(' ').toLowerCase();
        const summaryText = (r.summary || '').toLowerCase();
        const nameText = (r.name || '').toLowerCase();
        const searchText = `${categoriesText} ${summaryText} ${nameText}`;
        
        // Count keyword matches
        let score = 0;
        for (const keyword of keywords) {
          if (searchText.includes(keyword)) {
            score += 1;
          }
          // Extra points for category match
          if (categoriesText.includes(keyword)) {
            score += 2;
          }
        }
        
        // Boost by rating
        score += (r.google_rating || 0) / 5;
        
        return { ...r, keywordScore: score };
      });

      // Sort by keyword score, then by rating
      scoredRestaurants.sort((a, b) => {
        if (b.keywordScore !== a.keywordScore) {
          return b.keywordScore - a.keywordScore;
        }
        return (b.google_rating || 0) - (a.google_rating || 0);
      });

      const topMatches = scoredRestaurants.slice(0, 30);
      console.log(`   📊 Top matches: ${topMatches.slice(0, 5).map(r => `${r.name} (score: ${r.keywordScore.toFixed(1)})`).join(', ')}`);

      // Map to Restaurant interface (column names match directly)
      top30 = topMatches.map(r => ({
        id: r.id,
        google_place_id: r.google_place_id,
        name: r.name,
        address: r.address,
        city: r.city,
        latitude: r.latitude || 0,
        longitude: r.longitude || 0,
        google_rating: r.google_rating,
        google_reviews_count: r.google_reviews_count,
        price_level: r.price_level,
        categories: r.categories || [],
        summary: r.summary || '',
        opening_hours: r.opening_hours,
        photos: r.photos,
        vectorScore: r.keywordScore / (keywords.length * 3 + 1), // Normalize score
      }));
    }

    console.log(`   ✅ Top 30 selected. Best score: ${top30[0]?.vectorScore?.toFixed(4)}`);
    console.log('   Top 5:', top30.slice(0, 5).map(r => `${r.name} (${r.vectorScore?.toFixed(3)})`).join(', '));

    // ================================================
    // STEP 2: LLM SELECTION (30 → 3)
    // ================================================
    console.log('\n🤖 STEP 2: LLM Selection');

    const recommendations = await selectWithLLM(top30, conversationText, user?.id);

    console.log(`   ✅ LLM selected ${recommendations.length} restaurants`);
    recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec.restaurant.name}: "${rec.reason}"`);
    });

    console.log('\n========================================');
    console.log('✅ PIPELINE COMPLETE');
    console.log('========================================\n');

    // Generate natural summary message using LLM
    const summaryMessage = await generateNaturalSummary(recommendations, conversationText);

    return NextResponse.json({
      recommendations,
      message: summaryMessage,
      debugData: includeDebugData ? {
        // Step 1: Database & Hard Filters (currently no hard filters, so same as total)
        step1: {
          totalInDb: totalInDb,
          afterFilter: totalInDb, // No hard filters in V3
          sampleRestaurants: top30.slice(0, 10).map(r => ({
            id: r.id,
            name: r.name,
            categories: r.categories,
            city: r.city,
          })),
        },
        // Step 2: Vector Search
        step2: {
          queryText: searchIntent,
          totalScored: totalInDb,
          topByVector: top30.map(r => ({
            id: r.id,
            name: r.name,
            categories: r.categories,
            vectorScore: r.vectorScore,
            summary: r.summary?.substring(0, 100),
          })),
        },
        // Step 3: Re-ranking (pass-through in V3 - same as vector search)
        step3: {
          totalReranked: top30.length,
          topByRerank: top30.map(r => ({
            id: r.id,
            name: r.name,
            categories: r.categories,
            vectorScore: r.vectorScore,
            finalScore: r.vectorScore, // Same in V3
            socialScore: 0, // Not used in V3
          })),
        },
        // Step 4: LLM Selection
        step4: {
          candidatesSentToLLM: top30.map(r => ({
            id: r.id,
            name: r.name,
            categories: r.categories,
            summary: r.summary?.substring(0, 100),
          })),
          finalRecommendations: recommendations.map(rec => ({
            id: rec.restaurant.id,
            name: rec.restaurant.name,
            categories: rec.restaurant.categories,
            reason: rec.reason,
            matchScore: rec.matchScore,
          })),
        },
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
// STEP 0: Extract Search Intent
// ============================================

async function extractSearchIntent(userMessages: string): Promise<string> {
  const prompt = `Extract the restaurant search intent from this user message. 
Return a short search query in English that captures what type of food/restaurant they want.

User said: "${userMessages}"

Focus on:
- Type of food (burger, pizza, sushi, italian, etc.)
- Atmosphere/vibe if mentioned
- Any specific requirements

Examples:
- "מת על המבורגר" → "hamburger burger restaurant"
- "משהו איטלקי רומנטי" → "romantic italian restaurant pasta"
- "סושי עם חברים" → "sushi japanese restaurant casual"
- "בשר טוב" → "steakhouse meat grill restaurant"
- "קפה ועוגה" → "cafe coffee cake dessert"

Return ONLY the search query, nothing else:`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 50,
    });
    
    const intent = response.choices[0].message.content?.trim() || userMessages;
    return intent;
  } catch (e) {
    console.error('Failed to extract search intent:', e);
    return userMessages;
  }
}

// ============================================
// STEP 1 HELPERS: Vector Search
// ============================================

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Parse embedding from various formats:
 * - Array of numbers (direct)
 * - JSON string: "[0.1, 0.2, ...]"
 * - pgvector string: "[0.1,0.2,...]" or "(0.1,0.2,...)"
 */
function parseEmbedding(embedding: any): number[] | null {
  if (!embedding) return null;
  
  // Already an array
  if (Array.isArray(embedding)) {
    return embedding;
  }
  
  // String format (JSON or pgvector)
  if (typeof embedding === 'string') {
    try {
      // Try JSON parse first
      const parsed = JSON.parse(embedding);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Try pgvector format: remove brackets and split by comma
      const cleaned = embedding.replace(/[\[\]()]/g, '');
      const values = cleaned.split(',').map(v => parseFloat(v.trim()));
      if (values.length > 0 && !isNaN(values[0])) {
        return values;
      }
    }
  }
  
  // Object with data property (some drivers return this)
  if (typeof embedding === 'object' && embedding.data) {
    return parseEmbedding(embedding.data);
  }
  
  return null;
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

// ============================================
// STEP 2: LLM Selection
// ============================================

async function selectWithLLM(
  candidates: Restaurant[],
  conversationText: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userId?: string
): Promise<Recommendation[]> {
  
  console.log('🎯 selectWithLLM called with', candidates.length, 'candidates');
  
  if (candidates.length === 0) {
    console.error('❌ No candidates provided to LLM selection!');
    return [];
  }

  // Build restaurant list for prompt
  const restaurantList = candidates.map((r, i) => {
    return `${i + 1}. ${r.name}
   קטגוריות: ${(r.categories || []).join(', ') || 'מסעדה'}
   דירוג: ${r.google_rating || 'N/A'}/5 (${r.google_reviews_count || 0} ביקורות)
   מחיר: ${'₪'.repeat(r.price_level || 2)}
   תיאור: ${r.summary || 'אין תיאור'}`;
  }).join('\n\n');

  const prompt = `אתה פאצ'ו, מומחה מסעדות בתל אביב.

## השיחה עם המשתמש:
${conversationText}

## 30 מסעדות מועמדות:
${restaurantList}

## המשימה שלך:
בחר בדיוק 3 מסעדות שהכי מתאימות למה שהמשתמש מחפש.

## כללים קריטיים:
1. **סוג אוכל הכי חשוב!** - אם המשתמש רוצה המבורגר, בחר רק מקומות המבורגרים. אם רוצה איטלקי, בחר איטלקיות. תסתכל בקטגוריות ובתיאור!
2. התעלם ממסעדות שלא מתאימות לסוג האוכל שהמשתמש ביקש
3. לכל מסעדה כתוב משפט אחד קצר וקולע

## זיהוי סוג אוכל:
- "המבורגר" / "בורגר" → חפש מקומות עם burger, המבורגר, בשר
- "פיצה" → חפש מקומות עם pizza, פיצה, איטלקי
- "סושי" / "יפני" → חפש מקומות עם sushi, japanese, יפני
- "בשר" / "סטייק" → חפש steakhouse, גריל, בשרים
- "איטלקי" → חפש italian, איטלקי, פסטה

## פורמט התשובה (JSON בלבד):
[
  {"index": 1, "reason": "משפט קצר בעברית"},
  {"index": 2, "reason": "משפט קצר בעברית"},
  {"index": 3, "reason": "משפט קצר בעברית"}
]

דוגמאות לנימוקים טובים:
- "המבורגרים פה אגדיים, בדיוק מה שחיפשת"
- "פיצה נפוליטנית מטורפת"
- "הסושי הכי טרי בעיר"`;

  try {
    console.log('📤 Calling GPT-4o for selection...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 400,
    });

    const responseText = response.choices[0].message.content || '[]';
    console.log('📥 LLM raw response:', responseText.substring(0, 200));
    
    const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
    console.log('🧹 Cleaned response:', cleaned.substring(0, 200));
    
    const selections = JSON.parse(cleaned);
    console.log('✅ Parsed selections:', selections);

    const results = selections.slice(0, 3).map((sel: { index: number; reason: string }) => {
      const restaurant = candidates[sel.index - 1];
      if (!restaurant) {
        console.error(`❌ Invalid index ${sel.index} in LLM response (candidates length: ${candidates.length})`);
        return null;
      }
      console.log(`   ✓ Selected: ${restaurant.name}`);
      return {
        restaurant,
        reason: sel.reason,
        matchScore: Math.round((restaurant.vectorScore || 0.5) * 100),
      };
    }).filter(Boolean) as Recommendation[];
    
    console.log(`📊 Final results: ${results.length} recommendations`);
    return results;

  } catch (e) {
    console.error('❌ LLM selection error:', e);
    console.log('⚠️ Using fallback: returning top 3 candidates');
    
    // Fallback: return top 3 with generic reasons
    return candidates.slice(0, 3).map(r => ({
      restaurant: r,
      reason: `מתאים למה שחיפשת - ${r.google_rating}/5 דירוג`,
      matchScore: Math.round((r.vectorScore || 0.5) * 100),
    }));
  }
}

// ============================================
// Natural Summary Generation
// ============================================

async function generateNaturalSummary(
  recommendations: Recommendation[],
  conversationText: string
): Promise<string> {
  if (recommendations.length === 0) {
    return 'לא מצאתי התאמות, אולי תנסה לתאר מה אתה מחפש?';
  }

  const restaurantNames = recommendations.map(r => r.restaurant.name);
  const reasons = recommendations.map(r => r.reason);

  const prompt = `אתה פאצ'ו, חבר שעוזר למצוא מסעדות.

המשתמש ביקש: ${conversationText.split('\n').filter(l => l.startsWith('User:')).pop()?.replace('User:', '').trim() || 'מסעדה טובה'}

בחרתי 3 מסעדות:
1. ${restaurantNames[0]} - ${reasons[0]}
2. ${restaurantNames[1]} - ${reasons[1]}  
3. ${restaurantNames[2]} - ${reasons[2]}

כתוב הודעת סיכום טבעית וזורמת בעברית שמציגה את 3 ההמלצות.

## כללים חשובים:
- השתמש ב-[[שם מסעדה]] בדיוק כמו שכתבתי למעלה (עם סוגריים מרובעים כפולים)
- כל מסעדה בשורה חדשה! (ירידת שורה אחרי כל המלצה)
- הודעה קצרה וטבעית, כמו חבר שממליץ
- תן טעם למה כל מקום מתאים
- בלי אימוג'ים בכלל!
- אל תמספר את המסעדות (1, 2, 3) - תזרום טבעי

## דוגמה לפורמט טוב:
"אז תשמע, אם אתה מחפש המבורגרים טרנדיים וטעימים, זה המקום בשבילך עם הצ'יפס כמהין המיוחד - [[Bodega Burger]]
אם אתה רוצה חוויה באווירה תוססת, במרכז תל אביב תתאים לך בול - [[ויטרינה]]
ובשביל קצת קלילות, מציע המבורגרים מעולים באווירה נוחה ופשוט כיף להיות שם! - [[בגן ברדס פלורנטין]]"

כתוב רק את ההודעה, בלי הסברים:`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 300,
    });

    return response.choices[0].message.content?.trim() || generateFallbackMessage(recommendations);
  } catch (e) {
    console.error('Failed to generate natural summary:', e);
    return generateFallbackMessage(recommendations);
  }
}

function generateFallbackMessage(recommendations: Recommendation[]): string {
  return `מצאתי לך 3 מקומות מעולים!
הייתי הולך על [[${recommendations[0].restaurant.name}]] - ${recommendations[0].reason}
אופציה נוספת היא [[${recommendations[1].restaurant.name}]] - ${recommendations[1].reason}
ואם בא לך משהו אחר - [[${recommendations[2].restaurant.name}]] - ${recommendations[2].reason}`;
}
