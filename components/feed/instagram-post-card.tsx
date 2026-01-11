'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, Bookmark, MapPin } from 'lucide-react';
import { CompactRating } from '@/components/ui/modern-rating';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { formatDistanceToNow } from 'date-fns';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/components/ui/toast';
import { formatAddress } from '@/lib/address-utils';
import { CollectionPicker } from '@/components/collections/collection-picker';
import { CollectionModal } from '@/components/collections/collection-modal';
import { VideoPlayer } from '@/components/feed/video-player';

export interface InstagramPostData {
  id: string;
  rating: number;
  title?: string;
  content: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  user: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  photos: string[];
  videos?: Array<{ url: string; thumbnailUrl?: string }>;
  // Combined media array with correct sort order (preferred over separate photos/videos)
  media?: Array<{ type: 'photo' | 'video'; url: string; thumbnailUrl?: string; sortOrder?: number }>;
  restaurant?: {
    id: string;
    name: string;
    address: string;
    imageUrl?: string;
    googlePlaceId?: string;
  };
}

interface InstagramPostCardProps {
  post: InstagramPostData;
  onSheetStateChange?: (isOpen: boolean) => void;
  onUpdate?: () => void;
  isVisible?: boolean;
  isHighlighted?: boolean;
}

export function InstagramPostCard({ 
  post, 
  onSheetStateChange, 
  onUpdate, 
  isVisible = false,
  isHighlighted = false
}: InstagramPostCardProps) {
  const { user } = useUser();
  const { showToast } = useToast();
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [expandedContent, setExpandedContent] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  
  // Save/Collection state
  const [isSaved, setIsSaved] = useState(false);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  
  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const shouldShowExpand = post.content.length > 100;

  // Use the combined media array if available (preserves correct sort order), otherwise fall back to legacy format
  const mediaItems: Array<{ type: 'photo' | 'video'; url: string; thumbnailUrl?: string }> = post.media && post.media.length > 0
    ? post.media.map(m => ({ type: m.type, url: m.url, thumbnailUrl: m.thumbnailUrl }))
    : [
        ...(post.videos || []).map(v => ({ type: 'video' as const, url: v.url, thumbnailUrl: v.thumbnailUrl })),
        ...(post.photos || []).map(p => ({ type: 'photo' as const, url: p })),
      ];

  // Notify parent when sheet state changes
  useEffect(() => {
    if (onSheetStateChange) {
      onSheetStateChange(showComments || showCollectionPicker);
    }
  }, [showComments, showCollectionPicker, onSheetStateChange]);

  // Check if restaurant is saved
  useEffect(() => {
    if (!post.restaurant?.googlePlaceId && !post.restaurant?.id) return;
    
    const checkSavedStatus = async () => {
      try {
        const response = await fetch('/api/wishlist');
        const data = await response.json();
        
        const restaurantGooglePlaceId = post.restaurant?.googlePlaceId;
        const restaurantId = post.restaurant?.id;
        
        const saved = data.wishlist?.some((item: any) => {
          const itemGooglePlaceId = item.restaurants?.google_place_id;
          const itemId = item.restaurants?.id;
          
          if (restaurantGooglePlaceId && itemGooglePlaceId) {
            return itemGooglePlaceId === restaurantGooglePlaceId;
          }
          if (restaurantId && itemId) {
            return itemId === restaurantId;
          }
          if (restaurantId && itemGooglePlaceId) {
            return itemGooglePlaceId === restaurantId;
          }
          return false;
        });
        
        setIsSaved(saved || false);
      } catch (error) {
        console.error('Error checking saved status:', error);
      }
    };
    
    checkSavedStatus();
  }, [post.restaurant]);

  // Handle horizontal scroll for media carousel
  const handleScroll = () => {
    if (mediaContainerRef.current && mediaItems.length > 1) {
      const scrollLeft = mediaContainerRef.current.scrollLeft;
      const itemWidth = mediaContainerRef.current.clientWidth;
      const newIndex = Math.round(scrollLeft / itemWidth);
      setCurrentMediaIndex(newIndex);
    }
  };

  const handleLike = async () => {
    if (!user) {
      showToast('Please log in to like posts', 'error');
      return;
    }

    const newLikedState = !isLiked;
    const newCount = newLikedState ? likesCount + 1 : likesCount - 1;

    setIsLiked(newLikedState);
    setLikesCount(newCount);

    try {
      const response = await fetch(`/api/reviews/${post.id}/like`, {
        method: newLikedState ? 'POST' : 'DELETE',
      });

      if (!response.ok) {
        setIsLiked(!newLikedState);
        setLikesCount(likesCount);
        showToast('Failed to update like', 'error');
      }
    } catch (error) {
      console.error('Error updating like:', error);
      setIsLiked(!newLikedState);
      setLikesCount(likesCount);
      showToast('Failed to update like', 'error');
    }
  };

  const loadComments = async () => {
    if (comments.length > 0) {
      setShowComments(!showComments);
      return;
    }

    setLoadingComments(true);
    try {
      const response = await fetch(`/api/reviews/${post.id}/comments`);
      const data = await response.json();
      
      if (data.comments) {
        setComments(data.comments);
        setShowComments(true);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      showToast('Failed to load comments', 'error');
    } finally {
      setLoadingComments(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (!user || !newComment.trim()) return;

    const commentText = newComment.trim();
    setNewComment('');

    try {
      const response = await fetch(`/api/reviews/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.comment) {
          setComments([...comments, data.comment]);
          if (onUpdate) onUpdate();
        }
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      showToast('Failed to post comment', 'error');
    }
  };

  const handleSave = async () => {
    if (!post.restaurant) {
      showToast('Cannot save - no restaurant info', 'error');
      return;
    }

    if (isSaved) {
      try {
        const wishlistResponse = await fetch('/api/wishlist');
        const wishlistData = await wishlistResponse.json();
        
        const restaurantGooglePlaceId = post.restaurant?.googlePlaceId;
        const restaurantId = post.restaurant?.id;
        
        const wishlistItem = wishlistData.wishlist?.find((item: any) => {
          const itemGooglePlaceId = item.restaurants?.google_place_id;
          const itemId = item.restaurants?.id;
          
          if (restaurantGooglePlaceId && itemGooglePlaceId) {
            return itemGooglePlaceId === restaurantGooglePlaceId;
          }
          if (restaurantId && itemId) {
            return itemId === restaurantId;
          }
          if (restaurantId && itemGooglePlaceId) {
            return itemGooglePlaceId === restaurantId;
          }
          return false;
        });

        if (wishlistItem) {
          const deleteId = wishlistItem.restaurant_id || wishlistItem.restaurants?.id;
          
          if (deleteId) {
            const response = await fetch(`/api/wishlist?restaurantId=${deleteId}`, {
              method: 'DELETE',
            });

            if (response.ok) {
              setIsSaved(false);
              showToast('Removed from saved', 'success');
            }
          }
        }
      } catch (error) {
        console.error('Error removing from saved:', error);
        showToast('Failed to remove', 'error');
      }
    } else {
      setShowComments(false);
      setTimeout(() => {
        setShowCollectionPicker(true);
      }, 50);
    }
  };

  const handleSavedToCollection = () => {
    setIsSaved(true);
  };

  const handleCreateNewCollection = () => {
    setShowCollectionModal(true);
  };

  const handleCollectionCreated = () => {
    setShowCollectionPicker(true);
  };

  // Double tap to like
  const lastTapRef = useRef<number>(0);
  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!isLiked) {
        handleLike();
      }
    }
    lastTapRef.current = now;
  };

  return (
    <div className={`bg-white ${isHighlighted ? 'animate-highlight-post' : ''}`}>
      {/* Restaurant Header - Instagram Style */}
      <div className="flex items-center px-3 py-2.5">
        {/* Restaurant Photo Circle */}
        <Link
          href={post.restaurant ? `/restaurant/${post.restaurant.googlePlaceId || post.restaurant.id}` : '#'}
          className="flex-shrink-0"
        >
          <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 p-[2px]">
            <div className="w-full h-full rounded-full overflow-hidden bg-white p-[1px]">
              {post.restaurant?.imageUrl ? (
                <img 
                  src={post.restaurant.imageUrl} 
                  alt={post.restaurant.name} 
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="text-sm">🍽️</span>
                </div>
              )}
            </div>
          </div>
        </Link>

        {/* Restaurant Info */}
        <Link
          href={post.restaurant ? `/restaurant/${post.restaurant.googlePlaceId || post.restaurant.id}` : '#'}
          className="flex-1 min-w-0 ml-3"
        >
          <p className="font-semibold text-[13px] text-gray-900 truncate leading-tight">
            {post.restaurant?.name || 'Restaurant'}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-gray-500">
            <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="truncate">{formatAddress(post.restaurant?.address || '')}</span>
            <span className="flex-shrink-0">•</span>
            <span className="flex-shrink-0">{formatDistanceToNow(new Date(post.createdAt), { addSuffix: false })}</span>
          </div>
        </Link>

        {/* Rating */}
        <div className="flex-shrink-0 ml-2">
          <CompactRating rating={post.rating} size={36} />
        </div>
      </div>

      {/* Media Section - Full Width */}
      <div 
        className="relative bg-black aspect-square"
        onClick={handleDoubleTap}
      >
        {mediaItems.length > 0 ? (
          <>
            <div 
              ref={mediaContainerRef}
              className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide h-full"
              onScroll={handleScroll}
            >
              {mediaItems.map((item, index) => (
                <div 
                  key={index} 
                  className="flex-shrink-0 w-full h-full snap-center"
                >
                  {item.type === 'video' ? (
                    <VideoPlayer
                      src={item.url}
                      poster={item.thumbnailUrl}
                      isVisible={isVisible && currentMediaIndex === index}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={item.url}
                      alt={`Post photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
            
            {/* Carousel Indicators */}
            {mediaItems.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1">
                {mediaItems.map((_, index) => (
                  <div
                    key={index}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                      index === currentMediaIndex 
                        ? 'bg-white w-2' 
                        : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          /* Placeholder when no media */
          <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col items-center justify-center">
            <span className="text-5xl mb-2">🍽️</span>
            <p className="text-sm font-medium text-gray-600">{post.restaurant?.name}</p>
            <div className="mt-3">
              <CompactRating rating={post.rating} />
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons - Instagram Style */}
      <div className="px-3 pt-2.5">
        <div className="flex items-center">
          {/* Left Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleLike}
              className="transition-transform active:scale-90"
            >
              <Heart 
                className={`w-[26px] h-[26px] ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-900'}`}
                strokeWidth={isLiked ? 0 : 1.5}
              />
            </button>
            
            <button
              onClick={loadComments}
              className="transition-transform active:scale-90"
            >
              <MessageCircle 
                className="w-[26px] h-[26px] text-gray-900" 
                strokeWidth={1.5}
              />
            </button>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Save Button */}
          {post.restaurant && (
            <button
              onClick={handleSave}
              className="transition-transform active:scale-90"
            >
              <Bookmark 
                className={`w-[26px] h-[26px] ${isSaved ? 'fill-gray-900 text-gray-900' : 'text-gray-900'}`}
                strokeWidth={1.5}
              />
            </button>
          )}
        </div>

        {/* Likes Count */}
        {likesCount > 0 && (
          <p className="font-semibold text-[13px] text-gray-900 mt-2">
            {likesCount.toLocaleString()} {likesCount === 1 ? 'like' : 'likes'}
          </p>
        )}

        {/* Content */}
        {post.content && (
          <div className="mt-1">
            <p className={`text-[13px] text-gray-900 leading-[18px] ${!expandedContent && shouldShowExpand ? 'line-clamp-2' : ''}`}>
              <Link href={`/profile/${post.user.id}`} className="font-semibold mr-1 hover:text-gray-600">
                {post.user.username}
              </Link>
              {post.content}
            </p>
            {shouldShowExpand && (
              <button
                onClick={() => setExpandedContent(!expandedContent)}
                className="text-gray-500 text-[13px] mt-0.5"
              >
                {expandedContent ? 'less' : 'more'}
              </button>
            )}
          </div>
        )}

        {/* Comments Preview */}
        {post.commentsCount > 0 && (
          <button
            onClick={loadComments}
            className="text-gray-500 text-[13px] mt-1"
          >
            View all {post.commentsCount} comments
          </button>
        )}

        {/* Timestamp */}
        <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-2 pb-4">
          {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
        </p>
      </div>

      {/* Comments Bottom Sheet */}
      <BottomSheet
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        title="Comments"
      >
        {loadingComments ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : (
          <>
            {comments.length > 0 ? (
              <div className="space-y-4 mb-4">
                {comments.map((comment: any) => (
                  <div key={comment.id} className="flex gap-3">
                    <Link href={`/profile/${comment.user.id}`} className="flex-shrink-0">
                      {comment.user.avatarUrl ? (
                        <img
                          src={comment.user.avatarUrl}
                          alt={comment.user.fullName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                          <span className="text-xs font-bold text-white">
                            {(comment.user.fullName || comment.user.username).charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </Link>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-gray-900">
                        <Link href={`/profile/${comment.user.id}`} className="font-semibold mr-1">
                          {comment.user.username}
                        </Link>
                        {comment.content}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No comments yet</p>
                <p className="text-sm text-gray-400 mt-1">Be the first to comment!</p>
              </div>
            )}

            {/* Comment Input */}
            {user && (
              <div className="sticky bottom-0 bg-white pt-3 pb-safe border-t border-gray-200 -mx-4 px-4">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleCommentSubmit();
                      }
                    }}
                    className="flex-1 text-sm border-0 focus:outline-none focus:ring-0 placeholder-gray-400"
                  />
                  <button
                    onClick={handleCommentSubmit}
                    disabled={!newComment.trim()}
                    className="text-blue-500 font-semibold text-sm disabled:opacity-40 transition-opacity"
                  >
                    Post
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </BottomSheet>

      {/* Collection Picker */}
      {post.restaurant && (
        <CollectionPicker
          isOpen={showCollectionPicker}
          onClose={() => setShowCollectionPicker(false)}
          restaurant={{
            googlePlaceId: post.restaurant.googlePlaceId || post.restaurant.id,
            name: post.restaurant.name,
            address: post.restaurant.address,
            imageUrl: post.restaurant.imageUrl,
          }}
          onSaved={handleSavedToCollection}
          onCreateNew={handleCreateNewCollection}
        />
      )}

      {/* Create Collection Modal */}
      <CollectionModal
        isOpen={showCollectionModal}
        onClose={() => setShowCollectionModal(false)}
        onSuccess={handleCollectionCreated}
      />
    </div>
  );
}
