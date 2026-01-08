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
    // ================================================
    console.log('\n📊 STEP 1: Vector Search');
    
    // Get all restaurants with embeddings
    const { data: allRestaurants, error: fetchError } = await supabase
      .from('restaurant_cache')
      .select('id, google_place_id, name, address, city, latitude, longitude, google_rating, google_reviews_count, price_level, categories, summary, opening_hours, photos, summary_embedding')
      .not('summary_embedding', 'is', null);

    if (fetchError) {
      console.error('Error fetching restaurants:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch restaurants' }, { status: 500 });
    }

    console.log(`   📦 Total restaurants with embeddings: ${allRestaurants?.length || 0}`);

    if (!allRestaurants || allRestaurants.length === 0) {
      return NextResponse.json({
        recommendations: [],
        message: 'אין מסעדות במערכת',
      });
    }

    // Generate embedding for the SEARCH INTENT (not full conversation)
    console.log('   🧠 Generating search embedding...');
    const searchEmbedding = await generateEmbedding(searchIntent);

    // Calculate similarity scores
    console.log('   📐 Calculating similarity scores...');
    const scoredRestaurants = allRestaurants.map(r => {
      const score = r.summary_embedding 
        ? cosineSimilarity(searchEmbedding, r.summary_embedding)
        : 0;
      return { ...r, vectorScore: score, summary_embedding: undefined }; // Remove embedding from result
    });

    // Sort by score and take top 30
    const top30 = scoredRestaurants
      .sort((a, b) => (b.vectorScore || 0) - (a.vectorScore || 0))
      .slice(0, 30);

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

    return NextResponse.json({
      recommendations,
      message: generateResultMessage(recommendations),
      debugData: includeDebugData ? {
        totalRestaurants: allRestaurants.length,
        top30: top30.map(r => ({ name: r.name, score: r.vectorScore })),
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
  userId?: string
): Promise<Recommendation[]> {
  
  if (candidates.length === 0) return [];

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
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 400,
    });

    const responseText = response.choices[0].message.content || '[]';
    const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const selections = JSON.parse(cleaned);

    return selections.slice(0, 3).map((sel: { index: number; reason: string }) => {
      const restaurant = candidates[sel.index - 1];
      if (!restaurant) {
        console.error(`Invalid index ${sel.index} in LLM response`);
        return null;
      }
      return {
        restaurant,
        reason: sel.reason,
        matchScore: Math.round((restaurant.vectorScore || 0.5) * 100),
      };
    }).filter(Boolean) as Recommendation[];

  } catch (e) {
    console.error('LLM selection error:', e);
    // Fallback: return top 3 with generic reasons
    return candidates.slice(0, 3).map(r => ({
      restaurant: r,
      reason: `מתאים למה שחיפשת - ${r.google_rating}/5 דירוג`,
      matchScore: Math.round((r.vectorScore || 0.5) * 100),
    }));
  }
}

// ============================================
// Helper Functions
// ============================================

function generateResultMessage(recommendations: Recommendation[]): string {
  if (recommendations.length === 0) {
    return 'לא מצאתי התאמות, אולי תנסה לתאר מה אתה מחפש?';
  }
  return 'הנה 3 המלצות בשבילך! 🍽️';
}
