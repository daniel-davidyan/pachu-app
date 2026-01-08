/**
 * Recommendation Pipeline V2 - LLM Selection
 * 
 * Uses GPT-4o-mini to select the final 3 restaurants from candidates
 * and generate personal, short explanations for each.
 */

import OpenAI from 'openai';
import {
  RankedRestaurant,
  Recommendation,
  ConversationContext,
  ChatMessage,
} from './types';

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const SYSTEM_PROMPT_HE = `אתה מומחה מסעדות שעוזר לאנשים למצוא את המקום המושלם.

קיבלת שיחה עם משתמש ורשימה של 15 מועמדים.
המשימה שלך:
1. בחר 3 מסעדות שמתאימות בדיוק למה שהמשתמש רוצה
2. לכל מסעדה כתוב נימוק אישי וקצר

הנימוק צריך:
- להיות משפט אחד או שניים בלבד
- להרגיש כאילו אתה חבר שמכיר אותו
- להתייחס למה שהמשתמש ביקש ספציפית
- להיות קצר וקולע, בלי חפירות

דוגמאות לנימוקים טובים:
- "בול מה שחיפשת - איטלקי אותנטי עם פסטה טרייה"
- "מקום מושלם לדייט, רומנטי ושקט בדיוק כמו שרצית"
- "הכי קרוב אליך והאוכל שם מדהים"
- "ידעתי שתאהב את זה - המבורגרים מטורפים"

דוגמאות לנימוקים גרועים (לא לכתוב ככה!):
- "המסעדה הזו מציעה מגוון רחב של מנות איכותיות בסביבה נעימה..."
- "אני ממליץ על המקום הזה בגלל האווירה הייחודית והאוכל המשובח..."

החזר JSON בפורמט הבא בלבד:
{
  "selections": [
    { "google_place_id": "...", "reason": "..." },
    { "google_place_id": "...", "reason": "..." },
    { "google_place_id": "...", "reason": "..." }
  ]
}`;

const SYSTEM_PROMPT_EN = `You are a restaurant expert helping people find the perfect place.

You received a conversation with a user and a list of 15 candidates.
Your task:
1. Select 3 restaurants that perfectly match what the user wants
2. Write a short, personal reason for each

The reason should:
- Be one or two sentences only
- Feel like a friend who knows them
- Reference what the user specifically asked for
- Be short and punchy, no fluff

Good reason examples:
- "Exactly what you're looking for - authentic Italian with fresh pasta"
- "Perfect for your date, romantic and quiet just like you wanted"
- "Closest to you and the food there is amazing"
- "Knew you'd love this - insane burgers"

Bad reason examples (don't write like this!):
- "This restaurant offers a wide variety of quality dishes in a pleasant environment..."
- "I recommend this place because of its unique atmosphere and exquisite food..."

Return JSON in this format only:
{
  "selections": [
    { "google_place_id": "...", "reason": "..." },
    { "google_place_id": "...", "reason": "..." },
    { "google_place_id": "...", "reason": "..." }
  ]
}`;

// ============================================================================
// CANDIDATE FORMATTING
// ============================================================================

/**
 * Format a restaurant candidate for the LLM prompt
 */
function formatCandidate(restaurant: RankedRestaurant, index: number): string {
  const parts = [
    `${index + 1}. ${restaurant.name}`,
    `   ID: ${restaurant.google_place_id}`,
    `   Rating: ${restaurant.google_rating || 'N/A'}/5 (${restaurant.google_reviews_count || 0} reviews)`,
    `   Price: ${'$'.repeat(restaurant.price_level || 2)}`,
    `   Categories: ${restaurant.categories?.join(', ') || 'Restaurant'}`,
    `   Distance: ${restaurant.distanceMeters ? `${Math.round(restaurant.distanceMeters)}m` : 'N/A'}`,
    `   Match Score: ${(restaurant.finalScore * 100).toFixed(0)}%`,
  ];
  
  if (restaurant.summary) {
    parts.push(`   Summary: ${restaurant.summary.substring(0, 150)}...`);
  }
  
  return parts.join('\n');
}

/**
 * Format conversation for the LLM prompt
 */
