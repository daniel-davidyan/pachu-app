import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

/**
 * POST /api/agent/chat
 * 
 * Smart conversational agent that:
 * 1. Uses the user's name ONLY in the first message
 * 2. Tracks parameters and fills them progressively
 * 3. Generates RELEVANT chips using LLM
 * 4. Knows when to stop asking and recommend
 */

interface Chip {
  label: string;
  value: string;
  emoji?: string;
}

interface ConversationContext {
  where: string | null;
  withWho: string | null;
  purpose: string | null;
  budget: string | null;
  when: string | null;
  cuisinePreference: string | null;
  turnCount: number;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    const body = await request.json();
    const {
      message,
      conversationId,
      previousContext,
      messages = [],
      userLocation, // { lat, lng } - needed for recommendations
    } = body;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    // ========================================
    // STEP 1: Get user info for personalization
    // ========================================
    let userName = '';
    
    if (user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', user.id)
        .single();
      
      userName = profileData?.full_name || profileData?.username || '';
    }

    // ========================================
    // STEP 2: Initialize or update context
    // ========================================
    const context: ConversationContext = {
      where: previousContext?.where || null,
      withWho: previousContext?.withWho || null,
      purpose: previousContext?.purpose || null,
      budget: previousContext?.budget || null,
      when: previousContext?.when || null,
      cuisinePreference: previousContext?.cuisinePreference || null,
      turnCount: (previousContext?.turnCount || 0) + 1,
    };

    const isFirstTurn = context.turnCount === 1;

    // ========================================
    // STEP 3: Use LLM to extract parameters from message
    // ========================================
    const extractionPrompt = `Analyze this user message and extract restaurant search parameters.

User message: "${message}"

Return ONLY a valid JSON object. Use null for anything not clearly mentioned:
{
  "where": "distance preference: 'walking_distance', 'willing_to_travel', 'outside_city', or specific location if mentioned, or null",
  "withWho": "who they're with: 'date', 'friends', 'family', 'solo', 'work', or null",
  "purpose": "occasion: 'romantic_dinner', 'casual_meal', 'quick_bite', 'drinks', 'celebration', 'business', or null",
  "budget": "budget: 'cheap', 'moderate', 'expensive', 'any', or null",
  "when": "timing: 'now', 'tonight', 'tomorrow', 'weekend', or null",
  "cuisinePreference": "cuisine type if mentioned, or null"
}`;

