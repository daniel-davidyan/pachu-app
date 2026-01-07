'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, MessageCircle, Bookmark, Share2, MapPin } from 'lucide-react';
import { MediaCarousel } from './media-carousel';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/components/ui/toast';

interface MediaItem {
  id: string;
  type: 'photo' | 'video';
  url: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
}

interface MutualFriend {
  id: string;
  name: string;
  avatarUrl?: string;
}

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
  };
  media: MediaItem[];
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isSaved: boolean;
  mutualFriends: MutualFriend[];
}

interface TikTokReviewCardProps {
  review: FeedReview;
  isVisible: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onOpenComments?: () => void;
  onUpdate?: () => void;
}

export function TikTokReviewCard({
  review,
  isVisible,
  onSwipeLeft,
  onSwipeRight,
  onOpenComments,
  onUpdate,
}: TikTokReviewCardProps) {
  const router = useRouter();
  const { user } = useUser();
  const { showToast } = useToast();
  
  const [isLiked, setIsLiked] = useState(review.isLiked);
  const [likesCount, setLikesCount] = useState(review.likesCount);
  const [isSaved, setIsSaved] = useState(review.isSaved);
  const [isExpanded, setIsExpanded] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  // Prefetch pages when card becomes visible for faster navigation
  useEffect(() => {
    if (isVisible) {
      // Prefetch restaurant page
      const restaurantUrl = `/restaurant/${review.restaurant.googlePlaceId || review.restaurant.id}`;
      router.prefetch(restaurantUrl);
      
      // Prefetch user profile page
      const userUrl = user && review.user.id === user.id ? '/profile' : `/profile/${review.user.id}`;
      router.prefetch(userUrl);
    }
  }, [isVisible, review.restaurant.googlePlaceId, review.restaurant.id, review.user.id, user, router]);

  // Handle horizontal swipe for navigation
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    });
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart) return;

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    };

    const deltaX = touchEnd.x - touchStart.x;
    const deltaY = touchEnd.y - touchStart.y;
    const minSwipeDistance = 80;

    // Only handle horizontal swipes (ignore if vertical movement is greater)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
      if (deltaX > 0 && onSwipeRight) {
        // Swipe right -> Restaurant page
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        // Swipe left -> User profile
        onSwipeLeft();
      }
    }

    setTouchStart(null);
  }, [touchStart, onSwipeLeft, onSwipeRight]);

  const handleLike = useCallback(async () => {
    if (!user) {
      showToast('Please log in to like posts', 'error');
      return;
    }

    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikesCount(prev => newLikedState ? prev + 1 : prev - 1);

    try {
      const response = await fetch(`/api/reviews/${review.id}/like`, {
        method: newLikedState ? 'POST' : 'DELETE',
      });

      if (!response.ok) {
        setIsLiked(!newLikedState);
        setLikesCount(prev => newLikedState ? prev - 1 : prev + 1);
        showToast('Failed to update like', 'error');
      }
    } catch (error) {
      setIsLiked(!newLikedState);
      setLikesCount(prev => newLikedState ? prev - 1 : prev + 1);
      showToast('Failed to update like', 'error');
    }
  }, [user, isLiked, review.id, showToast]);

  const handleSave = useCallback(async () => {
    if (!user) {
      showToast('Please log in to save restaurants', 'error');
      return;
    }

    const newSavedState = !isSaved;
    setIsSaved(newSavedState);

    try {
      const response = await fetch('/api/wishlist', {
        method: newSavedState ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: review.restaurant.id }),
      });

      if (!response.ok) {
        setIsSaved(!newSavedState);
        showToast('Failed to save', 'error');
      } else {
        showToast(newSavedState ? 'Saved' : 'Removed', 'success');
      }
    } catch (error) {
      setIsSaved(!newSavedState);
      showToast('Failed to save', 'error');
    }
  }, [user, isSaved, review.restaurant.id, showToast]);

  const handleShare = useCallback(async () => {
    const shareUrl = `${window.location.origin}/restaurant/${review.restaurant.googlePlaceId || review.restaurant.id}`;
    const shareText = `Check out ${review.restaurant.name} on Pachu!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: review.restaurant.name,
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled or share failed
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      showToast('Link copied to clipboard', 'success');
    }
  }, [review.restaurant, showToast]);

  const formatDistance = (distance?: number) => {
    if (!distance) return '';
    if (distance < 1) return `${Math.round(distance * 1000)} m`;
    return `${distance.toFixed(1)} mi`;
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength).trim();
  };

  const needsExpansion = review.content && review.content.length > 100;

  return (
    <div 
      className="relative w-full h-full bg-black overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Media Carousel (Full Screen - covers entire viewport) */}
      <MediaCarousel
        media={review.media}
        isVisible={isVisible}
        className="absolute inset-0 w-full h-full"
      />

      {/* Gradient Overlays - subtle like TikTok */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-96 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

      {/* Bottom Left Info - positioned above the bottom navigation */}
      <div 
        className="absolute left-4 right-20 z-10"
        style={{ bottom: 'calc(75px + env(safe-area-inset-bottom))' }}
      >
        {/* Status Badges */}
        <div className="flex items-center gap-2 mb-2">
          {review.restaurant.isOpen && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-500/90 rounded-full text-xs font-semibold text-white">
              <span className="w-1.5 h-1.5 bg-white rounded-full" />
              Open Now
            </span>
          )}
          <span className="inline-flex items-center px-2.5 py-1 bg-primary/90 rounded-full text-xs font-semibold text-white">
            {review.restaurant.matchPercentage}% Match
          </span>
        </div>

        {/* Restaurant Name - Clickable */}
        <Link
          href={`/restaurant/${review.restaurant.googlePlaceId || review.restaurant.id}`}
          className="block"
        >
          <h2 className="text-2xl font-bold text-white mb-1 drop-shadow-lg">
            {review.restaurant.name}
          </h2>
        </Link>

        {/* Address & Distance */}
        <div className="flex items-center gap-1.5 text-white/80 text-sm mb-2">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">
            {review.restaurant.city || review.restaurant.address}
            {review.restaurant.distance && ` • ${formatDistance(review.restaurant.distance)}`}
          </span>
        </div>

        {/* Review Content */}
        {review.content && (
          <div className="mb-3">
            {isExpanded ? (
              <div 
                className="text-white/90 text-sm leading-relaxed max-h-48 overflow-y-auto pr-2"
                onClick={() => setIsExpanded(false)}
              >
                {review.content}
              </div>
            ) : (
              <p className="text-white/90 text-sm leading-relaxed">
                {truncateContent(review.content)}
                {needsExpansion && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsExpanded(true);
                    }}
                    className="text-white font-semibold ml-1"
                  >
                    ...more
                  </button>
                )}
              </p>
            )}
          </div>
        )}

        {/* Mutual Friends */}
        {review.mutualFriends.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {review.mutualFriends.slice(0, 3).map((friend, index) => (
                <div
                  key={friend.id}
                  className="w-7 h-7 rounded-full border-2 border-black overflow-hidden"
                  style={{ zIndex: 3 - index }}
                >
                  {friend.avatarUrl ? (
                    <img
                      src={friend.avatarUrl}
                      alt={friend.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {friend.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <span className="text-white/70 text-xs">
              and {review.mutualFriends.length > 1 ? `${review.mutualFriends.length - 1} others` : ''} liked this place
            </span>
          </div>
        )}
      </div>

      {/* Right Action Bar - positioned above the bottom navigation */}
      <div 
        className="absolute right-3 flex flex-col items-center gap-5 z-10"
        style={{ bottom: 'calc(75px + env(safe-area-inset-bottom))' }}
      >
        {/* User Avatar with Rating */}
        <div className="flex flex-col items-center gap-1">
          <Link
            href={user && review.user.id === user.id ? '/profile' : `/profile/${review.user.id}`}
            className="relative w-12 h-12 flex items-center justify-center"
          >
            {/* Rating Ring - SVG circle based on rating 1-5 */}
            <svg className="absolute inset-0 w-12 h-12" viewBox="0 0 48 48">
              {/* Background ring */}
              <circle
                cx="24"
                cy="24"
                r="22"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="3"
              />
              {/* Rating ring - fills based on rating (1-5) */}
              <circle
                cx="24"
                cy="24"
                r="22"
                fill="none"
                stroke="url(#ratingGradient)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(review.rating / 5) * 138.2} 138.2`}
                transform="rotate(-90 24 24)"
              />
              <defs>
                <linearGradient id="ratingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#C5459C" />
                  <stop offset="100%" stopColor="#E91E63" />
                </linearGradient>
              </defs>
            </svg>
            
            <div className="w-9 h-9 rounded-full overflow-hidden shadow-lg">
              {review.user.avatarUrl ? (
                <img
                  src={review.user.avatarUrl}
                  alt={review.user.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">
                    {(review.user.fullName || review.user.username).charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </Link>
          
          {/* Rating number below avatar */}
          <span className="text-white text-xs font-bold drop-shadow-lg">{review.rating.toFixed(1)}</span>
          
          {/* Username */}
          <span className="text-white/80 text-[10px] font-medium drop-shadow max-w-[48px] truncate text-center">
            {review.user.fullName?.split(' ')[0] || review.user.username}
          </span>
        </div>

        {/* Like Button */}
        <button
          onClick={handleLike}
          className="flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <Heart
            className={`w-8 h-8 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`}
            strokeWidth={isLiked ? 0 : 2}
          />
          <span className="text-white text-xs font-semibold">{formatCount(likesCount)}</span>
        </button>

        {/* Comments Button */}
        <button
          onClick={onOpenComments}
          className="flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <MessageCircle className="w-8 h-8 text-white" strokeWidth={2} />
          <span className="text-white text-xs font-semibold">{formatCount(review.commentsCount)}</span>
        </button>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className="flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <Bookmark
            className={`w-8 h-8 ${isSaved ? 'fill-white text-white' : 'text-white'}`}
            strokeWidth={2}
          />
          <span className="text-white text-xs font-semibold">Save</span>
        </button>

        {/* Share Button */}
        <button
          onClick={handleShare}
          className="flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <Share2 className="w-7 h-7 text-white" strokeWidth={2} />
          <span className="text-white text-xs font-semibold">Share</span>
        </button>
      </div>

    </div>
  );
}

// Helper function to format large numbers
function formatCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}
