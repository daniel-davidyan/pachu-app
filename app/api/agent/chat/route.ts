import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

/**
 * POST /api/agent/chat
 * 
 * Pachu Agent v2.0 - Smart Conversational Restaurant Finder
 * 
 * Architecture:
 * 1. State Machine - tracks conversation state and what we know
 * 2. Intent Understanding - deeply understands what user wants
 * 3. Progressive Disclosure - asks one question at a time, naturally
 * 4. Smart Chips - context-aware quick replies
 * 5. Personalization - uses first name, references history
 */

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// ============================================
// TYPE DEFINITIONS
// ============================================

interface Chip {
  label: string;
  value: string;
  emoji?: string;
}

// What we need to know to recommend
interface SearchSlots {
  occasion: string | null;     // Who/why: date, friends, family, solo, work, celebration
  location: string | null;     // Distance: walking, nearby, willing_to_travel
  cuisine: string | null;      // Food type: italian, asian, israeli, etc.
  vibe: string | null;         // Atmosphere: romantic, casual, upscale, lively
  budget: string | null;       // Price: cheap, moderate, expensive
  timing: string | null;       // When: now, tonight, weekend, specific
}

// Conversation state machine
type ConversationState = 
  | 'greeting'           // First message - warm welcome
  | 'gathering_info'     // Collecting slots progressively  
  | 'ready_to_search'    // Have enough info to recommend
  | 'showing_results'    // Displayed recommendations
  | 'refining'           // User wants changes
  | 'small_talk';        // User is just chatting

interface ConversationContext {
  state: ConversationState;
  slots: SearchSlots;
  turnCount: number;
  lastQuestion: string | null;
  userPreferences: string[];  // Accumulated preferences from chat
}

interface UserProfile {
  firstName: string;
  fullName: string;
  hasOnboarding: boolean;
  favoriteCategories?: string[];
}

// ============================================
// MAIN HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    const body = await request.json();
    const {
      message,
      conversationId,
      previousContext,
      userLocation,
    } = body;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // ========================================
    // STEP 1: Get User Profile
    // ========================================
    const userProfile = await getUserProfile(supabase, user?.id);
    
    // ========================================
    // STEP 2: Initialize/Restore Context
    // ========================================
    const context = initializeContext(previousContext);
    const isFirstTurn = context.turnCount === 0;
    context.turnCount++;

    // ========================================
    // STEP 3: Understand User Intent (Deep Analysis)
    // ========================================
    const understanding = await understandUserIntent(message, context);
    
    // Update slots with new information
    mergeSlots(context.slots, understanding.extractedSlots);
    
    // Update state based on understanding
    context.state = determineState(context, understanding);
    
    console.log('🧠 Understanding:', understanding);
    console.log('📋 Slots:', context.slots);
    console.log('🔄 State:', context.state);

    // ========================================
    // STEP 4: Generate Response Based on State
    // ========================================
    let response: AgentResponse;
    
    if (context.state === 'ready_to_search') {
      // We have enough info - get recommendations!
      response = await handleSearch(context, userLocation, userProfile);
    } else if (context.state === 'small_talk') {
      // User is just chatting
      response = await handleSmallTalk(message, userProfile, isFirstTurn);
    } else {
      // Need more info - ask smart questions
      response = await handleGathering(context, userProfile, isFirstTurn, understanding);
    }

    // ========================================
    // STEP 5: Return Response
    // ========================================
    return NextResponse.json({
      message: response.message,
      chips: response.chips,
      context: {
        state: context.state,
        slots: context.slots,
        turnCount: context.turnCount,
        lastQuestion: response.questionType,
      },
      readyToRecommend: context.state === 'ready_to_search',
      recommendations: response.recommendations,
      conversationId: conversationId || `conv_${Date.now()}`,
    });

  } catch (error) {
    console.error('Agent error:', error);
    return NextResponse.json({
      message: 'אופס, משהו קרה. בוא ננסה שוב! 🙏',
      chips: [
        { label: 'התחל מחדש', value: 'start_over', emoji: '🔄' }
      ],
      readyToRecommend: false,
    });
  }
}

