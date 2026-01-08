'use client';

import { createContext, useContext, useCallback, useRef } from 'react';
import { mutate } from 'swr';
import { cacheKeys } from '@/lib/swr-config';

/**
 * Feed Data Context
 * Allows sharing data from feed to detail pages for instant navigation
 */

interface FeedReview {
  id: string;
  rating: number;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  restaurant: {
    id: string;
    name: string;
    address?: string;
    city?: string;
    distance?: number;
    isOpen: boolean;
    matchPercentage: number;
    googlePlaceId?: string;
    imageUrl?: string;
  };
  media: Array<{
    id: string;
    type: 'photo' | 'video';
    url: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
  }>;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isSaved: boolean;
  mutualFriends: Array<{
    id: string;
    name: string;
    avatarUrl?: string;
  }>;
}

interface FeedDataContextValue {
  /**
   * Store feed review data for a restaurant (enables instant navigation)
   */
  cacheRestaurantFromFeed: (review: FeedReview) => void;
  
  /**
   * Store feed review data for a user profile (enables instant navigation)
   */
  cacheProfileFromFeed: (review: FeedReview) => void;
  
  /**
   * Get cached restaurant data from feed
   */
  getCachedRestaurant: (restaurantId: string) => any | null;
  
  /**
   * Get cached profile data from feed
   */
  getCachedProfile: (userId: string) => any | null;
}

const FeedDataContext = createContext<FeedDataContextValue | null>(null);

export function FeedDataProvider({ children }: { children: React.ReactNode }) {
  // In-memory cache for quick access (supplements SWR cache)
  const restaurantCache = useRef<Map<string, any>>(new Map());
  const profileCache = useRef<Map<string, any>>(new Map());

  const cacheRestaurantFromFeed = useCallback((review: FeedReview) => {
    const restaurantId = review.restaurant.googlePlaceId || review.restaurant.id;
    
    // Build minimal restaurant data from feed review
    const restaurantData = {
      restaurant: {
        id: review.restaurant.id,
        name: review.restaurant.name,
        address: review.restaurant.address,
        city: review.restaurant.city,
        imageUrl: review.restaurant.imageUrl,
        googlePlaceId: review.restaurant.googlePlaceId,
        averageRating: review.rating, // Use review rating as approximation
        isOpen: review.restaurant.isOpen,
        matchPercentage: review.restaurant.matchPercentage,
      },
      // Include partial review data
      reviews: [{
        id: review.id,
        rating: review.rating,
        content: review.content,
        createdAt: review.createdAt,
        likesCount: review.likesCount,
        commentsCount: review.commentsCount,
        isLiked: review.isLiked,
        user: review.user,
        photos: review.media
          .filter(m => m.type === 'photo')
          .map(m => m.url),
      }],
      isWishlisted: review.isSaved,
      friendsWhoReviewed: review.mutualFriends.map(f => ({
        id: f.id,
        fullName: f.name,
        avatarUrl: f.avatarUrl,
      })),
      _fromFeed: true, // Flag to indicate partial data
    };
    
    // Store in local cache
    restaurantCache.current.set(restaurantId, restaurantData);
    
    // Also populate SWR cache for instant rendering
    const cacheKey = cacheKeys.restaurant(restaurantId);
    mutate(cacheKey, restaurantData, { revalidate: false });
  }, []);

  const cacheProfileFromFeed = useCallback((review: FeedReview) => {
    const userId = review.user.id;
    
    // Build minimal profile data from feed review
    const profileData = {
      profile: {
        id: review.user.id,
        username: review.user.username,
        fullName: review.user.fullName,
        avatarUrl: review.user.avatarUrl,
      },
      stats: {
        reviewsCount: 1, // We know at least 1
        followersCount: 0,
        followingCount: 0,
        averageRating: review.rating,
      },
      reviews: [{
        id: review.id,
        rating: review.rating,
        content: review.content,
        createdAt: review.createdAt,
        likesCount: review.likesCount,
        commentsCount: review.commentsCount,
        photos: review.media
          .filter(m => m.type === 'photo')
          .map(m => m.url),
        restaurant: {
          id: review.restaurant.id,
          name: review.restaurant.name,
          address: review.restaurant.address,
          imageUrl: review.restaurant.imageUrl,
          googlePlaceId: review.restaurant.googlePlaceId,
        },
      }],
      isFollowing: false, // Unknown from feed
      isOwnProfile: false,
      mutualFriends: [],
      _fromFeed: true, // Flag to indicate partial data
    };
    
    // Store in local cache
    profileCache.current.set(userId, profileData);
    
    // Also populate SWR cache for instant rendering
    const cacheKey = cacheKeys.profile(userId);
    mutate(cacheKey, profileData, { revalidate: false });
  }, []);

  const getCachedRestaurant = useCallback((restaurantId: string) => {
    return restaurantCache.current.get(restaurantId) || null;
  }, []);

  const getCachedProfile = useCallback((userId: string) => {
    return profileCache.current.get(userId) || null;
  }, []);

  return (
    <FeedDataContext.Provider value={{
      cacheRestaurantFromFeed,
      cacheProfileFromFeed,
      getCachedRestaurant,
      getCachedProfile,
    }}>
      {children}
    </FeedDataContext.Provider>
  );
}

export function useFeedData() {
  const context = useContext(FeedDataContext);
  if (!context) {
    throw new Error('useFeedData must be used within a FeedDataProvider');
  }
  return context;
}
