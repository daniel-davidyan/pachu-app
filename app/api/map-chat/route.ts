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
      ? `**CRITICAL - Hebrew Language Mode:**
- User is speaking HEBREW
- Conduct ALL conversation in Hebrew (questions, responses)
- Extract ALL information in HEBREW (cuisine types, preferences, etc.)
- Use HEBREW search terms for Google Places API (e.g., "עוף סיני", "מלוואח", "המבורגר")
- Keep everything in Hebrew for maximum search accuracy
- Examples: "המבורגר" stays "המבורגר", "עוף סיני" stays "עוף סיני", "מלוואח" stays "מלוואח"`
      : `**CRITICAL - English Language Mode:**
- User is speaking ENGLISH
- Conduct ALL conversation in English
- Extract ALL information in ENGLISH
- Use ENGLISH search terms for Google Places API
- Keep everything in English for maximum search accuracy`;
    
    // System prompt for conversational restaurant finding
    const systemPrompt = `You are Pachu, a world-class restaurant expert and personal dining concierge. You have deep knowledge about restaurants, cuisines, and dining experiences. Your mission is to understand exactly what the user needs through natural, expert-level conversation, then deliver the 3 perfect restaurant recommendations.

${languageInstructions}

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
2. **Budget** - How much they want to spend per person?
3. **Occasion** - Solo? Date? Friends? Family? Business?
4. **Timing** - Now? Tonight? Weekend? Special time?
5. **Distance** - How far willing to go? Walking? Quick ride? Drive?

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
    
    // Extract data from response
    let extractedData: any = {
      cuisineTypes: [],
      searchQuery: '',
      priceLevel: null,
      budget: '',
      occasion: '',
      timing: '',
      distance: '',
      specialPreferences: [],
      searchMode: 'general',
      readyToShow: false,
    };
    
    const dataMatch = fullResponse.match(/<data>([\s\S]*?)<\/data>/);
    if (dataMatch) {
      try {
        const parsed = JSON.parse(dataMatch[1]);
        extractedData = { ...extractedData, ...parsed };
      } catch (e) {
        console.error('Error parsing data:', e);
      }
    }

    // Force readyToShow after 4 user responses (increased from 2)
    if (userResponseCount >= 4) {
      extractedData.readyToShow = true;
    }

    // Remove the data JSON from the visible message
    let visibleMessage = fullResponse.replace(/<data>[\s\S]*?<\/data>/, '').trim();
    
    // If showing restaurants, remove the message text entirely
    if (extractedData.readyToShow) {
      visibleMessage = '';
    }

    // Build filters from extracted data
    const filters: any = {
      query: extractedData.searchQuery || message,
      cuisineTypes: extractedData.cuisineTypes || [],
      priceLevel: extractedData.priceLevel ? [extractedData.priceLevel] : undefined,
    };

    // Add special preferences as boolean flags
    if (extractedData.specialPreferences && extractedData.specialPreferences.length > 0) {
      for (const pref of extractedData.specialPreferences) {
        const lowerPref = pref.toLowerCase();
        if (lowerPref.includes('romantic')) filters.romantic = true;
        if (lowerPref.includes('family')) filters.familyFriendly = true;
        if (lowerPref.includes('outdoor') || lowerPref.includes('patio')) filters.outdoor = true;
        if (lowerPref.includes('pet')) filters.petFriendly = true;
      }
    }

    // If ready to show restaurants, fetch and return exactly 3 best matches
    let restaurants: any[] = [];
    if (extractedData.readyToShow && location) {
      try {
        // Determine search strategy based on searchMode
        if (extractedData.searchMode === 'specific' && extractedData.searchQuery) {
          // Focused search for specific restaurant
          const searchResponse = await fetch(
            `${request.nextUrl.origin}/api/restaurants/search?query=${encodeURIComponent(extractedData.searchQuery)}&latitude=${location.lat}&longitude=${location.lng}`,
            { headers: request.headers }
          );
          const searchData = await searchResponse.json();
          restaurants = (searchData.restaurants || []).slice(0, 3).map((r: any) => ({
            ...r,
            matchPercentage: 95, // High match since it's what they asked for
            source: r.source || 'google'
          }));
        } else {
          // General search with preferences
          // Determine radius based on distance preference
          let radius = 3000; // Default 3km
          const distanceLower = (extractedData.distance || '').toLowerCase();
          if (distanceLower.includes('walk') || distanceLower.includes('nearby') || distanceLower.includes('close')) {
            radius = 1000; // 1km for walking distance
          } else if (distanceLower.includes('scooter') || distanceLower.includes('short') || distanceLower.includes('quick')) {
            radius = 2000; // 2km for short ride
          } else if (distanceLower.includes('anywhere') || distanceLower.includes('drive') || distanceLower.includes("don't care")) {
            radius = 10000; // 10km for willing to drive
          }
          
          // Build search query with cuisine preferences
          let searchQuery = extractedData.searchQuery || '';
          
          // If no specific searchQuery but we have cuisine types, build one
          if (!searchQuery && extractedData.cuisineTypes && extractedData.cuisineTypes.length > 0) {
            // Use the first (most specific) cuisine term as-is in user's language
            searchQuery = extractedData.cuisineTypes[0];
            
            // Add "מסעדת" (restaurant) for Hebrew or "restaurant" for English if needed
            const restaurantWord = detectedLanguage === 'he' ? 'מסעדת' : 'restaurant';
            
            // Don't add "restaurant" if the term already implies it or is very specific
            const specificTerms = ['pizza', 'פיצה', 'burger', 'המבורגר', 'sushi', 'סושי'];
            const isSpecificTerm = specificTerms.some(term => 
              searchQuery.toLowerCase().includes(term.toLowerCase())
            );
            
            if (!isSpecificTerm && !searchQuery.includes('מסעדת') && !searchQuery.includes('restaurant')) {
              // Put restaurant word before the cuisine for Hebrew, after for English
              if (detectedLanguage === 'he') {
                searchQuery = `${restaurantWord} ${searchQuery}`;
              } else {
                searchQuery = `${searchQuery} ${restaurantWord}`;
              }
            }
          }
          
          // Use search API if we have specific cuisine types for better results
          let allRestaurants: any[] = [];
          if (searchQuery) {
            console.log(`🔍 Searching for (${detectedLanguage}):`, searchQuery);
            const searchResponse = await fetch(
              `${request.nextUrl.origin}/api/restaurants/search?query=${encodeURIComponent(searchQuery)}&latitude=${location.lat}&longitude=${location.lng}`,
              { headers: request.headers }
            );
            const searchData = await searchResponse.json();
            allRestaurants = searchData.restaurants || [];
            console.log(`Found ${allRestaurants.length} restaurants for "${searchQuery}"`);
          } else {
            // Fall back to nearby search
            const nearbyResponse = await fetch(
              `${request.nextUrl.origin}/api/restaurants/nearby?latitude=${location.lat}&longitude=${location.lng}&radius=${radius}`,
              { headers: request.headers }
            );
            const nearbyData = await nearbyResponse.json();
            allRestaurants = nearbyData.restaurants || [];
          }
          
          // Advanced scoring algorithm
          const scoredRestaurants = allRestaurants.map((r: any) => {
            let score = r.rating * 18; // Base score from rating (0-90)
            const matchReasons: string[] = [];
            
            // Cuisine matching (VERY IMPORTANT - increased weight)
            if (filters.cuisineTypes && filters.cuisineTypes.length > 0) {
              let cuisineMatchScore = 0;
              
              // Check restaurant name for cuisine keywords (case-insensitive, flexible)
              const nameLower = r.name.toLowerCase();
              const nameOriginal = r.name;
              
              for (const cuisine of filters.cuisineTypes) {
                const cuisineLower = cuisine.toLowerCase();
                
                // Direct match in name (any case)
                if (nameLower.includes(cuisineLower) || nameOriginal.includes(cuisine)) {
                  cuisineMatchScore += 40; // Strong match if in name
                  matchReasons.push('cuisine-in-name');
                }
              }
              
              // Check restaurant cuisineTypes (if available from Google)
              if (r.cuisineTypes) {
                for (const rCuisine of r.cuisineTypes) {
                  for (const userCuisine of filters.cuisineTypes) {
                    const rCuisineLower = rCuisine.toLowerCase();
                    const userCuisineLower = userCuisine.toLowerCase();
                    
                    // Flexible matching - any partial match counts
                    if (rCuisineLower.includes(userCuisineLower) || 
                        userCuisineLower.includes(rCuisineLower)) {
                      cuisineMatchScore += 30;
                      matchReasons.push('cuisine-type-match');
                      break; // Don't double-count same restaurant cuisine
                    }
                  }
                }
              }
              
              // If we searched for a specific cuisine and this restaurant doesn't match at all, heavily penalize
              if (searchQuery && cuisineMatchScore === 0) {
                score -= 50; // Heavy penalty for non-matching results
              } else {
                score += cuisineMatchScore;
              }
            }
            
            // Price level matching
            if (filters.priceLevel && filters.priceLevel.length > 0 && r.priceLevel) {
              if (filters.priceLevel.includes(r.priceLevel)) {
                score += 15;
                matchReasons.push('budget');
              } else {
                // Penalize if price is way off
                const priceDiff = Math.abs(r.priceLevel - filters.priceLevel[0]);
                score -= priceDiff * 5;
              }
            }
            
            // Special preferences matching
            if (filters.romantic && r.specialPreferences?.includes('romantic')) {
              score += 12;
              matchReasons.push('vibe');
            }
            if (filters.outdoor && r.specialPreferences?.includes('outdoor')) {
              score += 12;
              matchReasons.push('atmosphere');
            }
            if (filters.familyFriendly && r.specialPreferences?.includes('family-friendly')) {
              score += 12;
              matchReasons.push('family-friendly');
            }
            if (filters.petFriendly && r.specialPreferences?.includes('pet-friendly')) {
              score += 12;
              matchReasons.push('pet-friendly');
            }
            
            // High quality bonus
            if (r.rating >= 4.5) score += 10;
            if (r.rating >= 4.7) score += 5;
            if (r.totalReviews > 100) score += 8;
            if (r.totalReviews > 500) score += 5;
            
            // Popularity from friends
            if (r.visitedByFollowing && r.visitedByFollowing.length > 0) {
              score += Math.min(r.visitedByFollowing.length * 3, 15);
              matchReasons.push('friends');
            }
            
            return { 
              ...r, 
              matchScore: Math.max(0, score),
              matchReasons 
            };
          });
          
          // Filter out completely irrelevant results when we have a specific cuisine search
          let relevantRestaurants = scoredRestaurants;
          if (searchQuery && filters.cuisineTypes && filters.cuisineTypes.length > 0) {
            // Only keep restaurants with positive scores (matching cuisine)
            relevantRestaurants = scoredRestaurants.filter((r: any) => r.matchScore > 50);
            console.log(`Filtered to ${relevantRestaurants.length} relevant restaurants (score > 50)`);
            
            // If we filtered too aggressively and have less than 3, be more lenient
            if (relevantRestaurants.length < 3) {
              relevantRestaurants = scoredRestaurants.filter((r: any) => r.matchScore > 20);
              console.log(`Expanded to ${relevantRestaurants.length} restaurants (score > 20)`);
            }
          }
          
          // Sort by score and take top 3
          relevantRestaurants.sort((a: any, b: any) => b.matchScore - a.matchScore);
          restaurants = relevantRestaurants.slice(0, 3).map((r: any, index: any) => {
            // Calculate match percentage (60-100) based on relative ranking
            const maxScore = relevantRestaurants[0].matchScore;
            const percentage = maxScore > 0 
              ? Math.min(100, Math.max(70, Math.round((r.matchScore / maxScore) * 100)))
              : 75;
            
            console.log(`Restaurant: ${r.name}, Score: ${r.matchScore}, Match: ${percentage}%, Reasons: ${r.matchReasons.join(', ')}`);
            
            return {
              ...r,
              matchPercentage: index === 0 ? Math.max(percentage, 85) : percentage, // Boost top result
              source: r.source || 'google'
            };
          });
        }
      } catch (error) {
        console.error('Error fetching restaurants:', error);
      }
    }

    return NextResponse.json({
      message: visibleMessage,
      filters,
      restaurants: restaurants.length > 0 ? restaurants : undefined,
      extractedData: extractedData, // Send back for debugging/analytics
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


