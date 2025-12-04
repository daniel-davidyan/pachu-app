import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory, currentFilters } = await request.json();

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

    // System prompt for map-based restaurant search
    const systemPrompt = `You are Pachu, a friendly food finder AI. Help users find restaurants on a map based on their preferences.

Your job:
1. Have a natural conversation to understand what they want
2. Extract search filters from their messages
3. Ask follow-up questions to narrow down options

Keep responses SHORT (1-2 sentences max). Be friendly and use emojis occasionally.

After each response, output a JSON block with extracted filters:
<filters>
{
  "priceLevel": [1,2,3,4], // 1=cheap, 4=expensive. null if not mentioned
  "cuisineTypes": [], // e.g. ["italian", "asian"]
  "rating": null, // minimum rating 1-5
  "romantic": false,
  "petFriendly": false,
  "outdoor": false,
  "familyFriendly": false,
  "lateNight": false,
  "vegetarian": false,
  "kosher": false
}
</filters>

Current filters: ${JSON.stringify(currentFilters || {})}

Examples:
User: "romantic dinner" → Set romantic: true
User: "cheap" → Set priceLevel: [1, 2]
User: "expensive italian" → Set priceLevel: [3, 4], cuisineTypes: ["italian"]
User: "can I bring my dog?" → Ask if they want pet-friendly, if yes set petFriendly: true`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 300,
    });

    const fullResponse = completion.choices[0].message.content || '';
    
    // Extract filters from response
    let filters = currentFilters || {};
    const filterMatch = fullResponse.match(/<filters>([\s\S]*?)<\/filters>/);
    if (filterMatch) {
      try {
        filters = JSON.parse(filterMatch[1]);
      } catch (e) {
        console.error('Error parsing filters:', e);
      }
    }

    // Remove the filters JSON from the visible message
    const visibleMessage = fullResponse.replace(/<filters>[\s\S]*?<\/filters>/, '').trim();

    // Generate suggestions based on what's NOT yet filtered
    const suggestions: string[] = [];
    if (!filters.priceLevel) suggestions.push('Budget-friendly', 'Upscale');
    if (!filters.romantic && !filters.familyFriendly) suggestions.push('Date night', 'Family friendly');
    if (!filters.outdoor) suggestions.push('Outdoor seating');
    if (!filters.petFriendly) suggestions.push('Pet-friendly');
    if (filters.cuisineTypes?.length === 0) suggestions.push('Italian', 'Asian');

    return NextResponse.json({
      message: visibleMessage,
      filters,
      suggestions: suggestions.slice(0, 4),
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

