'use client';

import { useState, useRef } from 'react';
import { Star, Heart, PenLine, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { WriteReviewModal } from '@/components/review/write-review-modal';
import { formatDistanceToNow } from 'date-fns';

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

  const distanceText = restaurant.distance 
    ? restaurant.distance < 1000 
      ? `${Math.round(restaurant.distance)}m from you`
      : `${(restaurant.distance / 1000).toFixed(1)}km from you`
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
            
            {/* Match Percentage Badge */}
            <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-green-400 to-green-500 animate-pulse" />
                <span className="text-sm font-bold text-gray-900">{restaurant.matchPercentage}%</span>
                <span className="text-[10px] text-gray-500">match</span>
              </div>
            </div>

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
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg text-gray-900 truncate">{restaurant.name}</h3>
              {restaurant.address && (
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <p className="text-xs text-gray-500 truncate">{restaurant.address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Rating and Distance */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg">
              <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" />
              <span className="font-bold text-sm text-yellow-700">{restaurant.rating.toFixed(1)}</span>
              <span className="text-xs text-gray-500">({restaurant.totalReviews})</span>
            </div>
            {distanceText && (
              <span className="text-xs text-gray-500">{distanceText}</span>
            )}
          </div>

          {/* Mutual Friends */}
          {getMutualFriendsText() && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex -space-x-2">
                {restaurant.mutualFriends.slice(0, 3).map((friend, index) => (
                  friend.avatarUrl ? (
                    <img
                      key={friend.id}
                      src={friend.avatarUrl}
                      alt={friend.name}
                      className="w-6 h-6 rounded-full border-2 border-white object-cover"
                    />
                  ) : (
                    <div
                      key={friend.id}
                      className="w-6 h-6 rounded-full border-2 border-white bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center"
                    >
                      <span className="text-[10px] font-bold text-white">
                        {friend.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )
                ))}
              </div>
              <p className="text-xs text-gray-600 flex-1">
                {getMutualFriendsText()}
              </p>
            </div>
          )}

          {/* Reviews Carousel */}
          {restaurant.reviews.length > 0 && (
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Reviews ({restaurant.reviews.length})
                </h4>
                {restaurant.reviews.length > 1 && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => scrollCarousel('left')}
                      className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                    >
                      <ChevronLeft className="w-3 h-3 text-gray-600" />
                    </button>
                    <button
                      onClick={() => scrollCarousel('right')}
                      className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                    >
                      <ChevronRight className="w-3 h-3 text-gray-600" />
                    </button>
                  </div>
                )}
              </div>

              <div
                ref={carouselRef}
                className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
              >
                {restaurant.reviews.map((review) => {
                  const timeAgo = formatDistanceToNow(new Date(review.createdAt), { addSuffix: true });
                  
                  return (
                    <div
                      key={review.id}
                      className="flex-shrink-0 w-[85%] bg-gray-50 rounded-2xl p-3 snap-start"
                    >
                      {/* Reviewer Info */}
                      <div className="flex items-center gap-2 mb-2">
                        {review.user.avatarUrl ? (
                          <img
                            src={review.user.avatarUrl}
                            alt={review.user.fullName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                            {review.user.fullName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">
                            {review.user.fullName}
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-2.5 h-2.5 ${
                                    i < review.rating
                                      ? 'fill-yellow-400 text-yellow-400'
                                      : 'fill-gray-200 text-gray-200'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-[10px] text-gray-400">{timeAgo}</span>
                          </div>
                        </div>
                      </div>

                      {/* Review Photos - BIGGER */}
                      {review.photos && review.photos.length > 0 && (
                        <div className="mb-2 -mx-3 mt-3">
                          <img
                            src={review.photos[0]}
                            alt="Review photo"
                            className="w-full h-48 object-cover"
                          />
                        </div>
                      )}

                      {/* Review Content */}
                      {review.content && (
                        <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
                          {review.content}
                        </p>
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

