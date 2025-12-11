'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Heart, MessageCircle, Share2, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { CompactRating } from '@/components/ui/modern-rating';
import { formatDistanceToNow } from 'date-fns';

interface Review {
  id: string;
  rating: number;
  content: string;
  createdAt: string;
  likesCount: number;
  isLiked: boolean;
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
    imageUrl?: string;
    rating?: number;
  };
  photos: string[];
  source: 'own' | 'friend' | 'nearby';
}

interface FullScreenReviewViewerProps {
  reviews: Review[];
  initialIndex: number;
  onClose: () => void;
  onLike: (reviewId: string) => void;
  onComment: (reviewId: string) => void;
  onShare: (reviewId: string) => void;
}

export function FullScreenReviewViewer({
  reviews,
  initialIndex,
  onClose,
  onLike,
  onComment,
  onShare,
}: FullScreenReviewViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentReview = reviews[currentIndex];

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    // Right swipe = close viewer (return to feed)
    if (isRightSwipe) {
      onClose();
    }
    // Left swipe = next review
    else if (isLeftSwipe && currentIndex < reviews.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
    // Reset swipe
    else if (!isLeftSwipe && !isRightSwipe && currentIndex > 0) {
      // Small left swipe = previous review
      if (distance < -10) {
        setCurrentIndex(currentIndex - 1);
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < reviews.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, reviews.length, onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (!currentReview) return null;

  const displayImage = currentReview.photos[0] || currentReview.restaurant.imageUrl;
  const timeAgo = formatDistanceToNow(new Date(currentReview.createdAt), { addSuffix: true });

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-4 safe-area-top">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-3">
            {currentReview.user.avatarUrl ? (
              <img
                src={currentReview.user.avatarUrl}
                alt={currentReview.user.username}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
                {currentReview.user.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-white font-semibold text-sm">{currentReview.user.username}</p>
              <p className="text-white/70 text-xs">{timeAgo}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="h-full flex flex-col">
        {/* Image */}
        <div className="flex-1 relative">
          {displayImage && (
            <img
              src={displayImage}
              alt={currentReview.restaurant.name}
              className="w-full h-full object-cover"
            />
          )}
          
          {/* Navigation indicators */}
          <div className="absolute top-1/2 -translate-y-1/2 left-4 right-4 flex justify-between pointer-events-none">
            {currentIndex > 0 && (
              <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white pointer-events-auto cursor-pointer" onClick={() => setCurrentIndex(currentIndex - 1)}>
                <ChevronLeft className="w-6 h-6" />
              </div>
            )}
            <div className="flex-1" />
            {currentIndex < reviews.length - 1 && (
              <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white pointer-events-auto cursor-pointer" onClick={() => setCurrentIndex(currentIndex + 1)}>
                <ChevronRight className="w-6 h-6" />
              </div>
            )}
          </div>

          {/* Progress dots */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
            {reviews.map((_, index) => (
              <div
                key={index}
                className={`h-1 rounded-full transition-all ${
                  index === currentIndex
                    ? 'w-6 bg-white'
                    : 'w-1 bg-white/40'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Bottom Info */}
        <div className="bg-gradient-to-t from-black/90 via-black/80 to-transparent p-6 pb-8 safe-area-bottom">
          {/* Restaurant Info */}
          <div className="mb-4">
            <h2 className="text-white font-bold text-2xl mb-2">{currentReview.restaurant.name}</h2>
            <div className="flex items-center gap-3 text-white/80 text-sm">
              <CompactRating rating={currentReview.rating} showEmoji={true} />
              {currentReview.restaurant.address && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate max-w-[200px]">{currentReview.restaurant.address}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Review Text */}
          {currentReview.content && (
            <p className="text-white/90 text-sm leading-relaxed mb-4 line-clamp-3">
              {currentReview.content}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => onLike(currentReview.id)}
              className="flex items-center gap-2 text-white transition-transform active:scale-95"
            >
              <Heart
                className={`w-7 h-7 ${currentReview.isLiked ? 'fill-red-500 text-red-500' : ''}`}
              />
              <span className="text-sm font-medium">{currentReview.likesCount}</span>
            </button>
            
            <button
              onClick={() => onComment(currentReview.id)}
              className="flex items-center gap-2 text-white transition-transform active:scale-95"
            >
              <MessageCircle className="w-7 h-7" />
              <span className="text-sm font-medium">Comment</span>
            </button>
            
            <button
              onClick={() => onShare(currentReview.id)}
              className="flex items-center gap-2 text-white ml-auto transition-transform active:scale-95"
            >
              <Share2 className="w-7 h-7" />
            </button>
          </div>

          {/* Swipe hint */}
          <div className="mt-4 text-center">
            <p className="text-white/50 text-xs">
              Swipe right to return • Swipe left for next
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

