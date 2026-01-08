/**
 * Recommendation Pipeline V2 - Context Extraction
 * 
 * Extracts WHERE (location) and WHEN (timing) preferences from the conversation,
 * along with other preferences for embedding generation.
 */

import OpenAI from 'openai';
import {
  ConversationContext,
  LocationPreference,
  TimingPreference,
  ChatMessage,
} from './types';

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

function detectLanguage(text: string): 'he' | 'en' {
  const hebrewChars = text.match(/[\u0590-\u05FF]/g);
  if (hebrewChars && hebrewChars.length > 3) {
    return 'he';
  }
  return 'en';
}

// ============================================================================
// KEYWORD PATTERNS
// ============================================================================

const LOCATION_PATTERNS = {
  nearby: {
    he: ['קרוב אליי', 'קרוב', 'במרחק הליכה', 'ברגל', 'ליד', 'באזור'],
    en: ['nearby', 'close', 'walking distance', 'near me', 'around here', 'close by'],
  },
  anywhere: {
    he: ['לא משנה', 'בכל מקום', 'איפה שיש', 'לא אכפת', 'כל מקום'],
    en: ['anywhere', "don't care", "doesn't matter", 'any place', 'wherever'],
  },
  tel_aviv: {
    he: ['תל אביב', 'ת"א', 'תא', 'מרחק אוטובוס', 'בעיר'],
    en: ['tel aviv', 'tlv', 'bus distance', 'in the city'],
  },
};

const TIMING_PATTERNS = {
  now: {
    he: ['עכשיו', 'מיד', 'כרגע', 'עוד רגע', 'עוד מעט', 'פתוח עכשיו', 'פתוח', 'שפתוח', 'שיהיה פתוח', 'מקום פתוח'],
    en: ['now', 'right now', 'immediately', 'asap', 'right away', 'open now', 'currently open', "that's open"],
  },
  tonight: {
    he: ['הערב', 'הלילה', 'ערב', 'לארוחת ערב', 'דינר'],
    en: ['tonight', 'this evening', 'dinner', 'for dinner'],
  },
  tomorrow: {
    he: ['מחר', 'מחר בערב', 'מחר בצהריים'],
    en: ['tomorrow', 'tomorrow night', 'tomorrow evening'],
  },
  weekend: {
    he: ['סוף שבוע', 'שבת', 'שישי', 'יום שישי'],
    en: ['weekend', 'saturday', 'friday', 'this weekend'],
  },
};

const CITY_PATTERNS = {
  he: {
    'ירושלים': 'Jerusalem',
    'חיפה': 'Haifa',
    'באר שבע': 'Beer Sheva',
    'אילת': 'Eilat',
    'הרצליה': 'Herzliya',
    'רמת גן': 'Ramat Gan',
    'פתח תקווה': 'Petah Tikva',
    'נתניה': 'Netanya',
    'ראשון לציון': 'Rishon LeZion',
    'חולון': 'Holon',
  },
  en: {
    'jerusalem': 'Jerusalem',
    'haifa': 'Haifa',
    'beer sheva': 'Beer Sheva',
    'eilat': 'Eilat',
    'herzliya': 'Herzliya',
    'ramat gan': 'Ramat Gan',
    'petah tikva': 'Petah Tikva',
    'netanya': 'Netanya',
    'rishon lezion': 'Rishon LeZion',
    'holon': 'Holon',
  },
};

// ============================================================================
// PATTERN MATCHING HELPERS
// ============================================================================

function matchesAnyPattern(text: string, patterns: string[]): boolean {
  const lowerText = text.toLowerCase();
  return patterns.some(pattern => lowerText.includes(pattern.toLowerCase()));
}

function extractCity(text: string, language: 'he' | 'en'): string | undefined {
  const lowerText = text.toLowerCase();
  const cityMap = CITY_PATTERNS[language];
  
  for (const [pattern, cityName] of Object.entries(cityMap)) {
    if (lowerText.includes(pattern.toLowerCase())) {
      return cityName;
    }
  }
  
  return undefined;
}

// ============================================================================
// EXTRACT LOCATION PREFERENCE
// ============================================================================

function extractLocationPreference(conversationText: string, language: 'he' | 'en'): {
  preference: LocationPreference;
  specificCity?: string;
  maxDistanceMeters?: number;
} {
  // Check for specific city first
  const specificCity = extractCity(conversationText, language);
  if (specificCity) {
    return {
      preference: 'specific_city',
      specificCity,
      maxDistanceMeters: undefined,
    };
  }
  
  // Check for nearby patterns
  if (matchesAnyPattern(conversationText, LOCATION_PATTERNS.nearby[language])) {
    // Check if they specifically said walking distance
    const walkingPatterns = language === 'he' 
      ? ['במרחק הליכה', 'ברגל']
      : ['walking distance', 'walk'];
    
    const isWalking = matchesAnyPattern(conversationText, walkingPatterns);
    
    return {
      preference: 'nearby',
      maxDistanceMeters: isWalking ? 800 : 2000,
    };
  }
  
  // Check for Tel Aviv patterns
  if (matchesAnyPattern(conversationText, LOCATION_PATTERNS.tel_aviv[language])) {
    return {
      preference: 'tel_aviv',
      maxDistanceMeters: undefined,
    };
  }
  
  // Check for anywhere patterns
  if (matchesAnyPattern(conversationText, LOCATION_PATTERNS.anywhere[language])) {
    return {
      preference: 'anywhere',
      maxDistanceMeters: undefined,
    };
  }
  
  // Default: search in Tel Aviv (most restaurants are there)
  return {
    preference: 'tel_aviv',
    maxDistanceMeters: undefined,
  };
}

