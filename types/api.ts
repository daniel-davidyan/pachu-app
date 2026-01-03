/**
 * API Request and Response Types
 */

import { Restaurant, Review, User } from './database';

// Restaurant API Types
export interface RestaurantWithReviews extends Restaurant {
  reviews: ReviewWithUser[];
  mutualFriends?: MutualFriend[];
  distance?: number;
  matchPercentage?: number;
}

export interface ReviewWithUser extends Review {
  user: User;
  photos: string[];
}

export interface MutualFriend {
  id: string;
  name: string;
  avatarUrl?: string;
}

// Feed API Types
export interface FeedResponse {
  restaurants: RestaurantWithReviews[];
  hasMore: boolean;
}

export interface FeedParams {
  page?: number;
  limit?: number;
  latitude?: number;
  longitude?: number;
}

// Review API Types
export interface CreateReviewRequest {
  restaurant: {
    id?: string;
    googlePlaceId?: string;
    name: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    photoUrl?: string;
  };
  rating: number;
  content?: string;
  photoUrls?: string[];
}

export interface CreateReviewResponse {
  success: boolean;
  reviewId: string;
  message: string;
}

// Restaurant Filter Types
export interface RestaurantFilters {
  query: string;
  priceLevel?: number[];
  cuisineTypes?: string[];
  rating?: number;
  distance?: number;
  openNow?: boolean;
  tags?: string[];
}

// Search Types
export interface SearchParams {
  query: string;
  latitude?: number;
  longitude?: number;
  limit?: number;
}

// Profile API Types
export interface UpdateProfileRequest {
  username?: string;
  fullName?: string;
  bio?: string;
  avatarUrl?: string;
}

// ============================================================================
// RECOMMENDATION SYSTEM API TYPES
// ============================================================================

import { 
  UserTasteProfile, 
  UserTasteSignal, 
  SignalType,
  RestaurantSearchResult,
  ContextRestaurant 
} from './database';

// Taste Profile API Types
export interface UpdateTasteProfileRequest {
  birthDate?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  phone?: string;
  isKosher?: boolean;
  isVegetarian?: boolean;
  isVegan?: boolean;
  glutenFree?: boolean;
  dislikes?: string[];
  likes?: string[];
  freeText?: string;
  dateRestaurants?: ContextRestaurant[];
  friendsRestaurants?: ContextRestaurant[];
  familyRestaurants?: ContextRestaurant[];
  soloRestaurants?: ContextRestaurant[];
  workRestaurants?: ContextRestaurant[];
  dislikedRestaurants?: ContextRestaurant[];
  googleFavorites?: ContextRestaurant[];
  onboardingCompleted?: boolean;
  onboardingStep?: number;
}

export interface TasteProfileResponse {
  profile: UserTasteProfile | null;
  hasProfile: boolean;
  onboardingCompleted: boolean;
}

// Taste Signal API Types
export interface AddSignalRequest {
  signalType: SignalType;
  signalStrength: 1 | 2 | 3 | 4 | 5;
  isPositive: boolean;
  restaurantId?: string;
  googlePlaceId?: string;
  restaurantName?: string;
  cuisineTypes?: string[];
  content?: string;
  sourceId?: string;
}

export interface SignalsResponse {
  signals: UserTasteSignal[];
  total: number;
}

// Match Score API Types
export interface MatchScoreRequest {
  restaurantIds: string[];
}

export interface MatchScoreResponse {
  scores: {
    restaurantId: string;
    matchScore: number; // 0-100 percentage
  }[];
}

// Agent Recommend API Types
export interface AgentRecommendRequest {
  conversationId?: string;
  messages: {
    role: 'user' | 'assistant';
    content: string;
  }[];
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}

export interface AgentRecommendResponse {
  recommendations: RestaurantRecommendation[];
  conversationId: string;
  language: 'en' | 'he';
  explanation?: string;
  extractedPreferences?: {
    positive: string[];
    negative: string[];
  };
}

export interface RestaurantRecommendation {
  restaurant: RestaurantSearchResult;
  matchScore: number; // 0-100 percentage
  explanation: string; // Why this restaurant matches
  contextMatch?: string; // e.g., "date", "family", "friends"
}

// Restaurant Cache API Types
export interface PopulateCacheRequest {
  region?: 'israel' | 'tel_aviv' | 'jerusalem' | 'haifa';
  forceUpdate?: boolean;
}

export interface PopulateCacheResponse {
  success: boolean;
  restaurantsProcessed: number;
  restaurantsAdded: number;
  restaurantsUpdated: number;
  errors: number;
  duration: number; // in ms
}

// Nearby Restaurants (from cache) Types
export interface NearbyRestaurantsRequest {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  limit?: number;
  filterKosher?: boolean;
  filterVegetarian?: boolean;
}

export interface NearbyRestaurantsResponse {
  restaurants: RestaurantSearchResult[];
  total: number;
  fromCache: boolean;
}

