import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { MatchScoreRequest, MatchScoreResponse } from '@/types/api';

/**
 * POST /api/restaurants/match-score
 * Calculate match scores between user's taste profile and restaurants
 * 
 * This is the "passive" match score shown on map/feed without active conversation.
 * 
 * Formula:
 * match_score = 
 *   0.50 × cosine_similarity(user_taste_embedding, restaurant_embedding) +
 *   0.25 × (google_rating / 5) +
 *   0.25 × friends_score
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    const body: MatchScoreRequest = await request.json();
    const { restaurantIds } = body;

    if (!restaurantIds || restaurantIds.length === 0) {
      return NextResponse.json(
        { error: 'restaurantIds array is required' },
        { status: 400 }
      );
    }

    // If user is not logged in, return default scores
    if (userError || !user) {
      const defaultScores = restaurantIds.map((id: string) => ({
        restaurantId: id,
        matchScore: 75, // Default 75%
      }));

      return NextResponse.json({ scores: defaultScores });
    }

    // Get user's taste profile with embeddings (prefer combined > onboarding > taste)
    const { data: tasteProfile, error: profileError } = await supabase
      .from('user_taste_profiles')
      .select('combined_embedding, onboarding_embedding, taste_embedding, is_kosher, is_vegetarian, is_vegan')
      .eq('user_id', user.id)
      .single();

    // Get the best available user embedding (combined > onboarding > taste)
    const userEmbedding = tasteProfile?.combined_embedding 
      || tasteProfile?.onboarding_embedding 
      || tasteProfile?.taste_embedding;

    // If no taste profile or embedding, return default scores
    if (profileError || !userEmbedding) {
      const defaultScores = restaurantIds.map((id: string) => ({
        restaurantId: id,
        matchScore: 75,
      }));

      return NextResponse.json({ scores: defaultScores });
    }

    // Get user's following list for friends score
    const { data: followingData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);

    const followingIds = (followingData || []).map((f: any) => f.following_id);

    // Try to get scores from restaurant_cache first (if restaurants are in cache)
    const { data: cachedRestaurants } = await supabase
      .from('restaurant_cache')
      .select('id, google_place_id, google_rating, summary_embedding, reviews_embedding')
      .in('id', restaurantIds);

    // Also check by google_place_id (in case restaurantIds are place IDs)
    const { data: cachedByPlaceId } = await supabase
      .from('restaurant_cache')
      .select('id, google_place_id, google_rating, summary_embedding, reviews_embedding')
      .in('google_place_id', restaurantIds);

    // Combine results
    const allCached = [...(cachedRestaurants || []), ...(cachedByPlaceId || [])];
    const cachedMap = new Map<string, any>();
    allCached.forEach((r: any) => {
      cachedMap.set(r.id, r);
      if (r.google_place_id) {
        cachedMap.set(r.google_place_id, r);
      }
    });

    // Get restaurants from main restaurants table for friends score
    const { data: dbRestaurants } = await supabase
      .from('restaurants')
      .select('id, google_place_id, average_rating')
      .in('google_place_id', restaurantIds);

    const dbRestaurantMap = new Map<string, any>();
    (dbRestaurants || []).forEach((r: any) => {
      dbRestaurantMap.set(r.google_place_id, r);
    });

    // Get friends' reviews for these restaurants
    const dbRestaurantIds = (dbRestaurants || []).map((r: any) => r.id);
    const friendsReviewsMap = new Map<string, number>();

    if (followingIds.length > 0 && dbRestaurantIds.length > 0) {
      const { data: friendsReviews } = await supabase
        .from('reviews')
        .select('restaurant_id, rating')
        .in('restaurant_id', dbRestaurantIds)
        .in('user_id', followingIds);

      // Count unique friends who reviewed and average rating
      (friendsReviews || []).forEach((review: any) => {
        const current = friendsReviewsMap.get(review.restaurant_id) || 0;
        friendsReviewsMap.set(review.restaurant_id, current + review.rating);
      });
    }

    // Calculate scores for each restaurant
    const scores: { restaurantId: string; matchScore: number }[] = [];

    for (const restaurantId of restaurantIds) {
      let matchScore = 75; // Default

      // Get cached restaurant data
      const cached = cachedMap.get(restaurantId);
      const dbRestaurant = dbRestaurantMap.get(restaurantId);

      if (cached && cached.summary_embedding && userEmbedding) {
        // Calculate cosine similarity with summary embedding
        const summarySimilarity = cosineSimilarity(
          userEmbedding,
          cached.summary_embedding
        );
        
        // Also check reviews embedding if available
        let reviewsSimilarity = 0;
        if (cached.reviews_embedding) {
          reviewsSimilarity = cosineSimilarity(
            userEmbedding,
            cached.reviews_embedding
          );
        }
        
        // Combined similarity: 70% summary, 30% reviews
        const similarity = cached.reviews_embedding 
          ? (summarySimilarity * 0.7 + reviewsSimilarity * 0.3)
          : summarySimilarity;

        // Get Google rating (0-1 scale)
        const ratingScore = (cached.google_rating || 3.5) / 5;

        // Get friends score
        let friendsScore = 0.5; // Default
        if (dbRestaurant) {
          const friendsRatingSum = friendsReviewsMap.get(dbRestaurant.id);
          if (friendsRatingSum) {
            // Normalize: assume max 5 friends with 5 rating each = 25
            friendsScore = Math.min(friendsRatingSum / 25, 1);
          }
        }

        // Calculate final score
        // 50% taste similarity + 25% rating + 25% friends
        matchScore = (
          0.50 * similarity +
          0.25 * ratingScore +
          0.25 * friendsScore
        ) * 100;

        // Clamp to 0-100
        matchScore = Math.max(0, Math.min(100, Math.round(matchScore)));
      } else if (dbRestaurant) {
        // No cache, use database rating and friends
        const rating = dbRestaurant.average_rating || 3.5;
        const ratingScore = rating / 5;

        let friendsScore = 0.5;
        const friendsRatingSum = friendsReviewsMap.get(dbRestaurant.id);
        if (friendsRatingSum) {
          friendsScore = Math.min(friendsRatingSum / 25, 1);
        }

        // Without embedding, weight rating and friends more
        matchScore = (
          0.60 * ratingScore +
          0.40 * friendsScore
        ) * 100;

        matchScore = Math.max(0, Math.min(100, Math.round(matchScore)));
      }

      scores.push({
        restaurantId,
        matchScore,
      });
    }

    const response: MatchScoreResponse = { scores };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in match-score:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/restaurants/match-score
 * Get match score for a single restaurant
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const restaurantId = searchParams.get('restaurantId');

  if (!restaurantId) {
    return NextResponse.json(
      { error: 'restaurantId is required' },
      { status: 400 }
    );
  }

  // Create a mock request body and call POST
  const mockRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ restaurantIds: [restaurantId] }),
    headers: request.headers,
  });

  return POST(mockRequest);
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

