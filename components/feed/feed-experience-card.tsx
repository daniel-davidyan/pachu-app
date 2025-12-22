'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { PostCard, PostCardData } from '@/components/post/post-card';

interface Review {
  id: string;
  rating: number;
  content: string;
  createdAt: string;
  likesCount?: number;
  commentsCount?: number;
  isLiked?: boolean;
  user: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  photos: string[];
}

interface RestaurantFeed {
  id: string;
  name: string;
  address?: string;
  imageUrl?: string;
  rating: number;
  totalReviews: number;
  distance?: number;
  matchPercentage: number;
  reviews: Review[];
  googlePlaceId?: string;
  latitude: number;
  longitude: number;
}

interface FeedExperienceCardProps {
  restaurant: RestaurantFeed;
  userLocation: { latitude: number; longitude: number } | null;
  onUpdate?: () => void;
}

export function FeedExperienceCard({ restaurant, userLocation, onUpdate }: FeedExperienceCardProps) {
  // Show each review as an individual post
  if (!restaurant.reviews || restaurant.reviews.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {restaurant.reviews.map((review) => {
        const postData: PostCardData = {
          id: review.id,
          rating: review.rating,
          content: review.content,
          createdAt: review.createdAt,
          likesCount: review.likesCount || 0,
          commentsCount: review.commentsCount || 0,
          isLiked: review.isLiked || false,
          user: review.user,
          photos: review.photos,
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
            address: restaurant.address || '',
            imageUrl: restaurant.imageUrl,
            googlePlaceId: restaurant.googlePlaceId,
          },
        };

        return (
          <div key={review.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Restaurant Header - Clickable */}
            <Link 
              href={`/restaurant/${restaurant.googlePlaceId || restaurant.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
                {restaurant.imageUrl ? (
                  <img
                    src={restaurant.imageUrl}
                    alt={restaurant.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-sm">🍽️</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">
                  {restaurant.name}
                </p>
                {restaurant.address && (
                  <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {restaurant.address}
                  </p>
                )}
              </div>
            </Link>

            {/* Post Content - Inline rendering without PostCard wrapper */}
            <PostCard
              post={postData}
              showRestaurantInfo={false}
              onUpdate={onUpdate}
              embedded={true}
            />
          </div>
        );
      })}
    </div>
  );
}

