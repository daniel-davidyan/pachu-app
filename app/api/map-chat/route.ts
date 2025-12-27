import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Helper function to detect language from message
function detectLanguage(message: string): 'he' | 'en' | 'other' {
  // Check for Hebrew characters
  const hebrewChars = message.match(/[\u0590-\u05FF]/g);
  if (hebrewChars && hebrewChars.length > 3) {
    return 'he';
  }
  
  // Check for English (Latin characters)
  const englishChars = message.match(/[a-zA-Z]/g);
  if (englishChars && englishChars.length > 3) {
    return 'en';
  }
  
  return 'other';
}

// Helper function to detect if user is doing a focused search for a specific restaurant
function detectFocusedSearch(message: string, language: string): { isFocused: boolean; restaurantName?: string; isQuestion: boolean } {
  const lowerMessage = message.toLowerCase().trim();
  
  // Patterns for asking opinion about a place (English)
  const questionPatternsEn = [
    /what (do you|did you) think (about|of)/i,
    /how (is|was|'s)/i,
    /tell me about/i,
    /know (about|of)/i,
    /heard of/i,
    /recommend/i,
    /should i (go|try)/i,
    /is .+ good/i,
    /worth (it|going)/i,
  ];
  
  // Patterns for asking opinion about a place (Hebrew)
  const questionPatternsHe = [
    /מה אתה חושב על/i,
    /איך/i,
    /ספר לי על/i,
    /מכיר את/i,
    /שמעת על/i,
    /ממליץ/i,
    /כדאי/i,
    /טוב/i,
    /שווה/i,
  ];
  
  const patterns = language === 'he' ? questionPatternsHe : questionPatternsEn;
  const isQuestion = patterns.some(pattern => pattern.test(message));
  
  // Patterns for direct search (English)
  const directSearchPatternsEn = [
    /^find (me )?(.+)$/i,
    /^search (for )?(.+)$/i,
    /^show (me )?(.+)$/i,
    /^i want (to go to|to eat at|to try) (.+)$/i,
    /^take me to (.+)$/i,
    /^looking for (.+)$/i,
  ];
  
  // Patterns for direct search (Hebrew)
  const directSearchPatternsHe = [
    /^תמצא לי (.+)$/i,
    /^חפש (.+)$/i,
    /^תראה לי (.+)$/i,
    /^אני רוצה (ללכת ל|לאכול ב|לנסות) (.+)$/i,
    /^קח אותי ל(.+)$/i,
    /^מחפש (.+)$/i,
  ];
  
  const searchPatterns = language === 'he' ? directSearchPatternsHe : directSearchPatternsEn;
  
  for (const pattern of searchPatterns) {
    const match = message.match(pattern);
    if (match) {
      const restaurantName = match[match.length - 1];
      // If it looks like a specific place name (capitalized or contains numbers)
      if (restaurantName && (restaurantName.match(/[A-Z]/) || restaurantName.match(/\d/))) {
        return { isFocused: true, restaurantName, isQuestion: false };
      }
    }
  }
  
  // If message is short and looks like a place name (2-5 words, possibly with numbers)
  const words = message.trim().split(/\s+/);
  if (words.length >= 2 && words.length <= 5 && !isQuestion) {
    // Check if it contains capital letters or numbers (likely a proper name)
    if (message.match(/[A-Z]/) || message.match(/\d/)) {
      return { isFocused: true, restaurantName: message, isQuestion: false };
    }
  }
  
  return { isFocused: false, isQuestion };
}

export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory, location } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Detect language from first user message if this is the start of conversation
    const userMessages = conversationHistory.filter((m: any) => m.role === 'user');
    const isFirstMessage = userMessages.length === 0;
    const detectedLanguage = isFirstMessage ? detectLanguage(message) : 'en'; // Default to en for subsequent messages
    
    // Detect if this is a focused search for a specific restaurant
    const focusedSearch = detectFocusedSearch(message, detectedLanguage);
    
    // Count how many questions we've asked and how many the user has answered
    const assistantMessages = conversationHistory.filter((m: any) => m.role === 'assistant');
    const questionCount = assistantMessages.length;
    const userResponseCount = userMessages.length;
    
    // Language-specific instructions
    const languageInstructions = detectedLanguage === 'he' 
      ? `**קריטי - מצב עברית בלבד:**
- המשתמש מדבר עברית
- עליך לנהל את כל השיחה בעברית בלבד - כל שאלה, כל תשובה, כל הודעה
- אסור לעבור לאנגלית! תמיד עברית!
- אם אתה מוכן להציג מסעדות, פשוט השאר את ההודעה ריקה`
      : `**CRITICAL - English Mode Only:**
- User is speaking English
- Conduct the ENTIRE conversation in English only - every question, every response, every message
- Do NOT switch to other languages! Always English!
- If ready to show restaurants, just leave message empty`;
    
    // System prompt for conversational restaurant finding
    const systemPrompt = `You are Pachu, a world-class restaurant expert and personal dining concierge. You have deep knowledge about restaurants, cuisines, and dining experiences. Your mission is to understand exactly what the user needs through natural, expert-level conversation, then deliver the 3 perfect restaurant recommendations.

${languageInstructions}

## ⚠️ CRITICAL - NEVER SWITCH LANGUAGES:
**You detected the user speaks ${detectedLanguage === 'he' ? 'HEBREW (עברית)' : 'ENGLISH'}.**
- Every single word you write must be in ${detectedLanguage === 'he' ? 'HEBREW' : 'ENGLISH'}
- Do NOT write ANY words in ${detectedLanguage === 'he' ? 'English' : 'Hebrew'}
- Do NOT mix languages
- Stay ${detectedLanguage === 'he' ? 'עברית' : 'English'} from start to finish!
- When ready to show restaurants, leave message EMPTY (no text at all)

## Your Expertise:
You're like a trusted local friend who knows every restaurant. You ask thoughtful questions and really listen. You understand that dining is about the whole experience - the food, the vibe, the company, the occasion, and the budget.

## Conversation Style:
- Talk like a knowledgeable friend, not a bot
- Ask ONE clear question at a time
- Keep questions short and natural (like texting a friend)
- Use emojis naturally: 🍽️ 💰 ❤️ 🌮 🎉 👥 🚶 🚗
- Be enthusiastic but not over-the-top
- **SPEAK IN THE USER'S LANGUAGE** (${detectedLanguage === 'he' ? 'Hebrew' : 'English'})

## Information to Gather (ask 1-4 questions based on what user provides):

**Essential Info:**
1. **Mood & Cuisine** - What are they craving? What vibe?
2. **Occasion** - Solo? Date? Friends? Family? Business?
3. **Timing** - Now? Tonight? Weekend? Special time?
4. **Location** - Which city? Nearby?

**Budget - OPTIONAL:**
- DO NOT ask about budget/price unless user mentions it first
- If user says "cheap", "expensive", "budget", etc. → note it and use it
- Otherwise, skip budget completely

## Conversation Flow:

**If user gives minimal info** (e.g., "I want pizza" or "אני רוצה פיצה"):
→ Ask 3-4 targeted questions to understand their full context

**If user gives moderate info** (e.g., "Looking for a romantic Italian place for dinner tonight"):
→ Ask 1-2 clarifying questions (budget? distance?)

**If user gives detailed info** (e.g., "Need a mid-range sushi place for 2, walking distance, for tonight around 7pm"):
→ Just search! Set readyToShow: true immediately

## Current State:
- Questions asked: ${questionCount}
- User responses: ${userResponseCount}
- Stage: ${userResponseCount === 0 ? 'Initial ask - understand their basic need' : userResponseCount === 1 ? 'Got first answer - ask follow-ups or search if enough info' : userResponseCount === 2 ? 'Got 2 answers - ask final question if needed or search' : userResponseCount === 3 ? 'Got 3 answers - search now!' : 'Time to search!'}

**IMPORTANT LIMITS:**
- Maximum 4 questions total
- After 4th user response → MUST set readyToShow: true
- If user provides all info → search immediately (even on 1st message)

## Special Case - Focused Search Detected:
${focusedSearch.isFocused ? `
🎯 USER IS SEARCHING FOR A SPECIFIC PLACE: "${focusedSearch.restaurantName}"
${focusedSearch.isQuestion ? `
→ This is a QUESTION about the place. Respond conversationally:
  - Acknowledge you'll look into it
  - Ask if they want you to show them the place or give alternatives
  - Set searchMode: "specific" and searchQuery: "${focusedSearch.restaurantName}"
  - Set readyToShow: false (wait for their answer)
` : `
→ This is a DIRECT SEARCH. Immediately:
  - Set searchMode: "specific" and searchQuery: "${focusedSearch.restaurantName}"
  - Set readyToShow: true
  - No message needed
`}
` : 'No focused search detected - proceed with conversation'}

## Data Extraction Format:
After EVERY response, include this JSON (hidden from user):
<data>
{
  "cuisineTypes": [],
  "searchQuery": "",
  "priceLevel": null,
  "budget": "",
  "occasion": "",
  "timing": "",
  "distance": "",
  "specialPreferences": [],
  "searchMode": "general",
  "readyToShow": false
}
</data>

## Extraction Rules:

**CRITICAL - Keep User's Language:**
- Extract ALL fields in the user's original language (${detectedLanguage === 'he' ? 'Hebrew' : 'English'})
- DO NOT translate cuisine types or any other terms
- Use exact terms the user used for maximum search accuracy with Google Places API

**cuisineTypes** (array) - IN USER'S LANGUAGE:
${detectedLanguage === 'he' ? `
- Hebrew examples: "המבורגר", "פיצה", "סושי", "עוף סיני", "מלוואח", "שווארמה", "פלאפל", "איטלקי", "סיני", "ים תיכוני"
- Keep EXACTLY as user said it: "עוף סיני" stays "עוף סיני", "מלוואח" stays "מלוואח"
` : `
- English examples: "italian", "japanese", "chinese", "mexican", "pizza", "sushi", "burger", "seafood"
- Keep EXACTLY as user said it
`}

**searchQuery** (string) - IN USER'S LANGUAGE:
- The main search term to use with Google Places API
- Use specific food/cuisine terms from conversation
${detectedLanguage === 'he' ? `
- Hebrew examples: "המבורגר", "מסעדת עוף סיני", "מלוואח", "פיצה"
` : `
- English examples: "burger", "chicken restaurant", "pizza place"
`}

**priceLevel** (number 1-4):
${detectedLanguage === 'he' ? `
- 1: "זול", "בזול", "עד 50 שקל", "תקציב נמוך"
- 2: "בינוני", "סביר", "50-100 שקל"
- 3: "יקר", "מפואר", "100-150 שקל"
- 4: "יוקרתי", "מאוד יקר", "מעל 150 שקל"
` : `
- 1: "cheap", "budget", "affordable", "under 50 shekels"
- 2: "moderate", "mid-range", "50-100 shekels"
- 3: "upscale", "pricey", "100-150 shekels"
- 4: "luxury", "expensive", "150+ shekels"
`}

**budget** (string): Extract exact budget mentions

**occasion** (string):
${detectedLanguage === 'he' ? `
- "לבד", "בודד", "סולו"
- "דייט", "רומנטי", "עם בן/בת זוג"
- "חברים", "קבוצה"
- "משפחה", "עם ילדים"
- "עסקים", "פגישת עבודה"
` : `
- "solo", "alone"
- "date", "romantic", "partner"
- "friends", "group"
- "family", "kids"
- "business", "work meeting"
`}

**timing** (string):
${detectedLanguage === 'he' ? `
- "עכשיו", "מיד", "כרגע"
- "הערב", "הלילה"
- "מחר", "סוף שבוע"
- "ארוחת צהריים", "ארוחת ערב"
` : `
- "now", "immediately", "asap"
- "tonight", "this evening"
- "tomorrow", "weekend"
- "lunch", "dinner"
`}

**distance** (string):
${detectedLanguage === 'he' ? `
- "ברגל", "קרוב", "במרחק הליכה"
- "נסיעה קצרה", "קורקינט", "5 דקות"
- "נכון לנסוע", "לא אכפת לי מרחק"
` : `
- "walking distance", "nearby", "close"
- "short ride", "scooter", "5 minutes"
- "willing to drive", "don't care about distance"
`}

**city** (string) - VERY IMPORTANT:
${detectedLanguage === 'he' ? `
- חלץ את שם העיר אם המשתמש מזכיר אותה!
- דוגמאות: "תל אביב", "ירושלים", "חיפה", "הרצליה", "באר שבע", "אילת", "נתניה", "רעננה", "כפר סבא", "פתח תקווה"
- אם המשתמש לא מזכיר עיר, השאר ריק
` : `
- Extract the city name if user mentions it!
- Examples: "Tel Aviv", "Jerusalem", "Haifa", "Herzliya", "Beer Sheva", "Eilat", "Netanya"
- If user doesn't mention a city, leave empty
`}

**specialPreferences** (array) - IN USER'S LANGUAGE:
${detectedLanguage === 'he' ? `
- "רומנטי", "שקט", "אינטימי"
- "חוץ", "מרפסת", "גינה"
- "ידידותי לחיות", "מותר עם כלבים"
- "מוזיקה חיה", "בידור"
- "נוף", "גג", "על הים"
- "קז'ואל", "נינוח"
- "טרנדי", "אינסטגרמי"
- "מסורתי", "אותנטי"
` : `
- "romantic", "quiet", "intimate"
- "outdoor", "patio", "garden"
- "pet-friendly", "dogs allowed"
- "live music", "entertainment"
- "view", "rooftop", "waterfront"
- "casual", "relaxed"
- "trendy", "instagram-worthy"
- "traditional", "authentic"
`}

**searchMode**:
- "general": Normal recommendation flow
- "specific": User is searching for a specific restaurant by name

**searchQuery** (string):
- If searchMode is "specific", extract the restaurant name
- If searchMode is "general", you can optionally put a more specific search term here (e.g., "burger joint", "italian restaurant", "sushi bar")
- This helps find better results when user is specific about what they want
- **KEEP IN USER'S LANGUAGE** - DO NOT TRANSLATE

**readyToShow** (boolean):
- true: You have enough info to search
- false: Need to ask more questions

## Response Guidelines:
- If readyToShow is true and searchMode is "general": Empty message (just show restaurants)
- If readyToShow is true and searchMode is "specific": Empty message (just show the specific restaurant)
- If readyToShow is false: Ask your next question (conversational and natural)

Remember: You're an expert who cares about helping people have amazing dining experiences. Ask smart questions, listen carefully, and deliver perfect recommendations! 🌟`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.8,
      max_tokens: 500,
    });

    const fullResponse = completion.choices[0].message.content || '';
    console.log('🤖 AI Response:', fullResponse.substring(0, 200) + (fullResponse.length > 200 ? '...' : ''));
    
    // Simple extraction - just check if AI says it's ready to show restaurants
    let readyToShow = false;
    const dataMatch = fullResponse.match(/<data>([\s\S]*?)<\/data>/);
    if (dataMatch) {
      try {
        const parsed = JSON.parse(dataMatch[1]);
        readyToShow = parsed.readyToShow || false;
        console.log('📊 Extracted readyToShow:', readyToShow);
      } catch (e) {
        console.error('Error parsing readyToShow:', e);
      }
    } else {
      console.warn('⚠️ No <data> block found in AI response');
    }

    // Force readyToShow after 4 user responses
    if (userResponseCount >= 4) {
      console.log('⚡ Forcing readyToShow=true (4+ responses)');
      readyToShow = true;
    }

    // Remove the data JSON from the visible message
    let visibleMessage = fullResponse.replace(/<data>[\s\S]*?<\/data>/, '').trim();
    
    // If showing restaurants, remove the message text entirely
    if (readyToShow) {
      visibleMessage = '';
      console.log('✅ readyToShow=true, clearing message');
    }

    // If ready to show restaurants, send entire conversation to OpenAI for recommendations
    let restaurants: any[] = [];
    if (readyToShow && location) {
      try {
        console.log('🤖 Sending full conversation to OpenAI for restaurant recommendations...');
        
        // Build the recommendation request - send ENTIRE conversation as-is
        const locationContext = detectedLanguage === 'he'
          ? `מיקום נוכחי של המשתמש (GPS): ${location.lat}, ${location.lng}`
          : `User's current location (GPS): ${location.lat}, ${location.lng}`;
        
        const recommendationPrompt = detectedLanguage === 'he'
          ? `הנה השיחה המלאה שלי עם הלקוח:

${conversationHistory.map((m: any) => `${m.role === 'user' ? 'לקוח' : 'אני'}: ${m.content}`).join('\n')}
לקוח: ${message}

${locationContext}

בהתבסס על השיחה המלאה הזו ומיקום המשתמש, אנא המלץ על בדיוק 3 מסעדות ספציפיות שמתאימות בול למה שהלקוח רוצה.
אם הלקוח הזכיר עיר ספציפית (כמו "ירושלים", "תל אביב", "הרצליה"), המלץ על מסעדות בעיר הזו.
אם הלקוח אמר "קרוב" או "במרחק הליכה", המלץ על מסעדות קרובות למיקום ה-GPS שצוין.

חשוב: תן רק את השמות המדויקים של המסעדות כפי שהן מופיעות בגוגל/במפות גוגל.

פורמט:
1. [שם מסעדה מדויק]
2. [שם מסעדה מדויק]
3. [שם מסעדה מדויק]`
          : `Here is my full conversation with the client:

${conversationHistory.map((m: any) => `${m.role === 'user' ? 'Client' : 'Me'}: ${m.content}`).join('\n')}
Client: ${message}

${locationContext}

Based on this entire conversation and the user's location, please recommend exactly 3 specific restaurants that perfectly match what the client wants.
If the client mentioned a specific city (like "Jerusalem", "Tel Aviv", "Herzliya"), recommend restaurants in that city.
If the client said "nearby" or "walking distance", recommend restaurants close to the GPS location provided.

Important: Provide only the exact restaurant names as they appear on Google/Google Maps.

Format:
1. [Exact restaurant name]
2. [Exact restaurant name]
3. [Exact restaurant name]`;

        console.log('📝 Sending to OpenAI:\n', recommendationPrompt);

        // Ask OpenAI for recommendations based on FULL conversation
        const recommendationCompletion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { 
              role: 'system', 
              content: detectedLanguage === 'he'
                ? `אתה מומחה מסעדות מקומי שמכיר מסעדות בישראל מצוין. קרא את כל השיחה בקפידה והבן מה הלקוח באמת רוצה - סוג האוכל, תקציב, עיר, מרחק, אווירה, וכו'. המלץ על 3 מסעדות אמיתיות שמתאימות בול.`
                : `You are a local restaurant expert who knows restaurants extremely well. Read the entire conversation carefully and understand what the client really wants - food type, budget, city, distance, atmosphere, etc. Recommend 3 real restaurants that are a perfect match.`
            },
            { role: 'user', content: recommendationPrompt }
          ],
          temperature: 0.7,
          max_tokens: 400,
        });

        const recommendationText = recommendationCompletion.choices[0].message.content || '';
        console.log('🎯 OpenAI recommendations:\n', recommendationText);

        // Parse restaurant names from the response
        const restaurantNames: string[] = [];
        const lines = recommendationText.split('\n');
        
        for (const line of lines) {
          // Match patterns like "1. Restaurant Name" or "- Restaurant Name"
          const match = line.match(/^[\d\-\*•]\s*[\.\):]?\s*(.+)$/);
          if (match && match[1]) {
            let name = match[1].trim();
            // Remove quotes if present
            name = name.replace(/^["']|["']$/g, '');
            if (name && name.length > 2) {
              restaurantNames.push(name);
            }
          }
        }

        console.log(`✅ Parsed ${restaurantNames.length} restaurant names:`, restaurantNames);

        // Search for each recommended restaurant on Google Places
        for (const restaurantName of restaurantNames.slice(0, 3)) {
          try {
            console.log(`🔍 Searching Google Places for: "${restaurantName}"`);
            const searchResponse = await fetch(
              `${request.nextUrl.origin}/api/restaurants/search?query=${encodeURIComponent(restaurantName)}&latitude=${location.lat}&longitude=${location.lng}`,
              { headers: request.headers }
            );
            const searchData = await searchResponse.json();
            
            if (searchData.restaurants && searchData.restaurants.length > 0) {
              // Take the first (best) match
              const restaurant = searchData.restaurants[0];
              console.log(`✓ Found: ${restaurant.name}`, {
                hasPhoto: !!restaurant.photoUrl,
                photoUrl: restaurant.photoUrl ? restaurant.photoUrl.substring(0, 100) + '...' : 'NO PHOTO',
                rating: restaurant.rating,
                address: restaurant.address?.substring(0, 50),
                placeId: restaurant.googlePlaceId
              });
              
              if (!restaurant.photoUrl) {
                console.warn(`⚠️ "${restaurant.name}" has no photo! Place ID: ${restaurant.googlePlaceId}`);
              }
              
              restaurants.push({
                ...restaurant,
                matchPercentage: 95,
                source: restaurant.source || 'google',
                recommendedBy: 'ai'
              });
            } else {
              console.warn(`✗ Could not find restaurant: "${restaurantName}"`);
            }
          } catch (error) {
            console.error(`Error searching for ${restaurantName}:`, error);
          }
        }

        console.log(`📍 Final: ${restaurants.length} restaurants found`);
        
      } catch (error) {
        console.error('Error getting AI recommendations:', error);
      }
    }

    // Final check: if we have restaurants, make sure message is empty
    if (restaurants.length > 0) {
      visibleMessage = '';
      console.log('🎯 Have restaurants, ensuring message is empty');
    }

    return NextResponse.json({
      message: visibleMessage,
      restaurants: restaurants.length > 0 ? restaurants : undefined,
      success: true,
    });
  } catch (error: any) {
    console.error('Map Chat API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get AI response' },
      { status: 500 }
    );
  }
}


