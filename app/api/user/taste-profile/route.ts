import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { UpdateTasteProfileRequest, TasteProfileResponse } from '@/types/api';

/**
 * GET /api/user/taste-profile
 * Returns the user's taste profile
 */
export async function GET() {
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

    // Get taste profile
    const { data: profile, error: profileError } = await supabase
      .from('user_taste_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is fine
      console.error('Error fetching taste profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch taste profile' },
        { status: 500 }
      );
    }

    const response: TasteProfileResponse = {
      profile: profile ? transformProfile(profile) : null,
      hasProfile: !!profile,
      onboardingCompleted: profile?.onboarding_completed || false,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in taste profile GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/taste-profile
 * Creates or updates the user's taste profile
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

    const body: UpdateTasteProfileRequest = await request.json();

    // Build the update object
    const updateData = buildUpdateData(body);

    // Check if profile exists
    const { data: existing } = await supabase
      .from('user_taste_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let profile;
    if (existing) {
      // Update existing profile
      const { data, error } = await supabase
        .from('user_taste_profiles')
        .update(updateData)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating taste profile:', error);
        return NextResponse.json(
          { error: 'Failed to update taste profile' },
          { status: 500 }
        );
      }
      profile = data;
    } else {
      // Create new profile
      const { data, error } = await supabase
        .from('user_taste_profiles')
        .insert({
          user_id: user.id,
          ...updateData,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating taste profile:', error);
        return NextResponse.json(
          { error: 'Failed to create taste profile' },
          { status: 500 }
        );
      }
      profile = data;
    }

    // If onboarding is completed, build and store the taste embedding
    if (profile.onboarding_completed) {
      await rebuildTasteEmbedding(supabase, user.id, profile);
    }

    return NextResponse.json({
      success: true,
      profile: transformProfile(profile),
    });
  } catch (error) {
    console.error('Error in taste profile POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/taste-profile
 * Partial update of taste profile
 */
export async function PUT(request: NextRequest) {
  // Same as POST for partial updates
  return POST(request);
}

// Helper function to transform database row to API response format
function transformProfile(dbProfile: any) {
  return {
    id: dbProfile.id,
    userId: dbProfile.user_id,
    birthDate: dbProfile.birth_date,
    gender: dbProfile.gender,
    phone: dbProfile.phone,
    isKosher: dbProfile.is_kosher || false,
    isVegetarian: dbProfile.is_vegetarian || false,
    isVegan: dbProfile.is_vegan || false,
    glutenFree: dbProfile.gluten_free || false,
    dislikes: dbProfile.dislikes || [],
    likes: dbProfile.likes || [],
    freeText: dbProfile.free_text,
    dateRestaurants: dbProfile.date_restaurants || [],
    friendsRestaurants: dbProfile.friends_restaurants || [],
    familyRestaurants: dbProfile.family_restaurants || [],
    soloRestaurants: dbProfile.solo_restaurants || [],
    workRestaurants: dbProfile.work_restaurants || [],
    dislikedRestaurants: dbProfile.disliked_restaurants || [],
    googleFavorites: dbProfile.google_favorites || [],
    tasteText: dbProfile.taste_text,
    tasteEmbedding: dbProfile.taste_embedding,
    onboardingCompleted: dbProfile.onboarding_completed || false,
    onboardingStep: dbProfile.onboarding_step || 0,
    createdAt: dbProfile.created_at,
    updatedAt: dbProfile.updated_at,
  };
}

// Helper function to build update data from request
function buildUpdateData(body: UpdateTasteProfileRequest) {
  const data: any = {};

  if (body.birthDate !== undefined) data.birth_date = body.birthDate;
  if (body.gender !== undefined) data.gender = body.gender;
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.isKosher !== undefined) data.is_kosher = body.isKosher;
  if (body.isVegetarian !== undefined) data.is_vegetarian = body.isVegetarian;
  if (body.isVegan !== undefined) data.is_vegan = body.isVegan;
  if (body.glutenFree !== undefined) data.gluten_free = body.glutenFree;
  if (body.dislikes !== undefined) data.dislikes = body.dislikes;
  if (body.likes !== undefined) data.likes = body.likes;
  if (body.freeText !== undefined) data.free_text = body.freeText;
  if (body.dateRestaurants !== undefined) data.date_restaurants = body.dateRestaurants;
  if (body.friendsRestaurants !== undefined) data.friends_restaurants = body.friendsRestaurants;
  if (body.familyRestaurants !== undefined) data.family_restaurants = body.familyRestaurants;
  if (body.soloRestaurants !== undefined) data.solo_restaurants = body.soloRestaurants;
  if (body.workRestaurants !== undefined) data.work_restaurants = body.workRestaurants;
  if (body.dislikedRestaurants !== undefined) data.disliked_restaurants = body.dislikedRestaurants;
  if (body.googleFavorites !== undefined) data.google_favorites = body.googleFavorites;
  if (body.onboardingCompleted !== undefined) data.onboarding_completed = body.onboardingCompleted;
  if (body.onboardingStep !== undefined) data.onboarding_step = body.onboardingStep;

  return data;
}

/**
 * Rebuild taste embedding from profile data and signals
 */
async function rebuildTasteEmbedding(supabase: any, userId: string, profile: any) {
  try {
    // Get user's signals
    const { data: signals } = await supabase
      .from('user_taste_signals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Build taste text
    const tasteText = buildTasteText(profile, signals || []);

    if (!tasteText || tasteText.length < 10) {
      console.log('Taste text too short, skipping embedding generation');
      return;
    }

    // Generate embedding
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

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
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating taste embedding:', updateError);
    } else {
      console.log(`✅ Updated taste embedding for user ${userId}, taste text length: ${tasteText.length}`);
    }
  } catch (error) {
    console.error('Error rebuilding taste embedding:', error);
  }
}

/**
 * Build taste text from profile and signals
 * This text is used to generate the embedding
 */
function buildTasteText(profile: any, signals: any[]): string {
  const parts: string[] = [];

  // 1. Dietary restrictions (most important)
  if (profile.is_kosher) parts.push('Only eats kosher food.');
  if (profile.is_vegan) parts.push('Vegan diet.');
  else if (profile.is_vegetarian) parts.push('Vegetarian diet.');
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
      const names = restaurants.map((r: any) => r.name).join(', ');
      parts.push(`Favorite ${context} restaurants: ${names}.`);
    }
  };

  addContextRestaurants(profile.date_restaurants, 'date');
  addContextRestaurants(profile.friends_restaurants, 'friends');
  addContextRestaurants(profile.family_restaurants, 'family');
  addContextRestaurants(profile.solo_restaurants, 'solo');
  addContextRestaurants(profile.work_restaurants, 'work/business');

  // 5. Disliked restaurants
  if (profile.disliked_restaurants?.length > 0) {
    const names = profile.disliked_restaurants.map((r: any) => r.name).join(', ');
    parts.push(`Restaurants to avoid: ${names}.`);
  }

  // 6. Google favorites
  if (profile.google_favorites?.length > 0) {
    const names = profile.google_favorites.slice(0, 10).map((r: any) => r.name).join(', ');
    parts.push(`Google favorites: ${names}.`);
  }

  // 7. Signals (weighted by strength and recency)
  if (signals.length > 0) {
    const positiveSignals = signals.filter((s: any) => s.is_positive);
    const negativeSignals = signals.filter((s: any) => !s.is_positive);

    // Positive signals
    const positiveTexts = positiveSignals
      .filter((s: any) => s.content)
      .map((s: any) => s.content)
      .slice(0, 10);
    
    if (positiveTexts.length > 0) {
      parts.push(`Learned preferences: ${positiveTexts.join('. ')}.`);
    }

    // Negative signals
    const negativeTexts = negativeSignals
      .filter((s: any) => s.content)
      .map((s: any) => s.content)
      .slice(0, 10);
    
    if (negativeTexts.length > 0) {
      parts.push(`Things they dislike: ${negativeTexts.join('. ')}.`);
    }

    // Cuisine preferences from signals
    const cuisinePreferences = new Map<string, number>();
    signals.forEach((signal: any) => {
      if (signal.cuisine_types?.length > 0) {
        signal.cuisine_types.forEach((cuisine: string) => {
          const current = cuisinePreferences.get(cuisine) || 0;
          const weight = signal.is_positive ? signal.signal_strength : -signal.signal_strength;
          cuisinePreferences.set(cuisine, current + weight);
        });
      }
    });

    // Add top liked cuisines
    const likedCuisines = Array.from(cuisinePreferences.entries())
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cuisine]) => cuisine);

    if (likedCuisines.length > 0) {
      parts.push(`Frequently enjoys: ${likedCuisines.join(', ')}.`);
    }

    // Add disliked cuisines
    const dislikedCuisines = Array.from(cuisinePreferences.entries())
      .filter(([, score]) => score < 0)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([cuisine]) => cuisine);

    if (dislikedCuisines.length > 0) {
      parts.push(`Tends to avoid: ${dislikedCuisines.join(', ')}.`);
    }
  }

  return parts.join(' ');
}

