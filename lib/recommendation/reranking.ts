/**
 * Recommendation Pipeline V2 - Re-ranking
 * 
 * Re-ranks restaurants based on additional signals:
 * - Google rating boost
 * - Popularity (review count) boost
 * - Distance penalty
 * - Context-based boosts (occasion, budget, etc.)
 */

import {
  ScoredRestaurant,
  RankedRestaurant,
  ConversationContext,
  UserLocation,
} from './types';
import { calculateDistanceMeters } from './hard-filters';

// ============================================================================
// SCORING WEIGHTS
// ============================================================================

const WEIGHTS = {
  // Rating boosts
  RATING_EXCELLENT: 0.10,  // >= 4.5
  RATING_GOOD: 0.05,       // >= 4.0
  
  // Popularity boosts
  POPULAR_HIGH: 0.10,      // > 1000 reviews
  POPULAR_MEDIUM: 0.05,    // > 500 reviews
  
  // Distance penalty (per km)
  DISTANCE_PENALTY_PER_KM: 0.01,
  
  // Occasion boosts
  DATE_HIGH_RATING_BOOST: 0.10,     // Date + rating >= 4.3
  QUICK_CHEAP_BOOST: 0.10,          // Quick bite + price <= 2
  
  // Budget alignment
  BUDGET_MATCH_BOOST: 0.08,
  BUDGET_MISMATCH_PENALTY: 0.05,
};

// ============================================================================
// INDIVIDUAL SCORING FUNCTIONS
// ============================================================================

/**
 * Calculate rating boost based on Google rating
 */
function calculateRatingBoost(rating: number | null): number {
  if (!rating) return 0;
  
  if (rating >= 4.5) return WEIGHTS.RATING_EXCELLENT;
  if (rating >= 4.0) return WEIGHTS.RATING_GOOD;
  return 0;
}

/**
 * Calculate popularity boost based on review count
 */
function calculatePopularityBoost(reviewCount: number | null): number {
  if (!reviewCount) return 0;
  
  if (reviewCount > 1000) return WEIGHTS.POPULAR_HIGH;
  if (reviewCount > 500) return WEIGHTS.POPULAR_MEDIUM;
  return 0;
}

/**
 * Calculate distance penalty
 */
function calculateDistancePenalty(
  restaurant: ScoredRestaurant,
  userLocation: UserLocation
): number {
  if (!restaurant.latitude || !restaurant.longitude) {
    return 0;
  }
  
  const distanceMeters = calculateDistanceMeters(
    userLocation.lat,
    userLocation.lng,
    restaurant.latitude,
    restaurant.longitude
  );
  
  const distanceKm = distanceMeters / 1000;
  
  // Cap penalty at 10km (0.10 max penalty)
  return Math.min(distanceKm * WEIGHTS.DISTANCE_PENALTY_PER_KM, 0.10);
}

/**
 * Calculate occasion-based boost
 */
function calculateOccasionBoost(
  restaurant: ScoredRestaurant,
  context: ConversationContext
): number {
  let boost = 0;
  
  const occasion = context.occasion.toLowerCase();
  const rating = restaurant.google_rating || 0;
  const priceLevel = restaurant.price_level || 2;
  
  // Date occasion: prefer high-rated romantic places
  if (occasion.includes('date') || occasion.includes('דייט') || occasion.includes('רומנטי')) {
    if (rating >= 4.3) {
      boost += WEIGHTS.DATE_HIGH_RATING_BOOST;
    }
  }
  
  // Quick bite: prefer cheap and casual
  if (occasion.includes('quick') || occasion.includes('מהיר') || occasion.includes('קל')) {
    if (priceLevel <= 2) {
      boost += WEIGHTS.QUICK_CHEAP_BOOST;
    }
  }
  
  // Business: prefer moderate to upscale
  if (occasion.includes('business') || occasion.includes('עסקים') || occasion.includes('פגישה')) {
    if (priceLevel >= 2 && rating >= 4.0) {
      boost += 0.05;
    }
  }
  
  // Family: no specific boost, just ensure variety
  
  return boost;
}

/**
 * Calculate budget alignment score
 */