    const extractionResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: extractionPrompt }],
      temperature: 0,
      max_tokens: 200,
    });

    try {
      const extractedText = extractionResponse.choices[0].message.content || '{}';
      const cleanedText = extractedText.replace(/```json\n?|\n?```/g, '').trim();
      const extracted = JSON.parse(cleanedText);
      
      // Update context with newly extracted values
      if (extracted.where) context.where = extracted.where;
      if (extracted.withWho) context.withWho = extracted.withWho;
      if (extracted.purpose) context.purpose = extracted.purpose;
      if (extracted.budget) context.budget = extracted.budget;
      if (extracted.when) context.when = extracted.when;
      if (extracted.cuisinePreference) context.cuisinePreference = extracted.cuisinePreference;
    } catch (e) {
      console.log('Failed to parse extraction:', e);
    }

    console.log('📋 Context:', context);

    // ========================================
    // STEP 4: Determine what's missing and if ready
    // ========================================
    const hasWhere = !!context.where;
    const hasOccasion = !!context.withWho || !!context.purpose;
    const readyToRecommend = hasWhere && hasOccasion;
    
    // Determine next question type
    let nextQuestionType: 'where' | 'occasion' | 'cuisine' | 'none' = 'none';
    if (!hasOccasion) {
      nextQuestionType = 'occasion';
    } else if (!hasWhere) {
      nextQuestionType = 'where';
    } else if (!context.cuisinePreference) {
      nextQuestionType = 'cuisine';
    }

    console.log('🎯 Ready:', readyToRecommend, '| Next:', nextQuestionType);

    // ========================================
    // STEP 5: Generate response + chips with LLM
    // ========================================
    const responsePrompt = buildResponsePrompt(userName, isFirstTurn, context, nextQuestionType, readyToRecommend);
    
    const responseResult = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: responsePrompt }],
      temperature: 0.7,
      max_tokens: 300,
    });

    let responseMessage = '';
    let chips: Chip[] = [];

    try {
      const responseText = responseResult.choices[0].message.content || '';
      const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanedResponse);
      
      responseMessage = parsed.message || '';
      chips = (parsed.chips || []).map((c: any) => ({
        label: c.label,
        value: c.value,
        emoji: c.emoji
      }));
    } catch (e) {
      // If parsing fails, use raw response as message
      responseMessage = responseResult.choices[0].message.content || 'איך אני יכול לעזור?';
      chips = [];
    }

    console.log('💬 Response:', responseMessage);
    console.log('🏷️ Chips:', chips.length);

    // Save chat signal for learning (if user provided useful info)
    if (user && !readyToRecommend && (context.where || context.withWho || context.purpose || context.cuisinePreference)) {
      const signalContent = buildChatSignalContent(context);
      if (signalContent) {
        await supabase.from('user_taste_signals').insert({
          user_id: user.id,
          signal_type: 'chat',
          signal_strength: 4,
          is_positive: true,
          content: signalContent,
          source_id: conversationId,
        });
      }
    }

    // ========================================
    // STEP 6: If ready to recommend, get recommendations!
    // ========================================
    let recommendations = null;
    
    // Default to Tel Aviv center if no valid location
    const TEL_AVIV_CENTER = { lat: 32.0853, lng: 34.7818 };
    const effectiveLocation = userLocation && 
      userLocation.lat >= 29.5 && userLocation.lat <= 33.5 &&
      userLocation.lng >= 34 && userLocation.lng <= 36
        ? userLocation 
        : TEL_AVIV_CENTER;
    
    if (readyToRecommend) {
      console.log('🚀 Ready to recommend! Calling recommend API...');
      console.log('📍 User location:', effectiveLocation);
      console.log('📋 Context:', context);
      
      try {
        const recommendUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/agent/recommend`;
        console.log('🔗 Recommend URL:', recommendUrl);
        
        const recommendResponse = await fetch(recommendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context,
            userLocation: effectiveLocation,
            conversationSummary: buildChatSignalContent(context),
          }),
        });
        
        console.log('📥 Recommend response status:', recommendResponse.status);
        
        if (recommendResponse.ok) {
          const data = await recommendResponse.json();
          console.log('✅ Recommend data:', JSON.stringify(data).substring(0, 500));
          recommendations = data.recommendations;
          
          // Update message with recommendation count
          if (recommendations && recommendations.length > 0) {
            responseMessage = `מצאתי ${recommendations.length} מקומות מושלמים בשבילך! 🎉`;
          } else {
            responseMessage = 'לא מצאתי מקומות שמתאימים לקריטריונים. אולי ננסה משהו אחר?';
          }
        } else {
          const errorText = await recommendResponse.text();
          console.error('❌ Recommend API error:', errorText);
          responseMessage = 'משהו השתבש בחיפוש, בוא ננסה שוב';
        }
      } catch (err) {
        console.error('❌ Failed to get recommendations:', err);
        responseMessage = 'משהו השתבש בחיפוש, בוא ננסה שוב';
      }
    }

    return NextResponse.json({
      message: responseMessage,
      chips: chips.length > 0 ? chips : undefined,
      context,
      readyToRecommend,
      recommendations, // Include recommendations when ready
      conversationId: conversationId || `conv_${Date.now()}`,
    });

  } catch (error) {
    console.error('Agent chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

function buildChatSignalContent(context: ConversationContext): string | null {
  const parts: string[] = [];
  
  if (context.where) parts.push(`Looking for places in ${context.where}`);
  if (context.withWho) parts.push(`Going with ${context.withWho}`);
  if (context.purpose) parts.push(`Purpose: ${context.purpose}`);
  if (context.cuisinePreference) parts.push(`Wants ${context.cuisinePreference} food`);
  if (context.budget) parts.push(`Budget: ${context.budget}`);
  
  return parts.length > 0 ? parts.join('. ') : null;
}

function buildResponsePrompt(
  userName: string,
  isFirstTurn: boolean,
  context: ConversationContext,
  nextQuestionType: 'where' | 'occasion' | 'cuisine' | 'none',
  readyToRecommend: boolean
): string {
  
  const knownInfo: string[] = [];
  if (context.where) knownInfo.push(`מיקום: ${context.where}`);
  if (context.withWho) knownInfo.push(`עם מי: ${context.withWho}`);
  if (context.purpose) knownInfo.push(`מטרה: ${context.purpose}`);
  if (context.cuisinePreference) knownInfo.push(`סוג אוכל: ${context.cuisinePreference}`);

  // Name instruction - only for first turn
  let nameInstruction = '';
  if (isFirstTurn && userName) {
    nameInstruction = `⚠️ CRITICAL: This is the FIRST message. Your message MUST start with a greeting that includes the name "${userName}".
Since the response is in Hebrew (RTL) and the name "${userName}" is in English, you must write it like this:
- "היי ${userName}! מה נשמע?"
- "שלום ${userName}, מה בא לך?"
- "הי ${userName}! איפה בא לך לאכול?"
The name "${userName}" MUST appear in your response!`;
  } else {
    nameInstruction = 'Do NOT use any name in your response.';
  }

  // Question type instructions
  let questionInstruction = '';
  let chipsInstruction = '';

  if (readyToRecommend) {
    questionInstruction = 'The user has given enough info. Tell them you\'re searching for the perfect places.';
    chipsInstruction = 'chips should be an empty array []';
  } else {
    switch (nextQuestionType) {
      case 'occasion':
        questionInstruction = 'Ask WHO they\'re going with or WHAT\'s the occasion. Be curious and friendly - ask what\'s the vibe/who\'s coming.';
        chipsInstruction = `Generate 4-5 chips for who they're with / occasion:
- "דייט 💕" (date)
- "חברים 👥" (friends)  
- "משפחה 👨‍👩‍👧" (family)
- "לבד 🧘" (solo)
- "עבודה 💼" (work)`;
        break;
      case 'where':
        questionInstruction = 'Ask about location preference - how far are they willing to go.';
        chipsInstruction = `Generate 3-4 chips about distance/location preference.
Use these options: 
- "במרחק הליכה 🚶" (walking distance)
- "מוכן לנסוע 🚌" (willing to travel) 
- "מחוץ לעיר 🌳" (outside the city)`;
        break;
      case 'cuisine':
        questionInstruction = 'Ask what type of food/cuisine they\'re in the mood for.';
        chipsInstruction = `Generate 4-5 chips for cuisine types.
Examples: איטלקי 🍝, אסייתי 🍜, ישראלי 🥙, בשרים 🥩, מפתיע אותי 🎲`;
        break;
      default:
        questionInstruction = 'Continue the conversation naturally.';
        chipsInstruction = 'Generate relevant chips based on what makes sense to ask next.';
    }
  }

  return `You are Pachu, a friendly restaurant recommendation assistant in Tel Aviv, Israel.
You MUST respond in Hebrew. Be warm, casual, like texting a friend.

${nameInstruction}

${knownInfo.length > 0 ? `Already know about the user:\n${knownInfo.join('\n')}` : 'Don\'t know anything yet.'}

Your task: ${questionInstruction}

Return a JSON object with this EXACT structure:
{
  "message": "your response message in Hebrew (1-2 sentences, friendly and natural)",
  "chips": [
    {"label": "chip text", "value": "chip_value", "emoji": "emoji"}
  ]
}

Chips rules:
- ${chipsInstruction}
- Each chip has: label (Hebrew), value (English snake_case), emoji
- Chips MUST be relevant to the question you're asking
- Keep labels short (1-3 words)

Return ONLY the JSON, no other text.`;
}
