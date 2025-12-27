'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { MapPin, ChevronLeft, ChevronRight, Heart, MessageCircle, Send, X, Loader2, UserPlus, UserCheck, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { CompactRating } from '@/components/ui/modern-rating';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { formatDistanceToNow } from 'date-fns';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/components/ui/toast';
import { formatAddress } from '@/lib/address-utils';

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
  reviews: Review[];
  googlePlaceId?: string;
  latitude: number;
  longitude: number;
}

interface FeedRestaurantCardProps {
  restaurant: RestaurantFeed;
  onUpdate?: () => void;
  showInteractions?: boolean;
  onSheetStateChange?: (isOpen: boolean) => void;
}

export function FeedRestaurantCard({ restaurant, onUpdate, showInteractions = true, onSheetStateChange }: FeedRestaurantCardProps) {
  const { user } = useUser();
  const { showToast } = useToast();
  const carouselRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const commentIdCounter = useRef(0);
  
  // Helper function to get consistent random emoji based on ID
  const getFoodEmoji = (id: string) => {
    const foodEmojis = ['🍕', '🍔', '🍣', '🍜', '🥗', '🍝', '🥘', '🍱', '🌮', '🍛'];
    // Use simple hash of ID to get consistent index
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash = hash & hash;
    }
    return foodEmojis[Math.abs(hash) % foodEmojis.length];
  };
  
  // State for each experience's comments
  const [experienceStates, setExperienceStates] = useState<{
    [key: string]: {
      isLiked: boolean;
      likesCount: number;
      commentsCount: number;
      showComments: boolean;
      showLikes: boolean;
      comments: any[];
      likesUsers: any[];
      loadingComments: boolean;
      loadingLikes: boolean;
      newComment: string;
      mentionedUsers: any[];
      searchingFriends: boolean;
      friendsList: any[];
      postingComment: boolean;
      editingCommentId: string | null;
      editCommentContent: string;
      commentMenuOpen: string | null;
    };
  }>({});
  const commentInputRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});
  const commentMenuRefs = useRef<{ [key: string]: { [commentId: string]: HTMLDivElement | null } }>({});

  const getExperienceState = (experienceId: string) => {
    return experienceStates[experienceId] || {
      isLiked: false,
      likesCount: 0,
      commentsCount: 0,
      showComments: false,
      showLikes: false,
      comments: [],
      likesUsers: [],
      loadingComments: false,
      loadingLikes: false,
      newComment: '',
      mentionedUsers: [],
      searchingFriends: false,
      friendsList: [],
      postingComment: false,
      editingCommentId: null,
      editCommentContent: '',
      commentMenuOpen: null,
    };
  };

  const updateExperienceState = (experienceId: string, updates: any) => {
    setExperienceStates(prev => {
      const newState = {
        ...prev,
        [experienceId]: {
          ...getExperienceState(experienceId),
          ...updates,
        },
      };
      
      // Check if any sheet is open and notify parent
      if (onSheetStateChange) {
        const anySheetOpen = Object.values(newState).some((state: any) => 
          state.showComments || state.showLikes
        );
        onSheetStateChange(anySheetOpen);
      }
      
      return newState;
    });
  };

  // Close comment menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      Object.entries(experienceStates).forEach(([experienceId, state]) => {
        if (state.commentMenuOpen && commentMenuRefs.current[experienceId]) {
          const menuElement = commentMenuRefs.current[experienceId][state.commentMenuOpen];
          if (menuElement && !menuElement.contains(event.target as Node)) {
            updateExperienceState(experienceId, { commentMenuOpen: null });
          }
        }
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [experienceStates]);

  const handleLike = async (experience: Review) => {
    if (!user) {
      showToast('Please log in to like posts', 'error');
      return;
    }

    const state = getExperienceState(experience.id);
    const newLikedState = !state.isLiked;
    const newCount = newLikedState ? state.likesCount + 1 : state.likesCount - 1;

    // Optimistic update
    updateExperienceState(experience.id, {
      isLiked: newLikedState,
      likesCount: newCount,
    });

    try {
      const url = `/api/reviews/${experience.id}/like`;
      const response = await fetch(url, {
        method: newLikedState ? 'POST' : 'DELETE',
      });

      if (!response.ok) {
        // Revert on error
        updateExperienceState(experience.id, {
          isLiked: !newLikedState,
          likesCount: state.likesCount,
        });
        showToast('Failed to update like', 'error');
      }
    } catch (error) {
      console.error('Error updating like:', error);
      updateExperienceState(experience.id, {
        isLiked: !newLikedState,
        likesCount: state.likesCount,
      });
      showToast('Failed to update like', 'error');
    }
  };

  const loadComments = async (experienceId: string) => {
    const state = getExperienceState(experienceId);
    
    if (state.comments.length > 0) {
      updateExperienceState(experienceId, {
        showComments: !state.showComments,
      });
      return;
    }

    updateExperienceState(experienceId, { loadingComments: true, showComments: true });

    try {
      const response = await fetch(`/api/reviews/${experienceId}/comments`);
      const data = await response.json();
      
      if (data.comments) {
        // Normalize API response to match internal format
        const normalizedComments = data.comments.map((comment: any) => ({
          id: comment.id,
          content: comment.content,
          created_at: comment.createdAt,
          user: {
            id: comment.user.id,
            username: comment.user.username,
            full_name: comment.user.fullName,
            avatar_url: comment.user.avatarUrl,
          },
          likesCount: comment.likesCount || 0,
          isLiked: comment.isLiked || false,
          mentions: comment.mentions?.map((m: any) => ({
            id: m.id,
            username: m.username,
            full_name: m.fullName,
          })) || [],
        }));
        
        updateExperienceState(experienceId, {
          comments: normalizedComments,
          commentsCount: normalizedComments.length,
          showComments: true,
          loadingComments: false,
        });
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      updateExperienceState(experienceId, { loadingComments: false, showComments: false });
      showToast('Failed to load comments', 'error');
    }
  };

  const loadLikes = async (experienceId: string) => {
    const state = getExperienceState(experienceId);
    
    if (state.likesUsers.length > 0) {
      updateExperienceState(experienceId, {
        showLikes: !state.showLikes,
      });
      return;
    }

    updateExperienceState(experienceId, { loadingLikes: true });

    try {
      const response = await fetch(`/api/reviews/${experienceId}/likes`);
      const data = await response.json();
      
      if (data.users) {
        updateExperienceState(experienceId, {
          likesUsers: data.users,
          showLikes: true,
          loadingLikes: false,
        });
      }
    } catch (error) {
      console.error('Error loading likes:', error);
      updateExperienceState(experienceId, { loadingLikes: false });
      showToast('Failed to load likes', 'error');
    }
  };

  const handleCommentChange = async (experienceId: string, text: string) => {
    updateExperienceState(experienceId, { newComment: text });

    // Check for @ mention
    const lastAtSymbol = text.lastIndexOf('@');
    if (lastAtSymbol !== -1 && lastAtSymbol === text.length - 1) {
      // User just typed @, load friends
      const state = getExperienceState(experienceId);
      if (state.friendsList.length === 0) {
        updateExperienceState(experienceId, { searchingFriends: true });
        try {
          const response = await fetch('/api/friends/search');
          const data = await response.json();
          updateExperienceState(experienceId, {
            friendsList: data.friends || [],
            searchingFriends: false,
          });
        } catch (error) {
          console.error('Error loading friends:', error);
          updateExperienceState(experienceId, { searchingFriends: false });
        }
      }
    }
  };

  const handleMentionUser = (experienceId: string, friend: any) => {
    const state = getExperienceState(experienceId);
    
    // Check if already mentioned
    if (state.mentionedUsers.some(u => u.id === friend.id)) {
      showToast('User already mentioned', 'error');
      return;
    }

    // Remove the @ symbol and add the mentioned user
    const currentText = state.newComment;
    const lastAtIndex = currentText.lastIndexOf('@');
    const newText = currentText.substring(0, lastAtIndex);

    updateExperienceState(experienceId, {
      newComment: newText,
      mentionedUsers: [...state.mentionedUsers, friend],
    });
  };

  const removeMention = (experienceId: string, userId: string) => {
    const state = getExperienceState(experienceId);
    updateExperienceState(experienceId, {
      mentionedUsers: state.mentionedUsers.filter(u => u.id !== userId),
    });
  };

  const handlePostComment = async (experienceId: string) => {
    if (!user) {
      showToast('Please log in to comment', 'error');
      return;
    }

    const state = getExperienceState(experienceId);
    const commentText = state.newComment.trim();
    
    if (!commentText && state.mentionedUsers.length === 0) {
      return;
    }

    console.log('[FEED] Posting comment:', commentText, 'for experience:', experienceId);

    // Generate unique ID using counter
    commentIdCounter.current += 1;
    const tempId = `temp-${commentIdCounter.current}-${experienceId}`;

    // Create optimistic comment with unique ID
    const optimisticComment = {
      id: tempId,
      content: commentText,
      created_at: new Date().toISOString(),
      user: {
        id: user.id,
        username: user.user_metadata?.username || 'You',
        full_name: user.user_metadata?.full_name || 'You',
        avatar_url: user.user_metadata?.avatar_url,
      },
      likesCount: 0,
      isLiked: false,
      mentions: state.mentionedUsers,
    };

    console.log('[FEED] Current comments:', state.comments.length);
    console.log('[FEED] Adding optimistic comment:', optimisticComment);

    // Update UI immediately
    const newComments = [...state.comments, optimisticComment];
    updateExperienceState(experienceId, {
      comments: newComments,
      commentsCount: state.commentsCount + 1,
      newComment: '',
      mentionedUsers: [],
    });

    console.log('[FEED] Updated comments count to:', state.commentsCount + 1);

    // Post to server in background
    try {
      const response = await fetch(`/api/reviews/${experienceId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: commentText,
          mentionedUserIds: state.mentionedUsers.map(u => u.id),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[FEED] Comment posted successfully:', data.comment);
        
        // Replace optimistic comment with real one - normalize the API response
        const normalizedComment = {
          id: data.comment.id,
          content: data.comment.content,
          created_at: data.comment.createdAt,
          user: {
            id: data.comment.user.id,
            username: data.comment.user.username,
            full_name: data.comment.user.fullName,
            avatar_url: data.comment.user.avatarUrl,
          },
          likesCount: 0,
          isLiked: false,
          mentions: data.comment.mentions?.map((m: any) => ({
            id: m.id,
            username: m.username,
            full_name: m.fullName,
          })) || [],
        };
        
        // Use callback to ensure we have the latest state
        setExperienceStates(prev => {
          const currentState = prev[experienceId] || getExperienceState(experienceId);
          const updatedComments = currentState.comments.map(c =>
            c.id === optimisticComment.id ? normalizedComment : c
          );
          
          console.log('[FEED] Replacing optimistic with real comment. Total comments:', updatedComments.length);
          
          return {
            ...prev,
            [experienceId]: {
              ...currentState,
              comments: updatedComments,
            },
          };
        });
      } else {
        console.error('[FEED] Failed to post comment:', response.status);
        // Remove optimistic comment on error
        const currentState = getExperienceState(experienceId);
        updateExperienceState(experienceId, {
          comments: currentState.comments.filter(c => c.id !== optimisticComment.id),
          commentsCount: Math.max(0, currentState.commentsCount - 1),
        });
        showToast('Failed to post comment', 'error');
      }
    } catch (error) {
      console.error('[FEED] Error posting comment:', error);
      const currentState = getExperienceState(experienceId);
      updateExperienceState(experienceId, {
        comments: currentState.comments.filter(c => c.id !== optimisticComment.id),
        commentsCount: Math.max(0, currentState.commentsCount - 1),
      });
      showToast('Failed to post comment', 'error');
    }
  };

  const handleLikeComment = async (experienceId: string, commentId: string) => {
    if (!user) {
      showToast('Please log in to like comments', 'error');
      return;
    }

    const state = getExperienceState(experienceId);
    const comment = state.comments.find(c => c.id === commentId);
    if (!comment) return;

    const newLikedState = !comment.isLiked;
    const newCount = newLikedState ? comment.likesCount + 1 : comment.likesCount - 1;

    // Optimistic update
    updateExperienceState(experienceId, {
      comments: state.comments.map(c =>
        c.id === commentId
          ? { ...c, isLiked: newLikedState, likesCount: newCount }
          : c
      ),
    });

    try {
      const response = await fetch(`/api/reviews/${experienceId}/comments/${commentId}/like`, {
        method: 'POST',
      });

      if (!response.ok) {
        // Revert on error
        updateExperienceState(experienceId, {
          comments: state.comments.map(c =>
            c.id === commentId
              ? { ...c, isLiked: !newLikedState, likesCount: comment.likesCount }
              : c
          ),
        });
        showToast('Failed to like comment', 'error');
      }
    } catch (error) {
      console.error('Error liking comment:', error);
      updateExperienceState(experienceId, {
        comments: state.comments.map(c =>
          c.id === commentId
            ? { ...c, isLiked: !newLikedState, likesCount: comment.likesCount }
            : c
        ),
      });
      showToast('Failed to like comment', 'error');
    }
  };

  const handleDeleteComment = async (experienceId: string, commentId: string) => {
    updateExperienceState(experienceId, { commentMenuOpen: null });
    try {
      const response = await fetch(`/api/reviews/${experienceId}/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const state = getExperienceState(experienceId);
        updateExperienceState(experienceId, {
          comments: state.comments.filter(c => c.id !== commentId),
          commentsCount: state.commentsCount - 1,
        });
        if (onUpdate) onUpdate();
        showToast('Comment deleted', 'success');
      } else {
        showToast('Failed to delete comment', 'error');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      showToast('Failed to delete comment', 'error');
    }
  };

  const handleEditComment = (experienceId: string, comment: any) => {
    updateExperienceState(experienceId, {
      editingCommentId: comment.id,
      editCommentContent: comment.content,
      commentMenuOpen: null,
    });
  };

  const handleUpdateComment = async (experienceId: string, commentId: string) => {
    const state = getExperienceState(experienceId);
    if (!state.editCommentContent.trim()) {
      showToast('Comment cannot be empty', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/reviews/${experienceId}/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: state.editCommentContent.trim() }),
      });

      if (response.ok) {
        const { comment: updatedComment } = await response.json();
        // Transform the updated comment to match the existing format (snake_case)
        const transformedComment = {
          ...updatedComment,
          created_at: updatedComment.createdAt,
          updated_at: updatedComment.updatedAt,
          user: {
            id: updatedComment.user.id,
            username: updatedComment.user.username,
            full_name: updatedComment.user.fullName,
            avatar_url: updatedComment.user.avatarUrl,
          },
          mentions: updatedComment.mentions || [],
        };
        updateExperienceState(experienceId, {
          comments: state.comments.map(c => c.id === commentId ? transformedComment : c),
          editingCommentId: null,
          editCommentContent: '',
        });
        if (onUpdate) onUpdate();
        showToast('Comment updated', 'success');
      } else {
        showToast('Failed to update comment', 'error');
      }
    } catch (error) {
      console.error('Error updating comment:', error);
      showToast('Failed to update comment', 'error');
    }
  };

  const handleCancelEdit = (experienceId: string) => {
    updateExperienceState(experienceId, {
      editingCommentId: null,
      editCommentContent: '',
    });
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    
    const cardWidth = 320; // Width of each experience card
    const gap = 16; // Gap between cards
    const scrollAmount = cardWidth + gap;
    
    const newScrollLeft = carouselRef.current.scrollLeft + (direction === 'right' ? scrollAmount : -scrollAmount);
    
    carouselRef.current.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth',
    });

    // Update current index
    const newIndex = Math.round(newScrollLeft / scrollAmount);
    setCurrentIndex(Math.max(0, Math.min(newIndex, restaurant.reviews.length - 1)));
  };

  if (!restaurant.reviews || restaurant.reviews.length === 0) {
    return null;
  }

  // Initialize states for all experiences only if not already initialized
  restaurant.reviews.forEach(review => {
    if (!experienceStates[review.id]) {
      setExperienceStates(prev => ({
        ...prev,
        [review.id]: {
          isLiked: review.isLiked || false,
          likesCount: review.likesCount || 0,
          commentsCount: review.commentsCount || 0,
          showComments: false,
          showLikes: false,
          comments: [],
          likesUsers: [],
          loadingComments: false,
          loadingLikes: false,
          newComment: '',
          mentionedUsers: [],
          searchingFriends: false,
          friendsList: [],
          postingComment: false,
          editingCommentId: null,
          editCommentContent: '',
          commentMenuOpen: null,
        },
      }));
    }
  });

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Restaurant Header - Large Photo */}
      <Link href={`/restaurant/${restaurant.googlePlaceId || restaurant.id}`}>
        <div className="relative h-48 bg-gray-200">
          {restaurant.imageUrl ? (
            <img
              src={restaurant.imageUrl}
              alt={restaurant.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10">
              <span className="text-6xl">🍽️</span>
            </div>
          )}
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          
          {/* Restaurant Info */}
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <h3 className="font-bold text-lg mb-1">{restaurant.name}</h3>
            {restaurant.address && (
              <p className="text-sm opacity-90 flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {formatAddress(restaurant.address)}
              </p>
            )}
          </div>
        </div>
      </Link>

      {/* Experiences Carousel */}
      <div className="relative px-4 py-4">
        {/* Carousel Navigation */}
        {restaurant.reviews.length > 1 && (
          <>
            <button
              onClick={() => scrollCarousel('left')}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-50"
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
            <button
              onClick={() => scrollCarousel('right')}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-50"
              disabled={currentIndex === restaurant.reviews.length - 1}
            >
              <ChevronRight className="w-5 h-5 text-gray-700" />
            </button>
          </>
        )}

        {/* Experiences */}
        <div
          ref={carouselRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {restaurant.reviews.map((experience) => {
            const state = getExperienceState(experience.id);
            
            return (
              <div
                key={experience.id}
                className="flex-shrink-0 w-80 snap-start"
              >
                {/* User Info */}
                <div className="flex items-start gap-2 mb-3">
                  <Link
                    href={user && experience.user.id === user.id ? '/profile' : `/profile/${experience.user.id}`}
                    className="flex items-center gap-2 flex-1 min-w-0"
                  >
                    {experience.user.avatarUrl ? (
                      <img
                        src={experience.user.avatarUrl}
                        alt={experience.user.fullName}
                        className="w-9 h-9 rounded-full object-cover"
                        onError={(e) => {
                          // If image fails to load (common with Google profile photos), hide it
                          // The fallback div will be shown instead
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling;
                          if (fallback) {
                            (fallback as HTMLElement).style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    {/* Fallback avatar - always render but initially hidden if avatarUrl exists */}
                    <div 
                      className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center"
                      style={{ display: experience.user.avatarUrl ? 'none' : 'flex' }}
                    >
                      <span className="text-sm font-bold text-white">
                        {(experience.user.fullName || experience.user.username).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">
                        {experience.user.fullName || experience.user.username}
                      </p>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(experience.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </Link>
                  {/* Rating on the right */}
                  <div className="flex-shrink-0">
                    <CompactRating rating={experience.rating} />
                  </div>
                </div>

                {/* Photos Carousel OR Placeholder Shimmer */}
                {experience.photos && experience.photos.length > 0 ? (
                  <div className="mb-3">
                    {experience.photos.length === 1 ? (
                      <img
                        src={experience.photos[0]}
                        alt="Experience photo"
                        className="w-full h-48 object-cover rounded-xl"
                      />
                    ) : (
                      <div className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
                        {experience.photos.map((photo, index) => (
                          <img
                            key={index}
                            src={photo}
                            alt={`Photo ${index + 1}`}
                            className="flex-shrink-0 w-64 h-48 object-cover rounded-xl snap-start"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Single placeholder shimmer for experiences without photos */
                  <div className="mb-3">
                    <div className="w-full h-28 bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 rounded-xl flex items-center justify-center animate-pulse">
                      <span className="text-7xl opacity-20">
                        {getFoodEmoji(experience.id)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Experience Content - After Photos */}
                {experience.content && (
                  <p className="text-sm text-gray-700 leading-relaxed mb-3 line-clamp-3">
                    {experience.content}
                  </p>
                )}

                {/* Instagram-style Like/Comment Bar - Always at Bottom */}
                {showInteractions && (
                  <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                    {/* Like */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLike(experience)}
                        className="transition-transform active:scale-90"
                      >
                        <Heart
                          className={`w-6 h-6 ${state.isLiked ? 'fill-red-500 text-red-500' : 'text-gray-900'}`}
                          strokeWidth={state.isLiked ? 0 : 1.5}
                        />
                      </button>
                      <button
                        onClick={() => loadLikes(experience.id)}
                        className="text-sm font-semibold text-gray-900 hover:text-gray-600"
                      >
                        {state.likesCount}
                      </button>
                    </div>

                    {/* Comment */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadComments(experience.id)}
                        className="transition-transform active:scale-90"
                      >
                        <MessageCircle
                          className="w-6 h-6 text-gray-900"
                          strokeWidth={1.5}
                        />
                      </button>
                      <button
                        onClick={() => loadComments(experience.id)}
                        className="text-sm font-semibold text-gray-900 hover:text-gray-600"
                      >
                        {state.commentsCount > 0 ? state.commentsCount : (experience.commentsCount || 0)}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Dots Indicator */}
        {restaurant.reviews.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-4">
            {restaurant.reviews.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all ${
                  index === currentIndex
                    ? 'w-6 bg-gray-900'
                    : 'w-1.5 bg-gray-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom Sheets for all experiences */}
      {restaurant.reviews.map((experience) => {
        const state = getExperienceState(experience.id);
        
        return (
          <div key={`sheets-${experience.id}`}>
            {/* Comments Bottom Sheet */}
            <BottomSheet
              isOpen={state.showComments}
              onClose={() => updateExperienceState(experience.id, { showComments: false })}
              title="Comments"
            >
              <div className="flex flex-col h-full">
                {/* Comments List */}
                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
                  {state.loadingComments ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : state.comments.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No comments yet</p>
                  ) : (
                    state.comments.map((comment: any) => (
                      <div key={comment.id} className="flex gap-3">
                        <Link href={user && comment.user.id === user.id ? '/profile' : `/profile/${comment.user.id}`}>
                          {comment.user.avatar_url ? (
                            <img
                              src={comment.user.avatar_url}
                              alt={comment.user.full_name}
                              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                              <span className="text-base font-bold text-white">
                                {(comment.user.full_name || comment.user.username)?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </Link>
                        <div className="flex-1 min-w-0">
                          {state.editingCommentId === comment.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={state.editCommentContent}
                                onChange={(e) => updateExperienceState(experience.id, { editCommentContent: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-sm resize-none"
                                rows={2}
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleUpdateComment(experience.id, comment.id)}
                                  className="px-3 py-1 bg-primary text-white text-xs rounded-lg hover:bg-primary/90"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => handleCancelEdit(experience.id)}
                                  className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <Link href={user && comment.user.id === user.id ? '/profile' : `/profile/${comment.user.id}`}>
                                    <p className="font-semibold text-sm text-gray-900">
                                      {comment.user.full_name || comment.user.username}
                                    </p>
                                  </Link>
                                  <p className="text-sm text-gray-700 mt-1 break-words">{comment.content}</p>
                                  {comment.mentions && comment.mentions.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {comment.mentions.map((mentioned: any) => (
                                        <Link
                                          key={mentioned.id}
                                          href={user && mentioned.id === user.id ? '/profile' : `/profile/${mentioned.id}`}
                                          className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full hover:bg-primary/20"
                                        >
                                          @{mentioned.username}
                                        </Link>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <button
                                    onClick={() => handleLikeComment(experience.id, comment.id)}
                                    className="transition-transform active:scale-90"
                                  >
                                    <Heart
                                      className={`w-4 h-4 ${comment.isLiked ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
                                      strokeWidth={comment.isLiked ? 0 : 2}
                                    />
                                  </button>
                                  
                                  {user && comment.user.id === user.id && (
                                    <div className="relative" ref={el => {
                                      if (!commentMenuRefs.current[experience.id]) {
                                        commentMenuRefs.current[experience.id] = {};
                                      }
                                      commentMenuRefs.current[experience.id][comment.id] = el;
                                    }}>
                                      <button
                                        onClick={() => updateExperienceState(experience.id, { 
                                          commentMenuOpen: state.commentMenuOpen === comment.id ? null : comment.id 
                                        })}
                                        className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                                        title="More options"
                                      >
                                        <MoreVertical className="w-3.5 h-3.5" />
                                      </button>
                                      
                                      {state.commentMenuOpen === comment.id && (
                                        <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[9999] min-w-[120px]">
                                          <button
                                            onClick={() => handleEditComment(experience.id, comment)}
                                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                            Edit
                                          </button>
                                          <button
                                            onClick={() => handleDeleteComment(experience.id, comment.id)}
                                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Delete
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3 mt-1">
                                {comment.created_at && (
                                  <span className="text-xs text-gray-500">
                                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                                  </span>
                                )}
                                {comment.likesCount > 0 && (
                                  <button
                                    onClick={() => handleLikeComment(experience.id, comment.id)}
                                    className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                                  >
                                    {comment.likesCount} {comment.likesCount === 1 ? 'like' : 'likes'}
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Comment Input */}
                <div className="border-t border-gray-200 p-4 bg-white">
                  {/* Mentioned Users */}
                  {state.mentionedUsers.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {state.mentionedUsers.map((mentioned) => (
                        <span
                          key={mentioned.id}
                          className="inline-flex items-center gap-1 bg-primary/10 text-primary text-sm px-3 py-1 rounded-full"
                        >
                          @{mentioned.username}
                          <button
                            onClick={() => removeMention(experience.id, mentioned.id)}
                            className="hover:bg-primary/20 rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Friends List for Mention */}
                  {state.newComment.endsWith('@') && state.friendsList.length > 0 && (
                    <div className="mb-3 max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                      {state.friendsList.map((friend) => (
                        <button
                          key={friend.id}
                          onClick={() => handleMentionUser(experience.id, friend)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50"
                        >
                          {friend.avatar_url ? (
                            <img
                              src={friend.avatar_url}
                              alt={friend.full_name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                              <span className="text-xs font-bold text-white">
                                {friend.full_name?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 text-left">
                            <p className="text-sm font-semibold text-gray-900">{friend.username}</p>
                            <p className="text-xs text-gray-500">{friend.full_name}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <textarea
                      ref={(el) => { commentInputRefs.current[experience.id] = el; }}
                      value={state.newComment}
                      onChange={(e) => handleCommentChange(experience.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handlePostComment(experience.id);
                        }
                      }}
                      placeholder="Add a comment..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                      rows={1}
                    />
                    <button
                      onClick={() => handlePostComment(experience.id)}
                      disabled={!state.newComment.trim() && state.mentionedUsers.length === 0}
                      className="px-4 py-2 bg-primary text-white rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </BottomSheet>

            {/* Likes Bottom Sheet */}
            <BottomSheet
              isOpen={state.showLikes}
              onClose={() => updateExperienceState(experience.id, { showLikes: false })}
              title="Likes"
            >
              <div className="px-4 pb-4">
                {state.loadingLikes ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : state.likesUsers.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No likes yet</p>
                ) : (
                  <div className="space-y-3">
                    {state.likesUsers.map((likeUser: any) => (
                      <div key={likeUser.id} className="flex items-center gap-3">
                        <Link href={user && likeUser.id === user.id ? '/profile' : `/profile/${likeUser.id}`} className="flex items-center gap-3 flex-1">
                          {likeUser.avatar_url ? (
                            <img
                              src={likeUser.avatar_url}
                              alt={likeUser.full_name}
                              className="w-11 h-11 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                              <span className="text-sm font-bold text-white">
                                {likeUser.full_name?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-900 truncate">
                              {likeUser.username}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{likeUser.full_name}</p>
                          </div>
                        </Link>
                        {likeUser.id !== user?.id && (
                          <button
                            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                              likeUser.isFollowing
                                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                : 'bg-primary text-white hover:bg-primary/90'
                            }`}
                          >
                            {likeUser.isFollowing ? (
                              <>
                                <UserCheck className="w-4 h-4 inline mr-1" />
                                Following
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-4 h-4 inline mr-1" />
                                Follow
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </BottomSheet>
          </div>
        );
      })}
    </div>
  );
}

