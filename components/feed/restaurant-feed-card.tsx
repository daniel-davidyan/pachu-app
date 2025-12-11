'use client';

import { useState, useRef } from 'react';
import { Heart, PenLine, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { WriteReviewModal } from '@/components/review/write-review-modal';
import { CompactRating } from '@/components/ui/modern-rating';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface MutualFriend {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface Review {
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
  mutualFriends: MutualFriend[];
  reviews: Review[];
  googlePlaceId?: string;
  latitude: number;
  longitude: number;
}

interface RestaurantFeedCardProps {
  restaurant: RestaurantFeed;
  userLocation: { latitude: number; longitude: number } | null;
}

export function RestaurantFeedCard({ restaurant, userLocation }: RestaurantFeedCardProps) {
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Calculate distance using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Check if a user ID is a valid UUID (real user vs Google review author)
  const isRealUser = (userId: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(userId);
  };

  const handleWishlist = async () => {
    setIsWishlisted(!isWishlisted);
    // TODO: Call API to add/remove from wishlist
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    
    const scrollAmount = carouselRef.current.clientWidth * 0.8;
    const newScrollLeft = carouselRef.current.scrollLeft + (direction === 'right' ? scrollAmount : -scrollAmount);
    
    carouselRef.current.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    });
  };

  const getMutualFriendsText = () => {
    const count = restaurant.mutualFriends.length;
    if (count === 0) return null;
    
    if (count === 1) {
      return `${restaurant.mutualFriends[0].name} liked it`;
    } else if (count === 2) {
      return `${restaurant.mutualFriends[0].name} and ${restaurant.mutualFriends[1].name} liked it`;
    } else {
      const others = count - 2;
      return `${restaurant.mutualFriends[0].name}, ${restaurant.mutualFriends[1].name} and ${others} more mutual friend${others > 1 ? 's' : ''} liked it`;
    }
  };

  // Calculate distance from user to restaurant
  const distance = userLocation 
    ? calculateDistance(
        userLocation.latitude, 
        userLocation.longitude, 
        restaurant.latitude, 
        restaurant.longitude
      )
    : restaurant.distance; // Fallback to provided distance if no user location

  const distanceText = distance 
    ? distance < 1000 
      ? `${Math.round(distance)}m from you`
      : `${(distance / 1000).toFixed(1)}km from you`
    : null;

  return (
    <>
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Restaurant Header with Image - SMALL VERSION */}
        <div className="relative">
          <div className="relative h-32 bg-gray-100">
            {restaurant.imageUrl ? (
              <img 
                src={restaurant.imageUrl} 
                alt={restaurant.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                <span className="text-6xl">🍽️</span>
              </div>
            )}
            
            {/* Match Percentage Badge - Top Right */}
            <div className="absolute top-3 right-3 z-10">
              <div className="bg-white/95 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-gradient-to-r from-green-400 to-green-500 animate-pulse" />
                  <span className="text-sm font-bold text-gray-900">{restaurant.matchPercentage}%</span>
                  <span className="text-[10px] text-gray-500">match</span>
                </div>
              </div>
            </div>
            
            {/* Distance Badge - Bottom Right */}
            {distanceText && (
              <div className="absolute bottom-3 right-3 z-10">
                <div className="bg-primary/95 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                    <span className="text-xs font-bold text-white">{distanceText}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons - Overlaid on Image */}
            <div className="absolute top-3 left-3 flex gap-2">
              {/* Wishlist Button */}
              <button
                onClick={handleWishlist}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${
                  isWishlisted 
                    ? 'bg-red-50 backdrop-blur-sm' 
                    : 'bg-white/95 backdrop-blur-sm hover:bg-white'
                }`}
              >
                <Heart 
                  className={`w-5 h-5 transition-all ${
                    isWishlisted 
                      ? 'fill-red-500 text-red-500' 
                      : 'text-gray-600'
                  }`} 
                />
              </button>
              
              {/* Add Review Button */}
              <button
                onClick={() => setShowWriteReview(true)}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-white/95 backdrop-blur-sm hover:bg-white transition-all shadow-lg active:scale-95"
              >
                <PenLine className="w-5 h-5 text-gray-600" strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Match Percentage Bar - Shows how well this restaurant matches your taste */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
            <div 
              className="h-full bg-gradient-to-r from-green-400 via-green-500 to-green-600 transition-all duration-1000"
              style={{ width: `${restaurant.matchPercentage}%` }}
            />
          </div>
        </div>

        {/* Restaurant Info */}
        <div className="p-4">
          <Link href={`/restaurant/${restaurant.id}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg text-gray-900 truncate hover:text-primary transition-colors">{restaurant.name}</h3>
                {restaurant.address && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <p className="text-xs text-gray-500 truncate">{restaurant.address}</p>
                  </div>
                )}
              </div>
            </div>
          </Link>

          {/* Mutual Friends */}
          {getMutualFriendsText() && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex -space-x-2">
                {restaurant.mutualFriends.slice(0, 3).map((friend, index) => (
                  <Link key={friend.id} href={`/profile/${friend.id}`}>
                    {friend.avatarUrl ? (
                      <img
                        src={friend.avatarUrl}
                        alt={friend.name}
                        className="w-6 h-6 rounded-full border-2 border-white object-cover cursor-pointer hover:scale-110 transition-transform"
                      />
                    ) : (
                      <div
                        className="w-6 h-6 rounded-full border-2 border-white bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                      >
                        <span className="text-[10px] font-bold text-white">
                          {friend.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
              <p className="text-xs text-gray-600 flex-1">
                {getMutualFriendsText()}
              </p>
            </div>
          )}

          {/* Reviews */}
          {restaurant.reviews.length > 0 && (
            <div>
              <div
                ref={carouselRef}
                className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
              >
                {restaurant.reviews.map((review) => {
                  const timeAgo = formatDistanceToNow(new Date(review.createdAt), { addSuffix: true });
                  const userIsReal = isRealUser(review.user.id);
                  const reviewIsReal = isRealUser(review.id);
                  
                  return (
                    <div
                      key={review.id}
                      className="flex-shrink-0 w-[85%] bg-gray-50 rounded-2xl p-3 snap-start"
                    >
                      {/* Reviewer Info */}
                      {userIsReal ? (
                        <Link href={`/profile/${review.user.id}`}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {review.user.avatarUrl ? (
                                <img
                                  src={review.user.avatarUrl}
                                  alt={review.user.fullName}
                                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                  {review.user.fullName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-900 truncate hover:text-primary transition-colors">
                                  {review.user.fullName}
                                </p>
                                <span className="text-[10px] text-gray-400">{timeAgo}</span>
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              <CompactRating rating={review.rating} showEmoji={true} />
                            </div>
                          </div>
                        </Link>
                      ) : (
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {review.user.avatarUrl ? (
                              <img
                                src={review.user.avatarUrl}
                                alt={review.user.fullName}
                                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                {review.user.fullName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-900 truncate">
                                {review.user.fullName}
                              </p>
                              <span className="text-[10px] text-gray-400">{timeAgo}</span>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <CompactRating rating={review.rating} showEmoji={true} />
                          </div>
                        </div>
                      )}

                      {/* Review Photos - BIGGER */}
                      {review.photos && review.photos.length > 0 && (
                        reviewIsReal ? (
                          <Link href={`/review/${review.id}`}>
                            <div className="mb-2 -mx-3 mt-3 cursor-pointer">
                              <img
                                src={review.photos[0]}
                                alt="Review photo"
                                className="w-full h-48 object-cover hover:opacity-95 transition-opacity"
                              />
                            </div>
                          </Link>
                        ) : (
                          <div className="mb-2 -mx-3 mt-3">
                            <img
                              src={review.photos[0]}
                              alt="Review photo"
                              className="w-full h-48 object-cover"
                            />
                          </div>
                        )
                      )}

                      {/* Review Content */}
                      {review.content && (
                        reviewIsReal ? (
                          <Link href={`/review/${review.id}`}>
                            <p className="text-xs text-gray-600 leading-relaxed line-clamp-3 hover:text-gray-900 transition-colors cursor-pointer">
                              {review.content}
                            </p>
                          </Link>
                        ) : (
                          <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
                            {review.content}
                          </p>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Write Review Modal */}
      <WriteReviewModal
        isOpen={showWriteReview}
        onClose={() => setShowWriteReview(false)}
        restaurant={{
          googlePlaceId: restaurant.googlePlaceId || restaurant.id,
          name: restaurant.name,
          address: restaurant.address || '',
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
          photoUrl: restaurant.imageUrl,
        }}
        onSuccess={() => {
          setShowWriteReview(false);
        }}
      />
    </>
  );
}