function calculateBudgetScore(
  restaurant: ScoredRestaurant,
  context: ConversationContext
): number {
  if (!context.budget) return 0;
  
  const priceLevel = restaurant.price_level || 2;
  const budget = context.budget.toLowerCase();
  
  // Map budget to expected price level
  let expectedPriceLevel: number;
  
  if (budget.includes('cheap') || budget.includes('זול') || budget.includes('תקציב')) {
    expectedPriceLevel = 1;
  } else if (budget.includes('moderate') || budget.includes('בינוני') || budget.includes('סביר')) {
    expectedPriceLevel = 2;
  } else if (budget.includes('expensive') || budget.includes('יקר') || budget.includes('יוקרתי')) {
    expectedPriceLevel = 3;
  } else {
    return 0; // Can't determine budget preference
  }
  
  // Perfect match
  if (priceLevel === expectedPriceLevel) {
    return WEIGHTS.BUDGET_MATCH_BOOST;
  }
  
  // Within one level
  if (Math.abs(priceLevel - expectedPriceLevel) === 1) {
    return WEIGHTS.BUDGET_MATCH_BOOST / 2;
  }
  
  // Two or more levels off - penalty
  return -WEIGHTS.BUDGET_MISMATCH_PENALTY;
}

// ============================================================================
// MAIN RE-RANKING FUNCTION
// ============================================================================

/**
 * Re-rank restaurants based on multiple signals
 * Returns top N restaurants sorted by final score
 */
export function rerankRestaurants(
  restaurants: ScoredRestaurant[],
  context: ConversationContext,
  userLocation: UserLocation,
  topN: number = 15
): RankedRestaurant[] {
  console.log(`📊 Re-ranking ${restaurants.length} restaurants`);
  
  const ranked: RankedRestaurant[] = restaurants.map(restaurant => {
    // Start with vector score
    let score = restaurant.vectorScore;
    
    // Calculate individual components
    const ratingBoost = calculateRatingBoost(restaurant.google_rating);
    const popularityBoost = calculatePopularityBoost(restaurant.google_reviews_count);
    const distancePenalty = calculateDistancePenalty(restaurant, userLocation);
    const occasionBoost = calculateOccasionBoost(restaurant, context);
    const budgetScore = calculateBudgetScore(restaurant, context);
    
    // Apply all adjustments
    score += ratingBoost;
    score += popularityBoost;
    score -= distancePenalty;
    score += occasionBoost;
    score += budgetScore;
    
    // Calculate distance for reference
    let distanceMeters: number | undefined;
    if (restaurant.latitude && restaurant.longitude) {
      distanceMeters = calculateDistanceMeters(
        userLocation.lat,
        userLocation.lng,
        restaurant.latitude,
        restaurant.longitude
      );
    }
    
    return {
      ...restaurant,
      finalScore: score,
      ratingBoost,
      popularityBoost,
      distancePenalty,
      distanceMeters,
    };
  });
  
  // Sort by final score (descending)
  const sorted = ranked.sort((a, b) => b.finalScore - a.finalScore);
  
  // Take top N
  const topResults = sorted.slice(0, topN);
  
  console.log(`✅ Re-ranking complete. Top results:`);
  topResults.slice(0, 5).forEach((r, i) => {
    console.log(
      `   ${i + 1}. ${r.name}: ` +
      `final=${(r.finalScore * 100).toFixed(1)}% ` +
      `(vector=${(r.vectorScore * 100).toFixed(1)}%, ` +
      `rating+${(r.ratingBoost * 100).toFixed(0)}%, ` +
      `pop+${(r.popularityBoost * 100).toFixed(0)}%, ` +
      `dist-${(r.distancePenalty * 100).toFixed(0)}%)`
    );
  });
  
  return topResults;
}

// ============================================================================
// DIVERSITY ENHANCEMENT
// ============================================================================

/**
 * Enhance diversity in results by ensuring variety in cuisine types
 * This is an optional post-processing step
 */
export function enhanceDiversity(
  restaurants: RankedRestaurant[],
  targetCount: number = 15,
  maxSameCuisine: number = 3
): RankedRestaurant[] {
  const result: RankedRestaurant[] = [];
  const cuisineCount: Record<string, number> = {};
  
  for (const restaurant of restaurants) {
    // Get primary cuisine
    const primaryCuisine = restaurant.categories?.[0] || 'Other';
    const currentCount = cuisineCount[primaryCuisine] || 0;
    
    // Check if we've hit the limit for this cuisine
    if (currentCount < maxSameCuisine) {
      result.push(restaurant);
      cuisineCount[primaryCuisine] = currentCount + 1;
      
      if (result.length >= targetCount) {
        break;
      }
    }
  }
  
  // If we don't have enough, add remaining regardless of cuisine
  if (result.length < targetCount) {
    const remaining = restaurants.filter(r => !result.includes(r));
    result.push(...remaining.slice(0, targetCount - result.length));
  }
  
  return result;
}
