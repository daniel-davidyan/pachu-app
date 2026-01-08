import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

/**
 * POST /api/agent/chat
 * 
 * Pachu Agent v3.0 - Natural Conversational Restaurant Finder
 * 
 * Architecture:
 * 1. Single System Prompt - defines agent personality and behavior
 * 2. Full Conversation History - sent to model for context
 * 3. Agent Decides - when to ask questions vs recommend
 * 4. Natural Flow - conversation feels human and connected
 */

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// ============================================
// TYPE DEFINITIONS
// ============================================

interface UserProfile {
  firstName: string;
  fullName: string;
  hasOnboarding: boolean;
  favoriteCategories?: string[];
  likes?: string[];
  dislikes?: string[];
  dietary?: string[];
}

interface ExtractedInfo {
  occasion: string | null;
  location: string | null;
  cuisine: string | null;
  vibe: string | null;
  budget: string | null;
  readyToRecommend: boolean;
}

// ============================================
// THE MAIN SYSTEM PROMPT - The Brain of Pachu
// ============================================

const SYSTEM_PROMPT = `אתה פאצ'ו - החבר הכי טוב שיש! 🌟 אתה עוזר למצוא מסעדות בתל אביב ואתה פשוט אוהב לעזור לאנשים.

## האישיות שלך:
- אתה חם, נלהב ואמפתי - כיף לדבר איתך!
- אתה מתרגש מהדברים הקטנים ("וואו דייט ראשון! כמה מרגש! 💕")
- אתה מראה שאכפת לך באמת ("אוי, מבואס? בוא נמצא משהו שישמח אותך!")
- אתה משתמש בשפה חמה ולא פורמלית

## הכלל הכי חשוב - אסור להמליץ על מסעדות!
❌ לעולם אל תזכיר שמות של מסעדות ספציפיות
❌ אל תגיד "יש מקום שנקרא X" או "אני ממליץ על Y"
✅ התפקיד שלך רק לאסוף מידע ולהיות נחמד!

## סגנון התשובות:
- 1-2 משפטים חמימים + שאלה אחת
- אימוג'י אחד או שניים מתאימים
- תגיב לרגש ולא רק לתוכן ("וואו זה נשמע מדהים!" / "אני מבין אותך לגמרי!")
- תראה התלהבות אמיתית

## מידע שצריך לאסוף (2-3 דברים):
- סוג אוכל (סושי, המבורגר, איטלקי...)
- עם מי (דייט? חברים? לבד?)
- איפה/אווירה/תקציב

## דוגמאות לתשובות מעולות:
- "אוווה סושי! אני מת על סושי טוב 🍣 עם מי אתה הולך?"
- "דייט ראשון?! כמה מרגש! 💕 יש אזור בתל אביב שמתאים לכם?"
- "בדרום ת"א, יופי של אזור! יש לך אווירה מסוימת בראש - רומנטי? קז'ואל?"
- "וואלה, נשמע כמו ערב מושלם! 🌟 אני רץ לחפש לכם את המקומות הכי שווים! [READY_TO_RECOMMEND]"

## דוגמאות לתשובות גרועות (אסור!):
- קר/פורמלי: "סושי, מעולה. עם מי?" ❌
- להזכיר מסעדה: "אני ממליץ על פיצה דומיניק" ❌
- בלי שאלה: "נשמע טוב!" ❌

## מתי לצאת לחפש:
יש לך סוג אוכל + עוד פרט או שניים? → סיים בהתרגשות עם [READY_TO_RECOMMEND]`;

