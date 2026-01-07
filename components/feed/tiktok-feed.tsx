'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TikTokReviewCard } from './tiktok-review-card';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Loader2, Heart, MessageCircle, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/components/ui/toast';
import Link from 'next/link';

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

interface TikTokFeedProps {
  reviews: FeedReview[];
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  onCommentsVisibilityChange?: (isOpen: boolean) => void;
}

export function TikTokFeed({ reviews, onLoadMore, hasMore, isLoading, onCommentsVisibilityChange }: TikTokFeedProps) {
  const router = useRouter();
  const { user } = useUser();
  const { showToast } = useToast();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);

  // Preload next reviews - increased threshold to 5
  useEffect(() => {
    if (currentIndex >= reviews.length - 5 && hasMore && !isLoading) {
      onLoadMore();
    }
  }, [currentIndex, reviews.length, hasMore, isLoading, onLoadMore]);

  // Handle vertical swipe - TikTok style smooth scrolling
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;
    
    // Apply resistance at edges
    let adjustedDelta = deltaY;
    if ((currentIndex === 0 && deltaY > 0) || 
        (currentIndex === reviews.length - 1 && deltaY < 0)) {
      adjustedDelta = deltaY * 0.3; // Reduced movement at edges
    }
    
    setDragOffset(adjustedDelta);
  }, [currentIndex, reviews.length]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }
    
    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchEndY - touchStartY.current;
    const timeDelta = Date.now() - touchStartTime.current;
    const velocity = Math.abs(deltaY) / timeDelta;
    
    // Threshold for changing slides - 20% of screen height or high velocity
    const containerHeight = containerRef.current?.clientHeight || window.innerHeight;
    const threshold = containerHeight * 0.2;
    const minVelocity = 0.5;

    // Swipe up = next review
    if ((deltaY < -threshold || (velocity > minVelocity && deltaY < -30)) && deltaY < 0) {
      if (currentIndex < reviews.length - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    }
    // Swipe down = previous review
    else if ((deltaY > threshold || (velocity > minVelocity && deltaY > 30)) && deltaY > 0) {
      if (currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    }

    setDragOffset(0);
    setIsDragging(false);
    touchStartY.current = null;
  }, [currentIndex, reviews.length]);

  // Handle swipe right to restaurant - instant navigation
  const handleSwipeRight = useCallback((review: FeedReview) => {
    router.push(`/restaurant/${review.restaurant.googlePlaceId || review.restaurant.id}`);
  }, [router]);

  // Handle swipe left to user profile - instant navigation
  const handleSwipeLeft = useCallback((review: FeedReview) => {
    if (user && review.user.id === user.id) {
      router.push('/profile');
    } else {
      router.push(`/profile/${review.user.id}`);
    }
  }, [router, user]);

  // Open comments
  const handleOpenComments = useCallback(async (reviewId: string) => {
    setActiveReviewId(reviewId);
    setShowComments(true);
    onCommentsVisibilityChange?.(true);
    setLoadingComments(true);
    
    try {
      const response = await fetch(`/api/reviews/${reviewId}/comments`);
      const data = await response.json();
      
      if (data.comments) {
        setComments(data.comments.map((comment: any) => ({
          id: comment.id,
          content: comment.content,
          createdAt: comment.createdAt,
          user: {
            id: comment.user.id,
            username: comment.user.username,
            fullName: comment.user.fullName,
            avatarUrl: comment.user.avatarUrl,
          },
          likesCount: comment.likesCount || 0,
          isLiked: comment.isLiked || false,
        })));
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      showToast('Failed to load comments', 'error');
    } finally {
      setLoadingComments(false);
    }
  }, [showToast, onCommentsVisibilityChange]);

  // Post comment
  const handlePostComment = useCallback(async () => {
    if (!user || !activeReviewId || !newComment.trim()) return;
    
    setPostingComment(true);
    
    try {
      const response = await fetch(`/api/reviews/${activeReviewId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setComments(prev => [...prev, {
          id: data.comment.id,
          content: data.comment.content,
          createdAt: data.comment.createdAt,
          user: {
            id: data.comment.user.id,
            username: data.comment.user.username,
            fullName: data.comment.user.fullName,
            avatarUrl: data.comment.user.avatarUrl,
          },
          likesCount: 0,
          isLiked: false,
        }]);
        setNewComment('');
      } else {
        showToast('Failed to post comment', 'error');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      showToast('Failed to post comment', 'error');
    } finally {
      setPostingComment(false);
    }
  }, [user, activeReviewId, newComment, showToast]);

  // Like comment
  const handleLikeComment = useCallback(async (commentId: string) => {
    if (!user || !activeReviewId) return;
    
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    const newLikedState = !comment.isLiked;
    
    // Optimistic update
    setComments(prev => prev.map(c => 
      c.id === commentId 
        ? { ...c, isLiked: newLikedState, likesCount: newLikedState ? c.likesCount + 1 : c.likesCount - 1 }
        : c
    ));

    try {
      await fetch(`/api/reviews/${activeReviewId}/comments/${commentId}/like`, {
        method: newLikedState ? 'POST' : 'DELETE',
      });
    } catch (error) {
      // Revert on error
      setComments(prev => prev.map(c => 
        c.id === commentId 
          ? { ...c, isLiked: !newLikedState, likesCount: comment.likesCount }
          : c
      ));
    }
  }, [user, activeReviewId, comments]);

  if (reviews.length === 0 && !isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="text-center text-white p-8 max-w-sm">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
            <span className="text-5xl">🍽️</span>
          </div>
          <h3 className="text-xl font-bold mb-2">No reviews with photos</h3>
          <p className="text-white/60 mb-6">
            This feed shows reviews with photos and videos. Share your food experience with photos to appear here!
          </p>
          <a
            href="/search"
            className="inline-block px-6 py-3 bg-primary text-white font-semibold rounded-full hover:bg-primary/90 transition-colors"
          >
            Find a place to review
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className="fixed inset-0 overflow-hidden bg-black"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Reviews Stack - Smooth TikTok-style scrolling */}
        <div 
          className="relative w-full"
          style={{
            height: `${reviews.length * 100}%`,
            transform: `translateY(calc(-${currentIndex * (100 / reviews.length)}% + ${dragOffset}px))`,
            transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          }}
        >
          {reviews.map((review, index) => (
            <div
              key={review.id}
              className="absolute w-full"
              style={{
                height: `${100 / reviews.length}%`,
                top: `${index * (100 / reviews.length)}%`,
              }}
            >
              <TikTokReviewCard
                review={review}
                isVisible={index === currentIndex || Math.abs(index - currentIndex) === 1}
                onSwipeRight={() => handleSwipeRight(review)}
                onSwipeLeft={() => handleSwipeLeft(review)}
                onOpenComments={() => handleOpenComments(review.id)}
              />
            </div>
          ))}
        </div>

        {/* Loading more indicator */}
        {isLoading && (
          <div className="absolute bottom-24 left-0 right-0 flex justify-center z-20">
            <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          </div>
        )}
      </div>

      {/* Comments Bottom Sheet */}
      <BottomSheet
        isOpen={showComments}
        onClose={() => {
          setShowComments(false);
          onCommentsVisibilityChange?.(false);
          setActiveReviewId(null);
          setComments([]);
        }}
        title="Comments"
      >
        <div className="flex flex-col h-full">
          {/* Comments List */}
          <div className="flex-1 overflow-y-auto space-y-4 pb-4">
            {loadingComments ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No comments yet</p>
                <p className="text-sm text-gray-400 mt-1">Be the first to comment!</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Link 
                    href={user && comment.user.id === user.id ? '/profile' : `/profile/${comment.user.id}`}
                    className="flex-shrink-0"
                  >
                    {comment.user.avatarUrl ? (
                      <img
                        src={comment.user.avatarUrl}
                        alt={comment.user.fullName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <span className="text-base font-bold text-white">
                          {comment.user.fullName?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <Link href={user && comment.user.id === user.id ? '/profile' : `/profile/${comment.user.id}`}>
                          <span className="font-semibold text-sm text-gray-900 hover:text-gray-600">
                            {comment.user.fullName || comment.user.username}
                          </span>
                        </Link>
                        <span className="text-sm text-gray-900 ml-2">
                          {comment.content}
                        </span>
                      </div>
                      <button
                        onClick={() => handleLikeComment(comment.id)}
                        className="transition-transform active:scale-90 p-1"
                      >
                        <Heart 
                          className={`w-4 h-4 ${comment.isLiked ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
                          strokeWidth={comment.isLiked ? 0 : 2}
                        />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                      </span>
                      {comment.likesCount > 0 && (
                        <span className="text-xs text-gray-500">
                          {comment.likesCount} {comment.likesCount === 1 ? 'like' : 'likes'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Comment Input */}
          {user && (
            <div className="sticky bottom-0 bg-white pt-3 pb-safe border-t border-gray-200">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handlePostComment();
                    }
                  }}
                  className="flex-1 text-sm border-0 focus:outline-none focus:ring-0 placeholder-gray-400"
                />
                <button
                  onClick={handlePostComment}
                  disabled={!newComment.trim() || postingComment}
                  className="text-primary font-semibold text-sm disabled:opacity-40 transition-opacity"
                >
                  {postingComment ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
