import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

/**
 * POST /api/user/taste-profile/rebuild-embedding
 * Rebuilds the user's taste embedding from profile data and signals
 * 
 * This should be called:
 * - After onboarding is completed
 * - After adding significant signals (reviews, chat preferences)
 * - Periodically as a background job
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's taste profile
    const { data: profile, error: profileError } = await supabase
      .from('user_taste_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Taste profile not found. Please complete onboarding first.' },
        { status: 404 }
      );
    }

    // Get user's signals
    const { data: signals, error: signalsError } = await supabase
      .from('user_taste_signals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (signalsError) {
      console.error('Error fetching signals:', signalsError);
    }

    // Build taste text
    const tasteText = buildTasteText(profile, signals || []);

    if (!tasteText || tasteText.length < 10) {
      return NextResponse.json({
        success: true,
        message: 'Not enough data to build taste profile',
        tasteText: null,
        embeddingGenerated: false,
      });
    }

    // Generate embedding using OpenAI
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log(`🔄 Generating embedding for user ${user.id}, taste text length: ${tasteText.length}`);

    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: tasteText,
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Update profile with taste text and embedding
    const { error: updateError } = await supabase
      .from('user_taste_profiles')
      .update({
        taste_text: tasteText,
        taste_embedding: embedding,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating taste profile:', updateError);
      return NextResponse.json(
        { error: 'Failed to save embedding' },
        { status: 500 }
      );
    }

    console.log(`✅ Embedding generated and saved for user ${user.id}`);

    return NextResponse.json({
      success: true,
      message: 'Taste embedding rebuilt successfully',
      tasteText,
      embeddingGenerated: true,
      signalsUsed: signals?.length || 0,
    });
  } catch (error) {
    console.error('Error in rebuild-embedding:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Build taste text from profile and signals
 * This text is used to generate the embedding
 */
function buildTasteText(profile: any, signals: any[]): string {
  const parts: string[] = [];

  // 1. Dietary restrictions (most important - hard filters)
  if (profile.is_kosher) parts.push('Only eats kosher food.');
  if (profile.is_vegan) parts.push('Vegan diet - no animal products.');
  else if (profile.is_vegetarian) parts.push('Vegetarian diet - no meat.');
  if (profile.gluten_free) parts.push('Gluten-free diet.');

  // 2. Likes and dislikes from onboarding
  if (profile.likes?.length > 0) {
    parts.push(`Likes: ${profile.likes.join(', ')}.`);
  }
  if (profile.dislikes?.length > 0) {
    parts.push(`Dislikes: ${profile.dislikes.join(', ')}.`);
  }

  // 3. Free text description
  if (profile.free_text) {
    parts.push(profile.free_text);
  }

  // 4. Restaurants by context
  const addContextRestaurants = (restaurants: any[], context: string) => {
    if (restaurants?.length > 0) {
      const names = restaurants.map((r: any) => r.name).filter(Boolean).join(', ');
      if (names) {
        parts.push(`Favorite ${context} restaurants: ${names}.`);
      }
    }
  };

  addContextRestaurants(profile.date_restaurants, 'date');
  addContextRestaurants(profile.friends_restaurants, 'friends');
  addContextRestaurants(profile.family_restaurants, 'family');
  addContextRestaurants(profile.solo_restaurants, 'solo');
  addContextRestaurants(profile.work_restaurants, 'work/business');

  // 5. Disliked restaurants
  if (profile.disliked_restaurants?.length > 0) {
    const names = profile.disliked_restaurants
      .map((r: any) => r.name)
      .filter(Boolean)
      .join(', ');
    if (names) {
      parts.push(`Restaurants to avoid: ${names}.`);
    }
  }

  // 6. Google favorites
  if (profile.google_favorites?.length > 0) {
    const names = profile.google_favorites
      .slice(0, 10)
      .map((r: any) => r.name)
      .filter(Boolean)
      .join(', ');
    if (names) {
      parts.push(`Google favorites: ${names}.`);
    }
  }

  // 7. Process signals
  if (signals.length > 0) {
    // Separate positive and negative signals
    const positiveSignals = signals.filter((s: any) => s.is_positive);
    const negativeSignals = signals.filter((s: any) => !s.is_positive);

    // Extract content from positive signals
    const positiveContents = positiveSignals
      .filter((s: any) => s.content)
      .map((s: any) => s.content)
      .slice(0, 15);
    
    if (positiveContents.length > 0) {
      parts.push(`Learned preferences: ${positiveContents.join('. ')}.`);
    }

    // Extract content from negative signals
    const negativeContents = negativeSignals
      .filter((s: any) => s.content)
      .map((s: any) => s.content)
      .slice(0, 10);
    
    if (negativeContents.length > 0) {
      parts.push(`Things they dislike: ${negativeContents.join('. ')}.`);
    }

    // Aggregate cuisine preferences from signals
    const cuisineScores = new Map<string, number>();
    signals.forEach((signal: any) => {
      if (signal.cuisine_types?.length > 0) {
        signal.cuisine_types.forEach((cuisine: string) => {
          const current = cuisineScores.get(cuisine) || 0;
          const weight = signal.is_positive ? signal.signal_strength : -signal.signal_strength;
          cuisineScores.set(cuisine, current + weight);
        });
      }
    });

    // Top liked cuisines
    const likedCuisines = Array.from(cuisineScores.entries())
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cuisine]) => cuisine);

    if (likedCuisines.length > 0) {
      parts.push(`Frequently enjoys: ${likedCuisines.join(', ')}.`);
    }

    // Cuisines to avoid
    const avoidCuisines = Array.from(cuisineScores.entries())
      .filter(([, score]) => score < -2) // Only strongly negative
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([cuisine]) => cuisine);

    if (avoidCuisines.length > 0) {
      parts.push(`Tends to avoid: ${avoidCuisines.join(', ')}.`);
    }

    // Aggregate restaurant visit patterns
    const visitedRestaurants = new Map<string, { count: number; avgRating: number }>();
    signals
      .filter((s: any) => s.signal_type === 'review' && s.restaurant_name)
      .forEach((signal: any) => {
        const existing = visitedRestaurants.get(signal.restaurant_name);
        if (existing) {
          existing.count++;
        } else {
          visitedRestaurants.set(signal.restaurant_name, { count: 1, avgRating: signal.signal_strength });
        }
      });

    // Frequently visited restaurants (more than 1 review)
    const frequentVisits = Array.from(visitedRestaurants.entries())
      .filter(([, data]) => data.count > 1)
      .slice(0, 5)
      .map(([name]) => name);

    if (frequentVisits.length > 0) {
      parts.push(`Frequently visits: ${frequentVisits.join(', ')}.`);
    }
  }

  return parts.join(' ').trim();
}

