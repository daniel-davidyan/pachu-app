'use client';

import { useState, useRef, useCallback, useEffect, useLayoutEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { TikTokReviewCard } from './tiktok-review-card';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Loader2, Heart, MessageCircle, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/components/ui/toast';
import Link from 'next/link';

// Client-side mount detection (same pattern as BottomSheet)
const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

// Session storage key for feed position
const FEED_POSITION_KEY = 'pachu_feed_position';

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
  isInitialLoading?: boolean; // True when fetching initial data
  hasLoadedOnce?: boolean; // True after first successful load
  onCommentsVisibilityChange?: (isOpen: boolean) => void;
}

export function TikTokFeed({ reviews, onLoadMore, hasMore, isLoading, isInitialLoading = false, hasLoadedOnce = false, onCommentsVisibilityChange }: TikTokFeedProps) {
  const router = useRouter();
  const { user } = useUser();
  const { showToast } = useToast();
  
  // BULLETPROOF: Use state with delayed confirmation to prevent ANY flicker
  // Empty state only shows after we've been in "confirmed empty" state for 500ms
  const [canShowEmptyState, setCanShowEmptyState] = useState(false);
  const emptyConfirmTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track previous reviews array to detect tab switches
  const prevReviewsRef = useRef<FeedReview[]>(reviews);
  
  // Effect to handle empty state confirmation with delay
  useEffect(() => {
    // Clear any existing timer
    if (emptyConfirmTimerRef.current) {
      clearTimeout(emptyConfirmTimerRef.current);
      emptyConfirmTimerRef.current = null;
    }
    
    // If we have reviews, reset empty state
    if (reviews.length > 0) {
      setCanShowEmptyState(false);
      return;
    }
    
    // If conditions suggest empty AND loading is done, wait 500ms then confirm
    if (hasLoadedOnce && !isLoading && !isInitialLoading && reviews.length === 0) {
      emptyConfirmTimerRef.current = setTimeout(() => {
        setCanShowEmptyState(true);
      }, 500);
    }
    
    return () => {
      if (emptyConfirmTimerRef.current) {
        clearTimeout(emptyConfirmTimerRef.current);
      }
    };
  }, [reviews.length, hasLoadedOnce, isLoading, isInitialLoading]);
  
  // Reset position when reviews array changes (tab switch)
  useEffect(() => {
    // Detect if this is a completely different reviews array (tab switch)
    // by checking if the first review ID is different
    const prevFirstId = prevReviewsRef.current[0]?.id;
    const newFirstId = reviews[0]?.id;
    
    if (prevFirstId !== newFirstId && reviews.length > 0) {
      // Reset to first item on tab switch
      setCurrentIndex(0);
      setCanShowEmptyState(false);
    }
    
    prevReviewsRef.current = reviews;
  }, [reviews]);
  
  // Restore position from sessionStorage on mount
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(FEED_POSITION_KEY);
      if (saved) {
        try {
          const { index, timestamp } = JSON.parse(saved);
          // Only restore if saved within last 10 minutes
          if (Date.now() - timestamp < 10 * 60 * 1000) {
            return Math.min(index, Math.max(0, reviews.length - 1));
          }
        } catch {}
      }
    }
    return 0;
  });
  
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);
  
  // Mention state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [availableFriends, setAvailableFriends] = useState<Array<{ id: string; username: string; fullName: string; avatarUrl?: string }>>([]);
  const [mentionedUsers, setMentionedUsers] = useState<Array<{ id: string; username: string }>>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ bottom: 0, left: 0, width: 0 });
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const commentsListRef = useRef<HTMLDivElement>(null);
  const isMounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);
  const prevReviewsLengthRef = useRef(reviews.length);

  // Save position to sessionStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && reviews.length > 0) {
      sessionStorage.setItem(FEED_POSITION_KEY, JSON.stringify({
        index: currentIndex,
        timestamp: Date.now(),
      }));
    }
  }, [currentIndex, reviews.length]);

  // Get viewport height for fixed pixel positioning (prevents jump on content load)
  useLayoutEffect(() => {
    const updateHeight = () => setViewportHeight(window.innerHeight);
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Handle reviews array growing - keep position stable
  useEffect(() => {
    // If reviews were added (not replaced), don't change position
    if (reviews.length > prevReviewsLengthRef.current && currentIndex <= prevReviewsLengthRef.current) {
      // Position stays the same, just update the ref
    }
    prevReviewsLengthRef.current = reviews.length;
  }, [reviews.length, currentIndex]);

  // Preload next reviews - increased threshold to 5
  useEffect(() => {
    if (currentIndex >= reviews.length - 5 && hasMore && !isLoading) {
      onLoadMore();
    }
  }, [currentIndex, reviews.length, hasMore, isLoading, onLoadMore]);

  // Handle vertical swipe - TikTok style smooth scrolling
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't intercept touch events on input elements - this blocks keyboard on iOS PWA
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('input, textarea')) {
      return;
    }
    
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    
    // Don't intercept touch events on input elements
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('input, textarea')) {
      return;
    }
    
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

  // Calculate dropdown position when it shows
  useEffect(() => {
    if (showMentionDropdown && inputContainerRef.current) {
      const rect = inputContainerRef.current.getBoundingClientRect();
      setDropdownPosition({
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [showMentionDropdown]);

  // Fetch friends for mention
  const fetchFriends = useCallback(async (searchQuery: string = '') => {
    if (!user) return;
    
    setLoadingFriends(true);
    try {
      const response = await fetch(`/api/friends/search?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableFriends(data.friends || []);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoadingFriends(false);
    }
  }, [user]);

  // Handle mention input
  const handleMentionInput = useCallback((value: string) => {
    setNewComment(value);
    
    // Detect @ symbol
    const cursorPosition = value.length;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1 && (atIndex === 0 || textBeforeCursor[atIndex - 1] === ' ')) {
      const searchText = textBeforeCursor.substring(atIndex + 1);
      // Only show dropdown if no space after @
      if (!searchText.includes(' ')) {
        setShowMentionDropdown(true);
        setMentionSearch(searchText);
        fetchFriends(searchText);
        return;
      }
    }
    
    setShowMentionDropdown(false);
    setMentionSearch('');
  }, [fetchFriends]);

  // Handle mention selection
  const handleSelectMention = useCallback((friend: { id: string; username: string; fullName: string }) => {
    const atIndex = newComment.lastIndexOf('@');
    if (atIndex !== -1) {
      const beforeAt = newComment.substring(0, atIndex);
      const newValue = `${beforeAt}@${friend.username} `;
      setNewComment(newValue);
      
      // Add to mentioned users if not already there
      if (!mentionedUsers.find(m => m.id === friend.id)) {
        setMentionedUsers(prev => [...prev, { id: friend.id, username: friend.username }]);
      }
    }
    setShowMentionDropdown(false);
    setMentionSearch('');
  }, [newComment, mentionedUsers]);

  // Post comment
  const handlePostComment = useCallback(async () => {
    if (!user || !activeReviewId || !newComment.trim()) return;
    
    setPostingComment(true);
    
    try {
      const response = await fetch(`/api/reviews/${activeReviewId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: newComment.trim(),
          mentionedUserIds: mentionedUsers.map(u => u.id),
        }),
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
          mentions: data.comment.mentions || [],
        }]);
        setNewComment('');
        setMentionedUsers([]);
        
        // Scroll to bottom to show the new comment
        setTimeout(() => {
          commentsListRef.current?.scrollTo({
            top: commentsListRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }, 100);
      } else {
        showToast('Failed to post comment', 'error');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      showToast('Failed to post comment', 'error');
    } finally {
      setPostingComment(false);
    }
  }, [user, activeReviewId, newComment, mentionedUsers, showToast]);

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
    } catch {
      // Revert on error
      setComments(prev => prev.map(c => 
        c.id === commentId 
          ? { ...c, isLiked: !newLikedState, likesCount: comment.likesCount }
          : c
      ));
    }
  }, [user, activeReviewId, comments]);

  // Render comment content with clickable mentions
  const renderCommentContent = (content: string, mentions: Array<{ id: string; username: string; fullName: string }> = []) => {
    if (!content) return null;
    
    const mentionMap = new Map(mentions.map(m => [m.username.toLowerCase(), m]));
    const parts = content.split(/(@[a-zA-Z0-9._]+)/g);

    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const username = part.slice(1);
        const mentionedUser = mentionMap.get(username.toLowerCase());
        if (mentionedUser) {
          return (
            <Link
              key={index}
              href={user && mentionedUser.id === user.id ? '/profile' : `/profile/${mentionedUser.id}`}
              className="text-blue-500 font-semibold hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              @{mentionedUser.username}
            </Link>
          );
        }
      }
      return <span key={index}>{part}</span>;
    });
  };

  // BULLETPROOF empty state logic - only show after delayed confirmation
  // This guarantees loader shows first, then empty state only after 500ms of confirmed empty
  if (reviews.length === 0) {
    // Only show empty state if the delayed confirmation has completed
    if (canShowEmptyState) {
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
    
    // DEFAULT: Always show loader when no reviews
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full border-2 border-white/20 border-t-white animate-spin"></div>
          <p className="text-white/50 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Only render reviews within a window around current index for performance
  // Increased from 3 to 5 for smoother scrolling and better preloading
  const renderWindow = 5; // Render current + 5 before/after
  const startIndex = Math.max(0, currentIndex - renderWindow);
  const endIndex = Math.min(reviews.length - 1, currentIndex + renderWindow);

  // Show loader only when user is at the last loaded review and we're actively loading more
  const showLoadingIndicator = isLoading && hasMore && currentIndex >= reviews.length - 2;

  return (
    <>
      <div
        ref={containerRef}
        className="fixed inset-0 overflow-hidden bg-black"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Reviews Stack - Fixed pixel positioning for stability */}
        <div 
          className="relative w-full"
          style={{
            // Use fixed pixel height instead of percentage to prevent jump on load
            height: `${reviews.length * viewportHeight}px`,
            transform: `translateY(${-currentIndex * viewportHeight + dragOffset}px)`,
            transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          }}
        >
          {reviews.map((review, index) => {
            // Only render reviews within the visible window
            if (index < startIndex || index > endIndex) {
              return (
                <div
                  key={review.id}
                  className="absolute w-full"
                  style={{
                    height: `${viewportHeight}px`,
                    top: `${index * viewportHeight}px`,
                  }}
                />
              );
            }
            
            return (
              <div
                key={review.id}
                className="absolute w-full"
                style={{
                  height: `${viewportHeight}px`,
                  top: `${index * viewportHeight}px`,
                }}
              >
                <TikTokReviewCard
                  review={review}
                  isVisible={index === currentIndex}
                  isPreloading={Math.abs(index - currentIndex) <= 3} // Preload 3 cards ahead/behind
                  onSwipeRight={() => handleSwipeRight(review)}
                  onSwipeLeft={() => handleSwipeLeft(review)}
                  onOpenComments={() => handleOpenComments(review.id)}
                />
              </div>
            );
          })}
        </div>

        {/* Loading more indicator - only show when at end and loading */}
        {showLoadingIndicator && (
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
        skipBodyLock={true}
      >
        <div className="flex flex-col h-full">
          {/* Comments List */}
          <div ref={commentsListRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
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
                          {renderCommentContent(comment.content, comment.mentions || [])}
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
            <div ref={inputContainerRef} className="sticky bottom-0 bg-white pt-3 pb-safe border-t border-gray-200">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="text"
                  enterKeyHint="send"
                  autoComplete="off"
                  autoCorrect="on"
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => handleMentionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !showMentionDropdown) {
                      e.preventDefault();
                      handlePostComment();
                    }
                    if (showMentionDropdown && e.key === 'Escape') {
                      e.preventDefault();
                      setShowMentionDropdown(false);
                    }
                  }}
                  className="flex-1 text-sm border-0 focus:outline-none focus:ring-0 placeholder-gray-400"
                  style={{ fontSize: '16px' }}
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

          {/* Mention Dropdown Portal */}
          {showMentionDropdown && isMounted && createPortal(
            <div 
              className="fixed bg-white border border-gray-200 rounded-2xl shadow-xl max-h-56 overflow-y-auto"
              style={{
                bottom: dropdownPosition.bottom,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
                zIndex: 99999,
              }}
            >
              {loadingFriends ? (
                <div className="px-4 py-6 text-center">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Loading...</p>
                </div>
              ) : availableFriends.length > 0 ? (
                <>
                  <div className="px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                    <p className="text-xs font-medium text-gray-500">People you follow</p>
                    <button 
                      onClick={() => setShowMentionDropdown(false)}
                      className="p-1 hover:bg-gray-100 rounded-full"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  {availableFriends.map((friend) => (
                    <button
                      key={friend.id}
                      onClick={() => handleSelectMention(friend)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors"
                    >
                      {friend.avatarUrl ? (
                        <img
                          src={friend.avatarUrl}
                          alt={friend.fullName}
                          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-white">
                            {friend.fullName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900">{friend.fullName}</p>
                        <p className="text-xs text-gray-500">@{friend.username}</p>
                      </div>
                    </button>
                  ))}
                </>
              ) : mentionSearch ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-gray-500">No matches for &quot;{mentionSearch}&quot;</p>
                  <p className="text-xs text-gray-400 mt-1">You can only tag people you follow</p>
                </div>
              ) : (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-gray-500">You don&apos;t follow anyone yet</p>
                  <p className="text-xs text-gray-400 mt-1">Follow users to tag them</p>
                </div>
              )}
            </div>,
            document.body
          )}
        </div>
      </BottomSheet>
    </>
  );
}
