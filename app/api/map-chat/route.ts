import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

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

    // Count how many questions we've asked and how many the user has answered
    const assistantMessages = conversationHistory.filter((m: any) => m.role === 'assistant');
    const userMessages = conversationHistory.filter((m: any) => m.role === 'user');
    const questionCount = assistantMessages.length;
    const userResponseCount = userMessages.length;
    
    // System prompt for conversational restaurant finding
    const systemPrompt = `You are Pachu, a friendly and intelligent AI restaurant finder. Your goal is to understand the user's dining preferences through 1-3 natural questions, then recommend exactly 3 perfect restaurants.

## Your Process:
**Ask between 1-3 questions based on what you learn:**

1️⃣ **First question**: Ask about their mood/craving (cuisine type, specific dish, or dining atmosphere)
2️⃣ **After first answer**: If the user gave you enough details, set readyToShow to true! Otherwise ask about budget OR special preferences
3️⃣ **After second answer**: You MUST set readyToShow to true now!

**Important**: 
- You can recommend restaurants after just 1 answer if the user provides enough detail!
- Maximum 2 questions - after the user's second answer, you MUST set readyToShow to true
- Each question should be short, friendly, and conversational (1-2 sentences max)
- Use natural language and emojis 🍽️ 💰 ❤️ 🌮

## Current conversation state:
- Questions asked: ${questionCount}
- User responses: ${userResponseCount}
- Status: ${userResponseCount === 0 ? 'Ask first question' : userResponseCount === 1 ? 'User answered once - decide if you need more info or recommend' : 'User answered twice - MUST recommend now!'}

## Extract Information:
After each response, include this JSON block (user won't see it):
<data>
{
  "cuisineTypes": [],
  "priceLevel": null,
  "specialPreferences": [],
  "readyToShow": false
}
</data>

**Set readyToShow to true when:**
- User has answered at least once AND you have enough info to make recommendations
- User has answered twice (MANDATORY)

**Extraction examples:**
- "italian", "pizza", "pasta" → cuisineTypes: ["italian"]
- "sushi", "japanese" → cuisineTypes: ["japanese"]
- "cheap", "budget", "affordable" → priceLevel: 1
- "mid-range", "moderate" → priceLevel: 2
- "expensive", "fancy", "upscale", "fine dining" → priceLevel: 3-4
- "romantic", "date night", "anniversary" → specialPreferences: ["romantic"]
- "family", "kids" → specialPreferences: ["family-friendly"]
- "outdoor", "patio", "terrace" → specialPreferences: ["outdoor"]

**When readyToShow is true**, do NOT include any message text - just return empty message so only restaurant cards are shown!`;

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