// ============================================================================
// EXTRACT TIMING PREFERENCE
// ============================================================================

function extractTimingPreference(conversationText: string, language: 'he' | 'en'): {
  timing: TimingPreference;
  specificTime?: string;
  specificDay?: number;
} {
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay();
  
  // Check for "now"
  if (matchesAnyPattern(conversationText, TIMING_PATTERNS.now[language])) {
    return {
      timing: 'now',
      specificTime: `${currentHour}:00`,
      specificDay: currentDay,
    };
  }
  
  // Check for "tonight"
  if (matchesAnyPattern(conversationText, TIMING_PATTERNS.tonight[language])) {
    return {
      timing: 'tonight',
      specificTime: '20:00', // Default dinner time
      specificDay: currentDay,
    };
  }
  
  // Check for "tomorrow"
  if (matchesAnyPattern(conversationText, TIMING_PATTERNS.tomorrow[language])) {
    const tomorrowDay = (currentDay + 1) % 7;
    return {
      timing: 'tomorrow',
      specificTime: '20:00',
      specificDay: tomorrowDay,
    };
  }
  
  // Check for "weekend"
  if (matchesAnyPattern(conversationText, TIMING_PATTERNS.weekend[language])) {
    // Find next Friday (5) or Saturday (6)
    let targetDay = currentDay;
    if (currentDay < 5) {
      targetDay = 5; // Friday
    } else if (currentDay === 5) {
      targetDay = 6; // Saturday
    } else {
      targetDay = 5; // Next Friday
    }
    
    return {
      timing: 'weekend',
      specificTime: '20:00',
      specificDay: targetDay,
    };
  }
  
  // Default: anytime
  return {
    timing: 'anytime',
  };
}

// ============================================================================
// EXTRACT CONTEXT USING LLM
// ============================================================================

export async function extractContextWithLLM(
  messages: ChatMessage[],
  openaiApiKey: string
): Promise<{
  cuisinePreferences: string[];
  occasion: string;
  vibe: string[];
  budget: string;
  dietaryRestrictions: string[];
}> {
  const openai = new OpenAI({ apiKey: openaiApiKey });
  
  // Build conversation text
  const conversationText = messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');
  
  const prompt = `Analyze this conversation and extract dining preferences.

Conversation:
${conversationText}

Extract the following (use the same language as the conversation):
1. cuisinePreferences: Array of cuisine types mentioned (e.g., ["italian", "pizza"] or ["איטלקי", "פיצה"])
2. occasion: The occasion (e.g., "date", "friends", "family", "business", "solo" or Hebrew equivalents)
3. vibe: Array of atmosphere preferences (e.g., ["romantic", "quiet"] or ["רומנטי", "שקט"])
4. budget: Budget preference if mentioned (e.g., "cheap", "moderate", "expensive" or "זול", "בינוני", "יקר")
5. dietaryRestrictions: Any dietary restrictions (e.g., ["vegetarian", "kosher"] or ["צמחוני", "כשר"])

Return ONLY valid JSON:
{
  "cuisinePreferences": [],
  "occasion": "",
  "vibe": [],
  "budget": "",
  "dietaryRestrictions": []
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a JSON extractor. Return ONLY valid JSON, no markdown.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 300,
    });
    
    const response = completion.choices[0]?.message?.content || '{}';
    
    // Parse JSON (handle potential markdown wrapping)
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '');
    }
    
    const parsed = JSON.parse(jsonStr);
    
    return {
      cuisinePreferences: parsed.cuisinePreferences || [],
      occasion: parsed.occasion || '',
      vibe: parsed.vibe || [],
      budget: parsed.budget || '',
      dietaryRestrictions: parsed.dietaryRestrictions || [],
    };
  } catch (error) {
    console.error('Error extracting context with LLM:', error);
    return {
      cuisinePreferences: [],
      occasion: '',
      vibe: [],
      budget: '',
      dietaryRestrictions: [],
    };
  }
}

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

export async function extractConversationContext(
  messages: ChatMessage[],
  openaiApiKey: string
): Promise<ConversationContext> {
  // Build full conversation text
  const conversationText = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');
  
  // Detect language from user messages
  const userMessages = messages.filter(m => m.role === 'user');
  const userText = userMessages.map(m => m.content).join(' ');
  const language = detectLanguage(userText);
  
  // Extract location preference
  const locationResult = extractLocationPreference(userText, language);
  
  // Extract timing preference
  const timingResult = extractTimingPreference(userText, language);
  
  // Extract other preferences using LLM
  const llmExtracted = await extractContextWithLLM(messages, openaiApiKey);
  
  return {
    // WHERE
    locationPreference: locationResult.preference,
    specificCity: locationResult.specificCity,
    maxDistanceMeters: locationResult.maxDistanceMeters,
    
    // WHEN
    timing: timingResult.timing,
    specificTime: timingResult.specificTime,
    specificDay: timingResult.specificDay,
    
    // WHAT
    cuisinePreferences: llmExtracted.cuisinePreferences,
    occasion: llmExtracted.occasion,
    vibe: llmExtracted.vibe,
    budget: llmExtracted.budget,
    dietaryRestrictions: llmExtracted.dietaryRestrictions,
    
    // Raw text for embedding
    conversationText,
    
    // Language
    language,
  };
}
