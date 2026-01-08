import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { runRecommendationPipeline, type ChatMessage } from '@/lib/recommendation';

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _lowerMessage = message.toLowerCase().trim();
  
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

    // Detect language from first user message, or from conversation history
    const userMessages = conversationHistory.filter((m: any) => m.role === 'user');
    const isFirstMessage = userMessages.length === 0;
    
    let detectedLanguage: 'he' | 'en' = 'en';
    if (isFirstMessage) {
      const detected = detectLanguage(message);
      detectedLanguage = detected === 'other' ? 'en' : detected;
    } else {
      if (userMessages.length > 0) {
        const detected = detectLanguage(userMessages[0].content);
        detectedLanguage = detected === 'other' ? 'en' : detected;
      } else {
        const detected = detectLanguage(message);
        detectedLanguage = detected === 'other' ? 'en' : detected;
      }
    }
    
    // Detect if this is a focused search for a specific restaurant
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _focusedSearch = detectFocusedSearch(message, detectedLanguage);
    
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
    
    // System prompt - Updated for Pipeline V2
    const systemPrompt = `You are Pachu, a world-class restaurant expert and personal dining concierge. Your mission is to understand exactly what the user needs through natural conversation.

${languageInstructions}

## Your Expertise:
You're like a trusted local friend who knows every restaurant. You ask thoughtful questions and really listen.

## Conversation Style:
- Talk like a knowledgeable friend, not a bot
- Ask ONE clear question at a time
- Keep questions short and natural
- Use emojis naturally: 🍽️ 💰 ❤️ 🌮 🎉 👥 🚶 🚗

## CRITICAL - Information to Gather:

**MUST ASK (in first 1-2 questions):**
1. **WHERE** - איפה מחפשים?
   - קרוב אליך / באזור שלך (nearby)
   - לא משנה המרחק (anywhere)
   - תל אביב / עיר ספציפית (specific city)

2. **WHEN** - מתי?
   - עכשיו / מיד (now)
   - הערב / הלילה (tonight)
   - מחר (tomorrow)
   - לא משנה (anytime)

**Then ask about:**
3. **WHAT** - מה בא להם? (cuisine, mood, occasion)
4. **Budget** - רק אם הם מזכירים תקציב

## Current State:
- Questions asked: ${questionCount}
- User responses: ${userResponseCount}
- Stage: ${userResponseCount === 0 ? 'Initial - ask about WHERE and WHEN first!' : userResponseCount === 1 ? 'Got first answer - ask about WHAT they want' : userResponseCount === 2 ? 'Got 2 answers - confirm and search!' : 'Time to search!'}

**IMPORTANT LIMITS:**
- Maximum 3-4 questions total
- After 3rd user response → set readyToShow: true
- If user provides WHERE, WHEN, and WHAT → search immediately

## Data Extraction Format:
After EVERY response, include this JSON (hidden from user):
<data>
{
  "readyToShow": false
}
</data>

Set readyToShow: true when you have:
- Location preference (nearby/anywhere/city)
- Timing preference (now/tonight/tomorrow/anytime)
- What they're looking for (cuisine/mood/occasion)

## Response Guidelines:
- If readyToShow is true: Leave message EMPTY (no text)
- If readyToShow is false: Ask your next question

Remember: Get WHERE and WHEN early in the conversation! This helps us filter restaurants properly.`;

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
    
    // Extract readyToShow from response
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
    }

    // Force readyToShow after 3+ user responses
    if (userResponseCount >= 3) {
      console.log('⚡ Forcing readyToShow=true (3+ responses)');
      readyToShow = true;
    }

    // Remove the data JSON from the visible message
    let visibleMessage = fullResponse.replace(/<data>[\s\S]*?<\/data>/, '').trim();
    
    // If showing restaurants, remove the message text entirely
    if (readyToShow) {
      visibleMessage = '';
      console.log('✅ readyToShow=true, clearing message');
    }

    // =========================================================================
    // RECOMMENDATION PIPELINE V2
    // =========================================================================
    
    let restaurants: any[] = [];
    let pipelineDebug: any = null;
    
    if (readyToShow && location) {
      try {
        console.log('\n🚀 Starting Recommendation Pipeline V2...\n');
        
        // Build messages array for pipeline
        const pipelineMessages: ChatMessage[] = [
          ...conversationHistory.map((m: any) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          { role: 'user' as const, content: message },
        ];
        
        // Run the new pipeline
        const pipelineResult = await runRecommendationPipeline(
          pipelineMessages,
          { lat: location.lat, lng: location.lng },
          {
            openaiApiKey: process.env.OPENAI_API_KEY!,
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
            supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            vectorSearchTopK: 50,
            rerankTopN: 15,
            enableDiversity: true,
            enableDebug: true,
          }
        );
        
        // Store debug data
        pipelineDebug = pipelineResult.debug;
        
        // Transform recommendations to restaurant format for frontend
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
        
        restaurants = pipelineResult.recommendations.map(rec => {
          const r = rec.restaurant;
          
          // Build photo URL if available
          let photoUrl: string | undefined;
          if (r.photos && r.photos.length > 0 && r.photos[0].photo_reference && apiKey) {
            photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${r.photos[0].photo_reference}&key=${apiKey}`;
          }
          
          return {
            id: r.google_place_id,
            googlePlaceId: r.google_place_id,
            name: r.name,
            address: r.address || '',
            rating: r.google_rating || 0,
            totalReviews: r.google_reviews_count || 0,
            cuisineTypes: r.categories || [],
            priceLevel: r.price_level,
            photoUrl,
            latitude: r.latitude,
            longitude: r.longitude,
            matchPercentage: rec.matchPercentage,
            reason: rec.reason, // Personal explanation from LLM
            source: 'pipeline',
            recommendedBy: 'ai',
          };
        });
        
        console.log(`📍 Pipeline returned ${restaurants.length} restaurants`);
        
      } catch (error) {
        console.error('Pipeline error:', error);
        
        // Fallback to old method if pipeline fails
        console.log('⚠️ Falling back to old recommendation method...');
        restaurants = await fallbackRecommendation(
          openai,
          conversationHistory,
          message,
          location,
          detectedLanguage,
          request
        );
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
      debug: pipelineDebug,
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

// =========================================================================
// FALLBACK METHOD (old recommendation logic)
// =========================================================================

async function fallbackRecommendation(
  openai: OpenAI,
  conversationHistory: any[],
  message: string,
  location: { lat: number; lng: number },
  detectedLanguage: string,
  request: NextRequest
): Promise<any[]> {
  const restaurants: any[] = [];
  
  try {
    const locationContext = detectedLanguage === 'he'
      ? `מיקום נוכחי של המשתמש (GPS): ${location.lat}, ${location.lng}`
      : `User's current location (GPS): ${location.lat}, ${location.lng}`;
    
    const recommendationPrompt = detectedLanguage === 'he'
      ? `הנה השיחה המלאה שלי עם הלקוח:

${conversationHistory.map((m: any) => `${m.role === 'user' ? 'לקוח' : 'אני'}: ${m.content}`).join('\n')}
לקוח: ${message}

${locationContext}

המלץ על 3 מסעדות ספציפיות. פורמט:
1. [שם מסעדה]
2. [שם מסעדה]
3. [שם מסעדה]`
      : `Here is my conversation with the client:

${conversationHistory.map((m: any) => `${m.role === 'user' ? 'Client' : 'Me'}: ${m.content}`).join('\n')}
Client: ${message}

${locationContext}

Recommend 3 specific restaurants. Format:
1. [Restaurant name]
2. [Restaurant name]
3. [Restaurant name]`;

    const recommendationCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: detectedLanguage === 'he'
            ? 'אתה מומחה מסעדות. המלץ על 3 מסעדות אמיתיות בישראל.'
            : 'You are a restaurant expert. Recommend 3 real restaurants.'
        },
        { role: 'user', content: recommendationPrompt }
      ],
      temperature: 0.7,
      max_tokens: 400,
    });

    const recommendationText = recommendationCompletion.choices[0].message.content || '';
    
    const restaurantNames: string[] = [];
    const lines = recommendationText.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^[\d\-\*•]\s*[\.\):]?\s*(.+)$/);
      if (match && match[1]) {
        const name = match[1].trim().replace(/^["']|["']$/g, '');
        if (name && name.length > 2) {
          restaurantNames.push(name);
        }
      }
    }

    for (const restaurantName of restaurantNames.slice(0, 3)) {
      try {
        const searchResponse = await fetch(
          `${request.nextUrl.origin}/api/restaurants/search?query=${encodeURIComponent(restaurantName)}&latitude=${location.lat}&longitude=${location.lng}`,
          { headers: request.headers }
        );
        const searchData = await searchResponse.json();
        
        if (searchData.restaurants && searchData.restaurants.length > 0) {
          const restaurant = searchData.restaurants[0];
          restaurants.push({
            ...restaurant,
            matchPercentage: 85,
            source: restaurant.source || 'google',
            recommendedBy: 'ai-fallback'
          });
        }
      } catch (error) {
        console.error(`Error searching for ${restaurantName}:`, error);
      }
    }
  } catch (error) {
    console.error('Fallback recommendation error:', error);
  }
  
  return restaurants;
}
