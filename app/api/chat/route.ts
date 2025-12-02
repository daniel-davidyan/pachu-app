import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory } = await request.json();

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

    // System prompt for restaurant recommendations
    const systemPrompt = `You are Pachu, a friendly and knowledgeable restaurant recommendation AI assistant. Your goal is to help users discover amazing restaurants based on their preferences, mood, and cravings.

Guidelines:
- Be friendly, enthusiastic, and conversational
- Ask clarifying questions about their preferences (cuisine type, price range, dietary restrictions, atmosphere)
- Provide 3 specific restaurant recommendations when you have enough information
- For each restaurant, include: name, cuisine type, price range, and why it's a great match
- If you don't know specific restaurants, provide general advice about what to look for
- Keep responses concise and engaging
- Use emojis sparingly to add personality

Remember: You're helping people find their next favorite meal!`;

    // Build messages array
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message },
    ];

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.8,
      max_tokens: 500,
    });

    const assistantMessage = completion.choices[0].message.content;

    return NextResponse.json({
      message: assistantMessage,
      success: true,
    });
  } catch (error: any) {
    console.error('OpenAI API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get AI response' },
      { status: 500 }
    );
  }
}