function formatConversation(messages: ChatMessage[], language: 'he' | 'en'): string {
  const roleNames = language === 'he' 
    ? { user: 'משתמש', assistant: 'עוזר' }
    : { user: 'User', assistant: 'Assistant' };
  
  return messages
    .map(m => `${roleNames[m.role]}: ${m.content}`)
    .join('\n');
}

// ============================================================================
// LLM SELECTION
// ============================================================================

export interface LLMSelectionResult {
  google_place_id: string;
  reason: string;
}

/**
 * Use LLM to select final 3 restaurants and generate personal reasons
 */
export async function selectWithLLM(
  candidates: RankedRestaurant[],
  context: ConversationContext,
  messages: ChatMessage[],
  openaiApiKey: string
): Promise<LLMSelectionResult[]> {
  const openai = new OpenAI({ apiKey: openaiApiKey });
  
  console.log(`🤖 LLM Selection: Processing ${candidates.length} candidates`);
  
  // Choose system prompt based on language
  const systemPrompt = context.language === 'he' ? SYSTEM_PROMPT_HE : SYSTEM_PROMPT_EN;
  
  // Format conversation
  const conversationText = formatConversation(messages, context.language);
  
  // Format candidates
  const candidatesText = candidates
    .map((c, i) => formatCandidate(c, i))
    .join('\n\n');
  
  // Build user prompt
  const userPrompt = context.language === 'he'
    ? `השיחה עם המשתמש:
${conversationText}

המועמדים (15 המסעדות הטובות ביותר):
${candidatesText}

בחר 3 מסעדות וכתוב נימוק קצר ואישי לכל אחת.`
    : `Conversation with user:
${conversationText}

Candidates (top 15 restaurants):
${candidatesText}

Select 3 restaurants and write a short, personal reason for each.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });
    
    const response = completion.choices[0]?.message?.content || '{}';
    
    // Parse JSON response
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '');
    }
    
    const parsed = JSON.parse(jsonStr);
    const selections: LLMSelectionResult[] = parsed.selections || [];
    
    console.log(`✅ LLM selected ${selections.length} restaurants`);
    selections.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.google_place_id}: "${s.reason}"`);
    });
    
    return selections;
  } catch (error) {
    console.error('LLM Selection error:', error);
    
    // Fallback: return top 3 candidates with generic reasons
    const fallbackReasons = context.language === 'he'
      ? ['המלצה מובילה בהתאם להעדפות שלך', 'מקום מצוין שמתאים למה שחיפשת', 'אופציה נהדרת באזור שלך']
      : ['Top recommendation based on your preferences', 'Great place matching what you asked', 'Excellent option in your area'];
    
    return candidates.slice(0, 3).map((c, i) => ({
      google_place_id: c.google_place_id,
      reason: fallbackReasons[i],
    }));
  }
}

// ============================================================================
// BUILD FINAL RECOMMENDATIONS
// ============================================================================

/**
 * Build final recommendation objects from LLM selections
 */
export function buildRecommendations(
  selections: LLMSelectionResult[],
  candidates: RankedRestaurant[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  
  for (const selection of selections) {
    const restaurant = candidates.find(
      c => c.google_place_id === selection.google_place_id
    );
    
    if (restaurant) {
      // Calculate match percentage (0-100)
      // Base on finalScore, but ensure minimum of 70% for recommended items
      const matchPercentage = Math.max(
        70,
        Math.min(99, Math.round(restaurant.finalScore * 100))
      );
      
      recommendations.push({
        restaurant,
        reason: selection.reason,
        matchPercentage,
      });
    }
  }
  
  // If we don't have 3 recommendations, fill with top candidates
  while (recommendations.length < 3 && candidates.length > recommendations.length) {
    const nextCandidate = candidates.find(
      c => !recommendations.some(r => r.restaurant.google_place_id === c.google_place_id)
    );
    
    if (nextCandidate) {
      recommendations.push({
        restaurant: nextCandidate,
        reason: 'המלצה נוספת שמתאימה להעדפות שלך',
        matchPercentage: Math.max(70, Math.round(nextCandidate.finalScore * 100)),
      });
    } else {
      break;
    }
  }
  
  return recommendations;
}
