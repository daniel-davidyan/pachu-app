/**
 * Recommendation Pipeline V2 - Shared Types
 */

// ============================================================================
// CONVERSATION CONTEXT
// ============================================================================

export type LocationPreference = 'nearby' | 'anywhere' | 'tel_aviv' | 'specific_city';
export type TimingPreference = 'now' | 'tonight' | 'tomorrow' | 'weekend' | 'anytime';

export interface ConversationContext {
  // WHERE - Location preferences
  locationPreference: LocationPreference;
  specificCity?: string;
  maxDistanceMeters?: number; // 500 for walking, 2000 for nearby, null for anywhere
  
  // WHEN - Timing preferences
  timing: TimingPreference;
  specificTime?: string; // "19:00"
  specificDay?: number; // 0-6 (Sunday-Saturday)
  
  // WHAT - For embedding generation
  cuisinePreferences: string[];
  occasion: string;
  vibe: string[];
  budget: string;
  dietaryRestrictions: string[];
  
  // Raw conversation text for embedding
  conversationText: string;
  
  // Detected language
  language: 'he' | 'en';
}

// ============================================================================
// RESTAURANT TYPES
// ============================================================================

export interface CachedRestaurant {
  id?: string;
  google_place_id: string;
  name: string;
  address: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  website: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  price_level: number | null;
  categories: string[];
  opening_hours: OpeningHours | null;
  photos: PhotoReference[];
  google_reviews: GoogleReview[];
  summary: string | null;
  summary_embedding: number[] | null;
  reviews_text: string | null;
  reviews_embedding: number[] | null;
}

export interface OpeningHours {
  periods?: OpeningPeriod[];
  weekday_text?: string[];
}

export interface OpeningPeriod {
  open: { day: number; time: string };
  close?: { day: number; time: string };
}

export interface PhotoReference {
  photo_reference: string;
  width: number;
  height: number;
}

export interface GoogleReview {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  relative_time_description: string;
}

// ============================================================================
// SCORED RESTAURANT (after vector search)
// ============================================================================

export interface ScoredRestaurant extends CachedRestaurant {
  vectorScore: number;      // 0-1 from vector similarity
  summaryScore: number;     // 0-1 similarity to summary_embedding
  reviewsScore: number;     // 0-1 similarity to reviews_embedding
  distanceMeters?: number;  // Distance from user
}

// ============================================================================
// RANKED RESTAURANT (after re-ranking)
// ============================================================================

export interface RankedRestaurant extends ScoredRestaurant {
  finalScore: number;       // Final score after re-ranking
  ratingBoost: number;      // Boost from Google rating
  popularityBoost: number;  // Boost from review count
  distancePenalty: number;  // Penalty for distance
}

// ============================================================================
// RECOMMENDATION (final output)
// ============================================================================

export interface Recommendation {
  restaurant: RankedRestaurant;
  reason: string;           // 1-2 sentence personal explanation
  matchPercentage: number;  // Display percentage (0-100)
}

// ============================================================================
// PIPELINE RESULT
// ============================================================================

export interface PipelineResult {
  recommendations: Recommendation[];
  debug?: PipelineDebug;
}

export interface PipelineDebug {
  context: ConversationContext;
  hardFilterCount: number;
  vectorSearchCount: number;
  rerankCount: number;
  processingTimeMs: number;
}

// ============================================================================
// USER LOCATION
// ============================================================================

export interface UserLocation {
  lat: number;
  lng: number;
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