// ============================================
// MAIN HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    console.log('🔐 CHAT API - User auth:', { 
      isLoggedIn: !!user, 
      userId: user?.id || 'NOT_LOGGED_IN',
    });
    
    const body = await request.json();
    const {
      message,
      conversationId,
      previousContext,
      messages: conversationHistory,
      userLocation,
    } = body;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // ========================================
    // STEP 1: Get User Profile for personalization
    // ========================================
    const userProfile = await getUserProfile(supabase, user?.id);
    
    // ========================================
    // STEP 2: Build conversation for the model
    // ========================================
    const systemPromptWithProfile = buildSystemPrompt(userProfile);
    
    const openaiMessages: any[] = [
      { role: 'system', content: systemPromptWithProfile },
    ];
    
    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach((msg: any) => {
        // Clean previous messages from the READY tag
        const cleanContent = msg.content.replace(/\[READY_TO_RECOMMEND\]/g, '').trim();
        openaiMessages.push({
          role: msg.role,
          content: cleanContent,
        });
      });
    }
    
    // Add current message
    openaiMessages.push({ role: 'user', content: message });

    // ========================================
    // STEP 3: Get Agent Response
    // ========================================
    console.log('🤖 Calling OpenAI for natural conversation...');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openaiMessages,
      temperature: 0.8,
      max_tokens: 500,
    });

    const agentResponse = completion.choices[0].message.content || '';
    console.log('📝 Agent raw response:', agentResponse);

    // ========================================
    // STEP 4: Check if ready to recommend
    // ========================================
    const isReadyToRecommend = agentResponse.includes('[READY_TO_RECOMMEND]');
    
    // Clean the response from the tag
    const cleanResponse = agentResponse.replace(/\[READY_TO_RECOMMEND\]/g, '').trim();

    if (isReadyToRecommend) {
      console.log('🎯 Ready to recommend! Sending conversation to pipeline...');
      
      // Call recommendation API with full conversation
      const requestUrl = new URL(request.url);
      const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
      const cookies = request.headers.get('cookie') || '';
      
      const recommendResponse = await callRecommendationAPI(
        conversationHistory || [],
        message,
        { baseUrl, cookies }
      );

      // Use the natural summary message from the recommendation API
      // The message contains [[Restaurant Name]] markers that the frontend will render as components
      let fullMessage = '';
      
      if (recommendResponse.recommendations && recommendResponse.recommendations.length > 0) {
        // Use the naturally generated message from the recommendation API
        fullMessage = recommendResponse.message || cleanResponse;
        
        return NextResponse.json({
          message: fullMessage,
          readyToRecommend: true,
          recommendations: recommendResponse.recommendations,
          debugData: recommendResponse.debugData,
          conversationId: conversationId || `conv_${Date.now()}`,
        });
      } else {
        // No recommendations found - return a friendly error message
        const noResultsMessage = 'אוי, לא מצאתי בדיוק מה שחיפשת 😔 אולי ננסה משהו קצת אחר? ספר לי עוד מה בא לך!';
        
        return NextResponse.json({
          message: noResultsMessage,
          readyToRecommend: false, // Let user continue the conversation
          conversationId: conversationId || `conv_${Date.now()}`,
        });
      }
    }

    // ========================================
    // STEP 5: Return conversational response
    // ========================================
    return NextResponse.json({
      message: cleanResponse,
      readyToRecommend: false,
      conversationId: conversationId || `conv_${Date.now()}`,
    });

  } catch (error) {
    console.error('Agent error:', error);
    return NextResponse.json({
      message: 'אופס, משהו קרה. בוא ננסה שוב! 🙏',
      readyToRecommend: false,
    });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function buildSystemPrompt(profile: UserProfile): string {
  let prompt = SYSTEM_PROMPT;
  
  // Add personalization if we have user info
  if (profile.firstName || profile.likes?.length || profile.dislikes?.length) {
    prompt += '\n\n## מידע על המשתמש הנוכחי:\n';
    
    if (profile.firstName) {
      prompt += `- שם: ${profile.firstName}\n`;
    }
    if (profile.likes && profile.likes.length > 0) {
      prompt += `- אוהב: ${profile.likes.join(', ')}\n`;
    }
    if (profile.dislikes && profile.dislikes.length > 0) {
      prompt += `- לא אוהב: ${profile.dislikes.join(', ')}\n`;
    }
    if (profile.dietary && profile.dietary.length > 0) {
      prompt += `- העדפות תזונה: ${profile.dietary.join(', ')}\n`;
    }
    
    prompt += '\nהשתמש במידע הזה כדי להתאים את ההמלצות ולדבר אליו בשם!';
  }
  
  return prompt;
}

async function getUserProfile(supabase: any, userId?: string): Promise<UserProfile> {
  if (!userId) {
    return { firstName: '', fullName: '', hasOnboarding: false };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, username')
    .eq('id', userId)
    .single();

  const { data: tasteProfile } = await supabase
    .from('user_taste_profiles')
    .select('onboarding_completed, preferred_cuisines, likes, dislikes, is_kosher, is_vegetarian, is_vegan, gluten_free')
    .eq('user_id', userId)
    .single();

  const fullName = profile?.full_name || profile?.username || '';
  const firstName = fullName.split(' ')[0];

  // Build dietary preferences
  const dietary: string[] = [];
  if (tasteProfile?.is_kosher) dietary.push('כשר');
  if (tasteProfile?.is_vegetarian) dietary.push('צמחוני');
  if (tasteProfile?.is_vegan) dietary.push('טבעוני');
  if (tasteProfile?.gluten_free) dietary.push('ללא גלוטן');

  return {
    firstName,
    fullName,
    hasOnboarding: tasteProfile?.onboarding_completed || false,
    favoriteCategories: tasteProfile?.preferred_cuisines,
    likes: tasteProfile?.likes,
    dislikes: tasteProfile?.dislikes,
    dietary,
  };
}

async function callRecommendationAPI(
  conversationHistory: { role: string; content: string }[],
  currentMessage: string,
  requestInfo: { baseUrl: string; cookies: string }
): Promise<{ recommendations: any[]; message?: string; debugData?: any }> {
  
  // Build full messages array including current message
  const messages = [
    ...conversationHistory,
    { role: 'user', content: currentMessage }
  ];

  try {
    const controller = new AbortController();
    // Increased timeout to 60 seconds - vector search + LLM calls can take time
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    const recommendResponse = await fetch(`${requestInfo.baseUrl}/api/agent/recommend`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': requestInfo.cookies,
      },
      body: JSON.stringify({
        messages,  // Send full conversation
        includeDebugData: true,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!recommendResponse.ok) {
      throw new Error(`Recommend API error: ${recommendResponse.status}`);
    }

    const data = await recommendResponse.json();
    return {
      recommendations: data.recommendations || [],
      message: data.message,
      debugData: data.debugData,
    };
  } catch (error) {
    console.error('Recommendation API error:', error);
    return { recommendations: [] };
  }
}
