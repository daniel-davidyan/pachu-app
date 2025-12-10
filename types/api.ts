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

