/**
 * Database Entity Types
 * 
 * These types match the Supabase database schema.
 */

export interface User {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Profile {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  created_at?: string;
  updated_at?: string;
}

export interface VenueCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface Restaurant {
  id: string;
  categoryId?: string;
  googlePlaceId?: string;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  website?: string;
  priceLevel?: number; // 1-4
  cuisineTypes?: string[];
  imageUrl?: string;
  averageRating?: number;
  totalReviews?: number;
  latitude?: number;
  longitude?: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Review {
  id: string;
  userId: string;
  restaurantId: string;
  rating: number; // 1-5
  title?: string;
  content?: string;
  visitDate?: string;
  likesCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ReviewPhoto {
  id: string;
  reviewId: string;
  photoUrl: string;
  caption?: string;
  sortOrder: number;
  createdAt: string;
}

export interface ReviewVideo {
  id: string;
  reviewId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  sortOrder: number;
  createdAt: string;
}

// Combined media type for TikTok-style feed
export interface ReviewMedia {
  id: string;
  type: 'photo' | 'video';
  url: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  sortOrder: number;
}

export interface ReviewLike {
  id: string;
  reviewId: string;
  userId: string;
  createdAt: string;
}

export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
}

export interface Wishlist {
  id: string;
  userId: string;
  restaurantId: string;
  notes?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'like' | 'follow' | 'comment' | 'review';
  title: string;
  message?: string;
  link?: string;
  actorId?: string;
  referenceId?: string;
  read: boolean;
  createdAt: string;
}

export interface ChatConversation {
  id: string;
  userId: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

// ============================================================================
// RECOMMENDATION SYSTEM TYPES
// ============================================================================

/**
 * Cached restaurant data with embedding for vector search
 */
export interface RestaurantCache {
  id: string;
  googlePlaceId: string;
  name: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  googleRating?: number;
  googleReviewsCount?: number;
  priceLevel?: number;
  cuisineTypes?: string[];
  isKosher: boolean;
  isVegetarianFriendly: boolean;
  openingHours?: OpeningHours;
  photos?: RestaurantPhoto[];
  googleReviews?: GoogleReview[];
  summaryText?: string;
  embedding?: number[]; // VECTOR(1536) as array
  lastUpdated?: string;
  createdAt?: string;
}

export interface OpeningHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
}

export interface DayHours {
  open: string;
  close: string;
}

export interface RestaurantPhoto {
  photoReference: string;
  width: number;
  height: number;
}

export interface GoogleReview {
  authorName: string;
  rating: number;
  text: string;
  time: number;
  profilePhotoUrl?: string;
}

/**
 * User taste profile from onboarding
 */
export interface UserTasteProfile {
  id: string;
  userId: string;
  
  // Basic info
  birthDate?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  phone?: string;
  
  // Hard parameters (for SQL filtering)
  isKosher: boolean;
  isVegetarian: boolean;
  isVegan: boolean;
  glutenFree: boolean;
  
  // Preferences (in English)
  dislikes?: string[];
  likes?: string[];
  freeText?: string;
  
  // Restaurants by context
  dateRestaurants?: ContextRestaurant[];
  friendsRestaurants?: ContextRestaurant[];
  familyRestaurants?: ContextRestaurant[];
  soloRestaurants?: ContextRestaurant[];
  workRestaurants?: ContextRestaurant[];
  dislikedRestaurants?: ContextRestaurant[];
  
  // Google favorites import
  googleFavorites?: ContextRestaurant[];
  
  // Computed embedding
  tasteText?: string;
  tasteEmbedding?: number[];
  
  // Meta
  onboardingCompleted: boolean;
  onboardingStep: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContextRestaurant {
  googlePlaceId: string;
  name: string;
}

/**
 * Signal types for taste learning
 */
export type SignalType = 'review' | 'chat' | 'like' | 'comment' | 'wishlist' | 'click';

/**
 * User taste signal for learning preferences
 */
export interface UserTasteSignal {
  id: string;
  userId: string;
  
  signalType: SignalType;
  signalStrength: 1 | 2 | 3 | 4 | 5;
  isPositive: boolean;
  
  // Restaurant context
  restaurantId?: string;
  googlePlaceId?: string;
  restaurantName?: string;
  cuisineTypes?: string[];
  
  // Signal content (in English)
  content?: string;
  
  // Source reference
  sourceId?: string;
  
  createdAt?: string;
}

/**
 * Match score result from vector search
 */
export interface MatchScoreResult {
  restaurantId: string;
  matchScore: number; // 0-1, displayed as percentage
}

/**
 * Restaurant search result with similarity and distance
 */
export interface RestaurantSearchResult extends RestaurantCache {
  distanceMeters?: number;
  similarity?: number; // 0-1 from vector search
  matchScore?: number; // 0-1 computed match score
}