// ============================================
// RESPONSE INTERFACE
// ============================================

interface AgentResponse {
  message: string;
  chips: Chip[];
  recommendations?: any[];
  questionType?: string;
}

// ============================================
// USER PROFILE
// ============================================

async function getUserProfile(supabase: any, userId?: string): Promise<UserProfile> {
  if (!userId) {
    return { firstName: '', fullName: '', hasOnboarding: false };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, username')
    .eq('id', userId)
    .single();

  const { data: tasteProfile } = await supabase
    .from('user_taste_profiles')
    .select('onboarding_completed, preferred_cuisines')
    .eq('user_id', userId)
    .single();

  const fullName = profile?.full_name || profile?.username || '';
  // Extract first name only (handle both "First Last" and "First")
  const firstName = fullName.split(' ')[0];

  return {
    firstName,
    fullName,
    hasOnboarding: tasteProfile?.onboarding_completed || false,
    favoriteCategories: tasteProfile?.preferred_cuisines,
  };
}

// ============================================
// CONTEXT MANAGEMENT
// ============================================

function initializeContext(previous: any): ConversationContext {
  if (previous?.slots) {
    return {
      state: previous.state || 'gathering_info',
      slots: previous.slots,
      turnCount: previous.turnCount || 0,
      lastQuestion: previous.lastQuestion || null,
      userPreferences: previous.userPreferences || [],
    };
  }

  return {
    state: 'greeting',
    slots: {
      occasion: null,
      location: null,
      cuisine: null,
      vibe: null,
      budget: null,
      timing: null,
    },
    turnCount: 0,
    lastQuestion: null,
    userPreferences: [],
  };
}

function mergeSlots(existing: SearchSlots, extracted: Partial<SearchSlots>) {
  Object.keys(extracted).forEach(key => {
    const k = key as keyof SearchSlots;
    if (extracted[k]) {
      existing[k] = extracted[k];
    }
  });
}

// ============================================
// INTENT UNDERSTANDING (The Brain)
// ============================================

interface IntentUnderstanding {
  intent: 'search' | 'refine' | 'question' | 'small_talk' | 'greeting';
  extractedSlots: Partial<SearchSlots>;
  sentiment: 'positive' | 'neutral' | 'negative';
  isComplete: boolean;  // Has user provided enough for search?
  keywords: string[];
}

async function understandUserIntent(
  message: string, 
  context: ConversationContext
): Promise<IntentUnderstanding> {
  
  const prompt = `Analyze this Hebrew/English message from a user looking for restaurant recommendations in Tel Aviv.

MESSAGE: "${message}"

CURRENT CONTEXT:
- Occasion: ${context.slots.occasion || 'unknown'}
- Location preference: ${context.slots.location || 'unknown'}
- Cuisine: ${context.slots.cuisine || 'unknown'}
- Vibe: ${context.slots.vibe || 'unknown'}
- Budget: ${context.slots.budget || 'unknown'}

Extract information and return JSON:
{
  "intent": "search" | "refine" | "question" | "small_talk" | "greeting",
  "extractedSlots": {
    "occasion": "date" | "friends" | "family" | "solo" | "work" | "celebration" | null,
    "location": "walking" | "nearby" | "willing_to_travel" | "tel_aviv" | null,
    "cuisine": "<cuisine type or null>",
    "vibe": "romantic" | "casual" | "upscale" | "lively" | "cozy" | "trendy" | null,
    "budget": "cheap" | "moderate" | "expensive" | null,
    "timing": "now" | "tonight" | "tomorrow" | "weekend" | null
  },
  "sentiment": "positive" | "neutral" | "negative",
  "isComplete": <true if user gave enough info for meaningful search>,
  "keywords": ["relevant", "keywords", "from", "message"]
}

Rules:
- "דייט" / "בת זוג" / "זוגי" → occasion: "date"
- "חברים" / "בנים" / "חבר'ה" → occasion: "friends"  
- "משפחה" / "הורים" / "ילדים" → occasion: "family"
- "לבד" → occasion: "solo"
- "עבודה" / "פגישה" / "עסקי" → occasion: "work"
- "יום הולדת" / "חגיגה" / "אירוע" → occasion: "celebration"
- "הליכה" / "קרוב" → location: "walking"
- "נסוע" / "לנסוע" / "רחוק" → location: "willing_to_travel"
- "תל אביב" → location: "tel_aviv"
- "איטלקי" / "פסטה" / "פיצה" → cuisine: "Italian"
- "אסייתי" / "סושי" / "סיני" / "תאילנדי" → cuisine: "Asian"
- "בשרים" / "סטייק" / "המבורגר" → cuisine: "Steakhouse"
- "בריא" / "סלט" / "טבעוני" / "צמחוני" → cuisine: "Healthy"
- "ים תיכוני" / "ישראלי" / "מזרחי" → cuisine: "Israeli"
- "בירה" / "בר" / "משקאות" / "קוקטיילים" → cuisine: "Bar"
- "רומנטי" / "אינטימי" → vibe: "romantic"
- "זול" / "תקציב נמוך" → budget: "cheap"
- "יקר" / "מפנק" → budget: "expensive"
- Small talk: greetings, thanks, how are you, etc.
- isComplete = true ONLY if user provided MULTIPLE pieces of info (e.g. "מסעדה איטלקית לדייט" has both cuisine AND occasion)
- A single word like "חברים" or "דייט" alone is NOT complete

Return ONLY valid JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 400,
    });

    const text = response.choices[0].message.content || '{}';
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Intent parsing failed:', e);
    return {
      intent: 'search',
      extractedSlots: {},
      sentiment: 'neutral',
      isComplete: false,
      keywords: [],
    };
  }
}

// ============================================
// STATE DETERMINATION
// ============================================

function determineState(
  context: ConversationContext, 
  understanding: IntentUnderstanding
): ConversationState {
  
  // If small talk detected
  if (understanding.intent === 'small_talk' || understanding.intent === 'greeting') {
    return 'small_talk';
  }

  // Check what slots we have
  const slots = context.slots;
  const hasOccasion = !!slots.occasion;
  const hasLocation = !!slots.location;
  const hasCuisine = !!slots.cuisine;
  const hasBudget = !!slots.budget;
  
  // Count filled slots 
  const coreSlots = [hasOccasion, hasLocation, hasCuisine, hasBudget].filter(Boolean).length;
  
  // Need at least 3 out of 4 core slots (occasion, location, cuisine, budget) to search
  // This ensures we ask at least 3 questions before recommending for better results
  // MUST have occasion + location at minimum
  const canSearch = coreSlots >= 3 && hasOccasion && hasLocation;

  if (canSearch) {
    return 'ready_to_search';
  }

  return 'gathering_info';
}

// ============================================
// RESPONSE HANDLERS
// ============================================

async function handleSmallTalk(
  message: string, 
  profile: UserProfile,
  isFirst: boolean
): Promise<AgentResponse> {
  
  // For greetings/small talk, always ask about occasion first
  // This keeps chips consistent with the question
  const greeting = profile.firstName ? `היי ${profile.firstName}!` : 'היי!';
  
  const messages = [
    `${greeting} מה קורה? עם מי יוצאים לאכול? 😊`,
    `${greeting} מה נשמע? מחפש מקום לדייט או יציאה עם חברים?`,
    `${greeting} איזה כיף! מה האירוע - דייט, חברים, או משהו אחר?`,
  ];
  
  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  return {
    message: randomMessage,
    chips: [
      { label: 'דייט', value: 'date', emoji: '💕' },
      { label: 'חברים', value: 'friends', emoji: '👥' },
      { label: 'משפחה', value: 'family', emoji: '👨‍👩‍👧' },
      { label: 'לבד', value: 'solo', emoji: '🧘' },
    ],
    questionType: 'occasion',
  };
}

async function handleGathering(
  context: ConversationContext,
  profile: UserProfile,
  isFirst: boolean,
  understanding: IntentUnderstanding
): Promise<AgentResponse> {
  
  const slots = context.slots;
  
  // Determine what to ask next (priority order)
  let questionType: string;
  let question: string;
  let chips: Chip[];

  // Priority 1: Occasion (who/why)
  if (!slots.occasion) {
    questionType = 'occasion';
    const greetingPrefix = isFirst && profile.firstName ? `היי ${profile.firstName}! ` : '';
    question = greetingPrefix + 'עם מי יוצאים או מה האירוע? 😊';
    chips = [
      { label: 'דייט', value: 'date', emoji: '💕' },
      { label: 'חברים', value: 'friends', emoji: '👥' },
      { label: 'משפחה', value: 'family', emoji: '👨‍👩‍👧' },
      { label: 'לבד', value: 'solo', emoji: '🧘' },
      { label: 'עבודה', value: 'work', emoji: '💼' },
    ];
  }
  // Priority 2: Location
  else if (!slots.location) {
    questionType = 'location';
    const occasionText = slots.occasion === 'date' ? 'לדייט' :
                        slots.occasion === 'friends' ? 'עם החברים' :
                        slots.occasion === 'family' ? 'למשפחה' : '';
    question = `איפה תרצו לחפש ${occasionText}? 📍`;
    chips = [
      { label: 'במרחק הליכה', value: 'walking', emoji: '🚶' },
      { label: 'מוכן לנסוע', value: 'willing_to_travel', emoji: '🚗' },
      { label: 'בכל תל אביב', value: 'tel_aviv', emoji: '🏙️' },
    ];
  }
  // Priority 3: Cuisine
  else if (!slots.cuisine) {
    questionType = 'cuisine';
    const occasionContext = slots.occasion === 'date' ? 'לדייט' : 
                           slots.occasion === 'friends' ? 'עם החברים' : '';
    question = `איזה סוג אוכל בא לכם ${occasionContext}? 🍽️`;
    chips = [
      { label: 'איטלקי', value: 'italian', emoji: '🍝' },
      { label: 'אסייתי', value: 'asian', emoji: '🍜' },
      { label: 'בריא', value: 'healthy', emoji: '🥗' },
      { label: 'בשרים', value: 'steak', emoji: '🥩' },
      { label: 'ים תיכוני', value: 'mediterranean', emoji: '🫒' },
      { label: 'תפתיע אותי', value: 'surprise', emoji: '🎲' },
    ];
  }
  // Priority 4: Budget
  else if (!slots.budget) {
    questionType = 'budget';
    question = 'מה התקציב? 💰';
    chips = [
      { label: 'חסכוני', value: 'cheap', emoji: '💵' },
      { label: 'בינוני', value: 'moderate', emoji: '💳' },
      { label: 'מפנק', value: 'expensive', emoji: '💎' },
      { label: 'לא משנה', value: 'any', emoji: '🤷' },
    ];
  }
  // Have enough - but ask for vibe to improve results
  else {
    questionType = 'vibe';
    question = 'איזה אווירה אתם מחפשים? ✨';
    chips = [
      { label: 'רומנטי', value: 'romantic', emoji: '💕' },
      { label: 'קז\'ואל', value: 'casual', emoji: '😎' },
      { label: 'מפנק', value: 'upscale', emoji: '🥂' },
      { label: 'חי ותוסס', value: 'lively', emoji: '🎉' },
    ];
  }

  // Add acknowledgment of what we understood
  let acknowledgment = '';
  if (understanding.extractedSlots.occasion) {
    const occasionText: Record<string, string> = {
      'date': 'דייט! 💕',
      'friends': 'יציאה עם חברים! 🎉',
      'family': 'ארוחה משפחתית! 👨‍👩‍👧',
      'solo': 'לאכול לבד! 🧘',
      'work': 'פגישת עבודה! 💼',
      'celebration': 'חגיגה! 🎊',
    };
    acknowledgment = occasionText[understanding.extractedSlots.occasion] || '';
  }
  if (understanding.extractedSlots.cuisine) {
    const cuisineAck = acknowledgment ? ' ' : '';
    acknowledgment += `${cuisineAck}אוכל ${understanding.extractedSlots.cuisine} 👌`;
  }
  if (understanding.extractedSlots.location) {
    const locationText: Record<string, string> = {
      'walking': 'במרחק הליכה 🚶',
      'willing_to_travel': 'מוכנים לנסוע 🚗',
      'tel_aviv': 'בתל אביב 🏙️',
    };
    const locAck = acknowledgment ? ' ' : '';
    acknowledgment += `${locAck}${locationText[understanding.extractedSlots.location] || ''}`;
  }
  if (understanding.extractedSlots.budget) {
    const budgetText: Record<string, string> = {
      'cheap': 'תקציב חסכוני 💵',
      'moderate': 'תקציב בינוני 💳',
      'expensive': 'מפנקים! 💎',
      'any': '',
    };
    const budgetAck = budgetText[understanding.extractedSlots.budget];
    if (budgetAck) {
      const sep = acknowledgment ? ' ' : '';
      acknowledgment += `${sep}${budgetAck}`;
    }
  }

  const message = acknowledgment 
    ? `${acknowledgment}\n\n${question}`
    : question;

  return {
    message,
    chips,
    questionType,
  };
}

async function handleSearch(
  context: ConversationContext,
  userLocation: { lat: number; lng: number } | null,
  profile: UserProfile
): Promise<AgentResponse> {
  
  // Default to Tel Aviv center if no valid location
  const TEL_AVIV_CENTER = { lat: 32.0853, lng: 34.7818 };
  
  // Validate location - must be in Israel region
  let effectiveLocation = TEL_AVIV_CENTER;
  if (userLocation && 
      typeof userLocation.lat === 'number' && 
      typeof userLocation.lng === 'number' &&
      userLocation.lat >= 29.5 && userLocation.lat <= 33.5 &&
      userLocation.lng >= 34 && userLocation.lng <= 36) {
    effectiveLocation = userLocation;
  }
  
  console.log(`📍 User location: ${JSON.stringify(userLocation)} → Effective: ${JSON.stringify(effectiveLocation)}`);

  // Build context for recommendation API
  const recommendContext = {
    where: mapLocationSlot(context.slots.location),
    withWho: context.slots.occasion,
    purpose: mapOccasionToPurpose(context.slots.occasion),
    budget: context.slots.budget,
    when: context.slots.timing,
    cuisinePreference: context.slots.cuisine,
  };

  // Show searching message
  const searchingMessages = [
    'מחפש את המקומות המושלמים בשבילך... 🔍',
    'רגע, בודק כמה מקומות מעולים... ✨',
    'מסנן את ההמלצות הטובות ביותר... 🎯',
  ];
  const searchMsg = searchingMessages[Math.floor(Math.random() * searchingMessages.length)];

  try {
    // Call recommendation API with timeout
    const recommendUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/agent/recommend`;
    
    console.log('🔍 Calling recommend API...');
    console.log('📋 Recommend context:', recommendContext);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const recommendResponse = await fetch(recommendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: recommendContext,
        userLocation: effectiveLocation,
        conversationSummary: buildSearchSummary(context.slots),
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!recommendResponse.ok) {
      const errorText = await recommendResponse.text();
      console.error('❌ Recommend API error:', recommendResponse.status, errorText);
      throw new Error(`Recommend API error: ${recommendResponse.status}`);
    }

    const data = await recommendResponse.json();
    const recommendations = data.recommendations || [];
    
    console.log(`✅ Got ${recommendations.length} recommendations`);

    if (recommendations.length === 0) {
      return {
        message: 'לא מצאתי מקומות שמתאימים בדיוק, אולי ננסה לחפש קצת אחרת? 🤔',
        chips: [
          { label: 'הרחב חיפוש', value: 'expand_search', emoji: '🔄' },
          { label: 'סוג אוכל אחר', value: 'change_cuisine', emoji: '🍽️' },
          { label: 'התחל מחדש', value: 'start_over', emoji: '🆕' },
        ],
      };
    }

    // Build success message
    const successMessages = [
      `מצאתי ${recommendations.length} מקומות מושלמים! 🎉`,
      `הנה ${recommendations.length} המלצות מעולות! ✨`,
      `יש לי ${recommendations.length} מקומות שתאהבו! 💫`,
    ];
    
    const occasion = context.slots.occasion;
    let personalizedMsg = successMessages[Math.floor(Math.random() * successMessages.length)];
    
    if (occasion === 'date') {
      personalizedMsg = `מצאתי ${recommendations.length} מקומות מושלמים לדייט! 💕`;
    } else if (occasion === 'friends') {
      personalizedMsg = `יש לי ${recommendations.length} מקומות שווים ליציאה עם החברים! 🎉`;
    } else if (occasion === 'family') {
      personalizedMsg = `הנה ${recommendations.length} מקומות מעולים למשפחה! 👨‍👩‍👧`;
    }

    return {
      message: personalizedMsg,
      chips: [],
      recommendations,
    };

  } catch (error: any) {
    console.error('❌ Search error:', error?.message || error);
    
    // Check if it was a timeout
    if (error?.name === 'AbortError') {
      return {
        message: 'החיפוש לקח יותר מדי זמן 😅 בוא ננסה שוב?',
        chips: [
          { label: 'נסה שוב', value: 'retry', emoji: '🔄' },
          { label: 'חיפוש פשוט יותר', value: 'simpler', emoji: '✨' },
        ],
      };
    }
    
    return {
      message: 'אופס, משהו השתבש. בוא ננסה שוב? 🙏',
      chips: [
        { label: 'נסה שוב', value: 'retry', emoji: '🔄' },
        { label: 'התחל מחדש', value: 'start_over', emoji: '🆕' },
      ],
    };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function mapLocationSlot(location: string | null): string {
  if (!location) return 'tel_aviv';
  
  const map: Record<string, string> = {
    'walking': 'walking_distance',
    'nearby': 'walking_distance',
    'willing_to_travel': 'willing_to_travel',
    'tel_aviv': 'tel_aviv',
  };
  
  return map[location] || 'tel_aviv';
}

function mapOccasionToPurpose(occasion: string | null): string | null {
  if (!occasion) return null;
  
  const map: Record<string, string> = {
    'date': 'romantic_dinner',
    'friends': 'casual_meal',
    'family': 'casual_meal',
    'solo': 'casual_meal',
    'work': 'business',
    'celebration': 'celebration',
  };
  
  return map[occasion] || null;
}

function buildSearchSummary(slots: SearchSlots): string {
  const parts: string[] = [];
  
  if (slots.occasion) parts.push(`Looking for ${slots.occasion} dining`);
  if (slots.cuisine) parts.push(`${slots.cuisine} food`);
  if (slots.vibe) parts.push(`${slots.vibe} atmosphere`);
  if (slots.budget) parts.push(`${slots.budget} budget`);
  if (slots.location) parts.push(`in ${slots.location} area`);
  
  return parts.join(', ') || 'restaurant in Tel Aviv';
}
