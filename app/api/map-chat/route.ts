import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Helper function to detect if user is doing a focused search for a specific restaurant
function detectFocusedSearch(message: string): { isFocused: boolean; restaurantName?: string; isQuestion: boolean } {
  const lowerMessage = message.toLowerCase().trim();
  
  // Patterns for asking opinion about a place
  const questionPatterns = [
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
  
  const isQuestion = questionPatterns.some(pattern => pattern.test(message));
  
  // Patterns for direct search
  const directSearchPatterns = [
    /^find (me )?(.+)$/i,
    /^search (for )?(.+)$/i,
    /^show (me )?(.+)$/i,
    /^i want (to go to|to eat at|to try) (.+)$/i,
    /^take me to (.+)$/i,
    /^looking for (.+)$/i,
  ];
  
  for (const pattern of directSearchPatterns) {
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

    // Detect if this is a focused search for a specific restaurant
    const focusedSearch = detectFocusedSearch(message);
    
    // Count how many questions we've asked and how many the user has answered
    const assistantMessages = conversationHistory.filter((m: any) => m.role === 'assistant');
    const userMessages = conversationHistory.filter((m: any) => m.role === 'user');
    const questionCount = assistantMessages.length;
    const userResponseCount = userMessages.length;
    
    // System prompt for conversational restaurant finding
    const systemPrompt = `You are Pachu, a world-class restaurant expert and personal dining concierge. You have deep knowledge about restaurants, cuisines, and dining experiences. Your mission is to understand exactly what the user needs through natural, expert-level conversation, then deliver the 3 perfect restaurant recommendations.

## Your Expertise:
You're like a trusted local friend who knows every restaurant. You ask thoughtful questions and really listen. You understand that dining is about the whole experience - the food, the vibe, the company, the occasion, and the budget.

## Conversation Style:
- Talk like a knowledgeable friend, not a bot
- Ask ONE clear question at a time
- Keep questions short and natural (like texting a friend)
- Use emojis naturally: 🍽️ 💰 ❤️ 🌮 🎉 👥 🚶 🚗
- Be enthusiastic but not over-the-top

## Information to Gather (ask 1-4 questions based on what user provides):

**Essential Info:**
1. **Mood & Cuisine** - What are they craving? What vibe?
2. **Budget** - How much they want to spend per person?
3. **Occasion** - Solo? Date? Friends? Family? Business?
4. **Timing** - Now? Tonight? Weekend? Special time?
5. **Distance** - How far willing to go? Walking? Quick ride? Drive?

## Conversation Flow:

**If user gives minimal info** (e.g., "I want pizza"):
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

**cuisineTypes** (array):
- "italian", "japanese", "chinese", "mexican", "indian", "thai", "french", "mediterranean", "american", "korean", "vietnamese", "middle eastern", etc.
- Also extract: "pizza", "sushi", "burger", "seafood", "steakhouse", "vegetarian", "vegan"

**priceLevel** (number 1-4):
- 1: "cheap", "budget", "affordable", "inexpensive", "under 50 shekels"
- 2: "moderate", "mid-range", "reasonable", "50-100 shekels"
- 3: "pricey", "upscale", "nice", "100-150 shekels"
- 4: "expensive", "luxury", "fine dining", "high-end", "150+ shekels"

**budget** (string): Extract exact budget mentions like "under 100 shekels", "around 80 per person"

**occasion** (string):
- "solo", "alone", "myself"
- "date", "romantic", "anniversary", "partner", "girlfriend", "boyfriend"
- "friends", "buddies", "group"
- "family", "kids", "parents"
- "business", "work", "meeting", "client"
- "celebration", "birthday", "special occasion"

**timing** (string):
- "now", "asap", "right now", "immediately"
- "tonight", "this evening", "dinner time"
- "tomorrow", "next week", "weekend", "saturday", "sunday"
- "lunch", "breakfast", "brunch", "dinner"
- Extract specific times: "7pm", "8 o'clock", "noon"

**distance** (string):
- "walking distance", "nearby", "close", "around the corner"
- "short drive", "5 minutes", "quick ride", "scooter distance"
- "anywhere in city", "willing to drive", "don't care about distance"
- Extract exact: "within 2km", "15 minute walk"

**specialPreferences** (array):
- "romantic", "quiet", "cozy", "intimate"
- "outdoor", "patio", "terrace", "garden"
- "pet-friendly", "dog-friendly"
- "live-music", "entertainment"
- "view", "rooftop", "waterfront"
- "casual", "laid-back", "relaxed"
- "trendy", "hip", "instagram-worthy"
- "traditional", "authentic", "local"
- "vegetarian-friendly", "vegan-options", "gluten-free"
- "family-friendly", "kid-friendly"

**searchMode**:
- "general": Normal recommendation flow
- "specific": User is searching for a specific restaurant by name

**searchQuery** (string):
- If searchMode is "specific", extract the restaurant name

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
      max_tokens: 400,
    });

    const fullResponse = completion.choices[0].message.content || '';
    
    // Extract data from response
    let extractedData: any = {};
    const dataMatch = fullResponse.match(/<data>([\s\S]*?)<\/data>/);
    if (dataMatch) {
      try {
        extractedData = JSON.parse(dataMatch[1]);
      } catch (e) {
        console.error('Error parsing data:', e);
      }
    }

    // Force readyToShow after 2 user responses
    if (userResponseCount >= 2) {
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
      query: message,
      cuisineTypes: extractedData.cuisineTypes || [],
      priceLevel: extractedData.priceLevel ? [extractedData.priceLevel] : undefined,
    };

    // Add special preferences as boolean flags
    if (extractedData.specialPreferences) {
      for (const pref of extractedData.specialPreferences) {
        if (pref === 'romantic') filters.romantic = true;
        if (pref === 'family-friendly') filters.familyFriendly = true;
        if (pref === 'outdoor') filters.outdoor = true;
        if (pref === 'pet-friendly') filters.petFriendly = true;
      }
    }

    // If ready to show restaurants, fetch and return exactly 3 best matches
    let restaurants: any[] = [];
    if (extractedData.readyToShow && location) {
      // Call nearby restaurants API with larger radius to get more options
      try {
        const nearbyResponse = await fetch(
          `${request.nextUrl.origin}/api/restaurants/nearby?latitude=${location.lat}&longitude=${location.lng}&radius=3000`,
          { headers: request.headers }
        );
        const nearbyData = await nearbyResponse.json();
        const allRestaurants = nearbyData.restaurants || [];
        
        // Filter and score restaurants based on preferences
        const scoredRestaurants = allRestaurants.map((r: any) => {
          let score = r.rating * 20; // Base score from rating (0-100)
          
          // Bonus for matching cuisine types
          if (filters.cuisineTypes && filters.cuisineTypes.length > 0 && r.cuisineTypes) {
            const matches = r.cuisineTypes.filter((c: string) => 
              filters.cuisineTypes.some((fc: string) => c.toLowerCase().includes(fc.toLowerCase()))
            );
            score += matches.length * 15;
          }
          
          // Bonus for matching price level
          if (filters.priceLevel && filters.priceLevel.length > 0 && r.priceLevel) {
            if (filters.priceLevel.includes(r.priceLevel)) {
              score += 10;
            }
          }
          
          // Bonus for highly rated places
          if (r.rating >= 4.5) score += 10;
          if (r.totalReviews > 100) score += 5;
          
          return { ...r, matchScore: score };
        });
        
        // Sort by score and take top 3
        scoredRestaurants.sort((a: any, b: any) => b.matchScore - a.matchScore);
        restaurants = scoredRestaurants.slice(0, 3).map((r: any) => ({
          ...r,
          // Calculate match percentage (0-100) based on score
          matchPercentage: Math.min(100, Math.max(60, Math.round(r.matchScore)))
        }));
      } catch (error) {
        console.error('Error fetching restaurants:', error);
      }
    }

    return NextResponse.json({
      message: visibleMessage,
      filters,
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

