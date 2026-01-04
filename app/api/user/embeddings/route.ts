import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

/**
 * POST /api/user/embeddings
 * 
 * Generates and updates user embeddings:
 * - onboarding_embedding: From onboarding preferences
 * - chat_embedding: From recent chat conversations
 * - reviews_embedding: From user reviews
 * - combined_embedding: Weighted combination of all
 * 
 * Query params:
 * - type: 'onboarding' | 'chat' | 'reviews' | 'all' (default: 'all')
 */

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    const updates: Record<string, any> = {};

    // ========================================
    // 1. ONBOARDING EMBEDDING
    // ========================================
    if (type === 'onboarding' || type === 'all') {
      const { data: profile } = await supabase
        .from('user_taste_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        const onboardingText = buildOnboardingText(profile);
        if (onboardingText) {
          const embedding = await generateEmbedding(onboardingText);
          updates.onboarding_text = onboardingText;
          updates.onboarding_embedding = JSON.stringify(embedding);
        }
      }
    }

    // ========================================
    // 2. CHAT EMBEDDING
    // ========================================
    if (type === 'chat' || type === 'all') {
      // Get recent chat signals (conversations)
      const { data: chatSignals } = await supabase
        .from('user_taste_signals')
        .select('content, created_at')
        .eq('user_id', user.id)
        .eq('signal_type', 'chat')
        .order('created_at', { ascending: false })
        .limit(20);

      if (chatSignals && chatSignals.length > 0) {
        const chatText = buildChatText(chatSignals);
        if (chatText) {
          const embedding = await generateEmbedding(chatText);
          updates.chat_summary_text = chatText;
          updates.chat_embedding = JSON.stringify(embedding);
        }
      }
    }

    // ========================================
    // 3. REVIEWS EMBEDDING
    // ========================================
    if (type === 'reviews' || type === 'all') {
      const { data: reviews } = await supabase
        .from('reviews')
        .select(`
          content,
          rating,
          restaurant:restaurants(name, google_place_id)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (reviews && reviews.length > 0) {
        const reviewsText = buildReviewsText(reviews);
        if (reviewsText) {
          const embedding = await generateEmbedding(reviewsText);
          updates.reviews_summary_text = reviewsText;
          updates.reviews_embedding = JSON.stringify(embedding);
        }
      }
    }

    // ========================================
    // 4. UPDATE DATABASE
    // ========================================
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      
      const { error } = await supabase
        .from('user_taste_profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) {
        console.error('Failed to update embeddings:', error);
        return NextResponse.json({ error: 'Failed to update embeddings' }, { status: 500 });
      }

      // Update combined embedding using database function
      await supabase.rpc('update_user_combined_embedding', { p_user_id: user.id });
    }

    return NextResponse.json({
      success: true,
      updated: Object.keys(updates).filter(k => k.endsWith('_embedding')),
    });

  } catch (error) {
    console.error('Error generating embeddings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function buildOnboardingText(profile: any): string {
  const parts: string[] = [];

  // Dietary preferences
  const dietary: string[] = [];
  if (profile.is_kosher) dietary.push('kosher');
  if (profile.is_vegetarian) dietary.push('vegetarian');
  if (profile.is_vegan) dietary.push('vegan');
  if (profile.gluten_free) dietary.push('gluten-free');
  if (dietary.length > 0) {
    parts.push(`Dietary requirements: ${dietary.join(', ')}`);
  }

  // Likes
  if (profile.likes && profile.likes.length > 0) {
    parts.push(`Likes: ${profile.likes.join(', ')}`);
  }

  // Dislikes
  if (profile.dislikes && profile.dislikes.length > 0) {
    parts.push(`Dislikes: ${profile.dislikes.join(', ')}`);
  }

  // Free text
  if (profile.free_text) {
    parts.push(`Notes: ${profile.free_text}`);
  }

  // Restaurant preferences by context
  if (profile.date_restaurants?.length > 0) {
    const names = profile.date_restaurants.map((r: any) => r.name).slice(0, 3);
    parts.push(`Favorite date spots: ${names.join(', ')}`);
  }
  if (profile.friends_restaurants?.length > 0) {
    const names = profile.friends_restaurants.map((r: any) => r.name).slice(0, 3);
    parts.push(`Goes with friends to: ${names.join(', ')}`);
  }
  if (profile.family_restaurants?.length > 0) {
    const names = profile.family_restaurants.map((r: any) => r.name).slice(0, 3);
    parts.push(`Family favorites: ${names.join(', ')}`);
  }

  return parts.join('. ');
}

function buildChatText(signals: any[]): string {
  // Combine recent chat contents into a summary
  const contents = signals
    .filter(s => s.content)
    .map(s => s.content)
    .join('. ');
  
  if (!contents) return '';
  
  return `Recent search preferences: ${contents}`;
}

function buildReviewsText(reviews: any[]): string {
  const parts: string[] = [];
  
  // Positive reviews (4-5 stars)
  const positiveReviews = reviews.filter(r => r.rating >= 4);
  if (positiveReviews.length > 0) {
    const positiveNames = positiveReviews
      .map(r => r.restaurant?.name)
      .filter(Boolean)
      .slice(0, 5);
    parts.push(`Highly rated: ${positiveNames.join(', ')}`);
    
    // Include some review content
    const positiveContent = positiveReviews
      .filter(r => r.content)
      .slice(0, 3)
      .map(r => r.content)
      .join('. ');
    if (positiveContent) {
      parts.push(`Positive feedback: ${positiveContent}`);
    }
  }

  // Negative reviews (1-2 stars)
  const negativeReviews = reviews.filter(r => r.rating <= 2);
  if (negativeReviews.length > 0) {
    const negativeNames = negativeReviews
      .map(r => r.restaurant?.name)
      .filter(Boolean)
      .slice(0, 3);
    parts.push(`Did not enjoy: ${negativeNames.join(', ')}`);
  }

  return parts.join('. ');
}

// GET - Check current embedding status
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_taste_profiles')
      .select(`
        onboarding_text,
        chat_summary_text,
        reviews_summary_text,
        onboarding_embedding,
        chat_embedding,
        reviews_embedding,
        combined_embedding,
        updated_at
      `)
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      hasOnboardingEmbedding: !!profile?.onboarding_embedding,
      hasChatEmbedding: !!profile?.chat_embedding,
      hasReviewsEmbedding: !!profile?.reviews_embedding,
      hasCombinedEmbedding: !!profile?.combined_embedding,
      onboardingText: profile?.onboarding_text,
      chatText: profile?.chat_summary_text,
      reviewsText: profile?.reviews_summary_text,
      lastUpdated: profile?.updated_at,
    });

  } catch (error) {
    console.error('Error getting embedding status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
