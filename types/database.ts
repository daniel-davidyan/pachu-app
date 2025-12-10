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

