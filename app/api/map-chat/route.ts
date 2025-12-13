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

    // Count how many questions we've asked
    const questionCount = conversationHistory.filter((m: any) => m.role === 'assistant').length;
    const shouldSuggestRestaurants = questionCount >= 1; // After 1-2 exchanges, suggest restaurants (was >= 2)

    // System prompt for conversational restaurant finding
    const systemPrompt = `You are Pachu, a friendly AI restaurant finder. Your goal is to understand the user's dining preferences through a natural conversation, then help them find perfect restaurants.

## Your Process:
1️⃣ **First message**: Ask about cuisine type and preferences (budget, romantic, etc.) in ONE message
2️⃣ **Second message**: Say you found places and they will appear below. DO NOT describe individual restaurants.

## CRITICAL RULES:
- Keep responses conversational and friendly (2-3 sentences max)
- Use emojis naturally 🍽️ 💰 ❤️ 🏡
- Ask MULTIPLE questions in your FIRST message (cuisine AND budget/preferences)
- After user responds, say "I found some great places for you! 🍽️✨" (or similar)
- NEVER mention specific restaurant names or details in your text
- NEVER say things like "The Chinese restaurant" or describe restaurants
- The restaurant cards will show automatically below your message
- Just acknowledge and let the cards do the talking

## Current stage: ${questionCount === 0 ? 'Ask about cuisine, budget, and preferences in ONE message' : 'Say you found places (cards will show below automatically)'}

## Extract Information:
After each response, include this JSON block (user won't see it):
<data>
{
  "cuisineTypes": [],
  "priceLevel": null,
  "specialPreferences": [],
  "readyToShow": ${shouldSuggestRestaurants}
}
</data>

Examples:
- "italian" or "pizza" → cuisineTypes: ["italian"]
- "cheap" or "budget" → priceLevel: 1-2
- "expensive" or "fancy" → priceLevel: 3-4
- "romantic" or "date night" → specialPreferences: ["romantic"]
- "family" → specialPreferences: ["family-friendly"]
- "outdoor" or "patio" → specialPreferences: ["outdoor"]`;

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

    // Remove the data JSON from the visible message
    const visibleMessage = fullResponse.replace(/<data>[\s\S]*?<\/data>/, '').trim();

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

    // If ready to show restaurants, fetch some
    let restaurants: any[] = [];
    const shouldFetchRestaurants = shouldSuggestRestaurants || extractedData.readyToShow;
    
    if (shouldFetchRestaurants && location) {
      try {
        const nearbyResponse = await fetch(
          `${request.nextUrl.origin}/api/restaurants/nearby?latitude=${location.lat}&longitude=${location.lng}&radius=2000`,
          { headers: request.headers }
        );
        
        if (!nearbyResponse.ok) {
          throw new Error(`API returned ${nearbyResponse.status}`);
        }
        
        const nearbyData = await nearbyResponse.json();
        restaurants = (nearbyData.restaurants || []).slice(0, 3);
      } catch (error) {
        console.error('Error fetching restaurants:', error);
      }
    }

    const response = NextResponse.json({
      message: visibleMessage,
      filters,
      restaurants: restaurants.length > 0 ? restaurants : undefined,
      success: true,
    });

    // Prevent caching to avoid Chrome serving stale responses
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error: any) {
    console.error('Map Chat API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get AI response' },
      { status: 500 }
    );
  }
}

