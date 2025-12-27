'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { MapPin, ChevronLeft, ChevronRight, Heart, MessageCircle, X, Loader2, UserPlus, UserCheck, UtensilsCrossed, ChefHat, Utensils, Sparkles, Star, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { CompactRating } from '@/components/ui/modern-rating';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { formatDistanceToNow } from 'date-fns';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/components/ui/toast';

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
  onSheetStateChange?: (isOpen: boolean) => void;
}

// Modern gradient + icon placeholders - defined outside component for stability
const PLACEHOLDER_CONFIGS = [
  { gradient: 'from-orange-400 to-pink-500', Icon: UtensilsCrossed },
  { gradient: 'from-purple-400 to-indigo-500', Icon: ChefHat },
  { gradient: 'from-blue-400 to-cyan-500', Icon: Utensils },
  { gradient: 'from-violet-400 to-purple-500', Icon: Sparkles },
  { gradient: 'from-fuchsia-400 to-pink-500', Icon: Star },
];

export function FeedExperienceCard({ restaurant, userLocation, onUpdate, onSheetStateChange }: FeedExperienceCardProps) {
  const { user } = useUser();
  const { showToast } = useToast();
  const carouselRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Function to get placeholder based on experience ID (ensures different placeholders for multiple posts)
  const getPlaceholderConfig = (experienceId: string) => {
    let hash = 0;
    for (let i = 0; i < experienceId.length; i++) {
      hash = ((hash << 5) - hash) + experienceId.charCodeAt(i);
      hash = hash & hash;
    }
    return PLACEHOLDER_CONFIGS[Math.abs(hash) % PLACEHOLDER_CONFIGS.length];
  };
  
  // State for each experience's comments and likes
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
    setExperienceStates(prev => ({
      ...prev,
      [experienceId]: {
        ...getExperienceState(experienceId),
        ...updates,
      },
    }));
  };

  // Notify parent when any sheet opens or closes
  useEffect(() => {
    if (onSheetStateChange) {
      const hasAnySheetOpen = Object.values(experienceStates).some(
        state => state.showComments || state.showLikes
      );
      onSheetStateChange(hasAnySheetOpen);
    }
  }, [experienceStates, onSheetStateChange]);

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    
    const container = carouselRef.current;
    const cardWidth = container.querySelector('.experience-card')?.clientWidth || 0;
    const scrollAmount = direction === 'left' ? -cardWidth - 16 : cardWidth + 16;
    
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    
    const newIndex = direction === 'left' 
      ? Math.max(0, currentIndex - 1)
      : Math.min(restaurant.reviews.length - 1, currentIndex + 1);
    setCurrentIndex(newIndex);
  };

  const handleLike = async (experience: Review) => {
    if (!user) {
      showToast('Please log in to like posts', 'error');
      return;
    }

    const state = getExperienceState(experience.id);
    const newLikedState = !state.isLiked;
    const newCount = newLikedState ? state.likesCount + 1 : state.likesCount - 1;

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

  const handleCommentSubmit = async (experienceId: string) => {
    if (!user) {
      showToast('Please log in to comment', 'error');
      return;
    }

    const state = getExperienceState(experienceId);
    if (!state.newComment.trim()) return;

    updateExperienceState(experienceId, { postingComment: true });

    try {
      const response = await fetch(`/api/reviews/${experienceId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: state.newComment.trim(),
          mentionedUserIds: state.mentionedUsers.map((u: any) => u.id),
        }),
      });

      const data = await response.json();
      
      if (data.comment) {
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
          mentions: data.comment.mentions || [],
        };

        updateExperienceState(experienceId, {
          comments: [...state.comments, normalizedComment],
          commentsCount: state.commentsCount + 1,
          newComment: '',
          mentionedUsers: [],
          postingComment: false,
        });
        
        if (onUpdate) onUpdate();
      } else {
        updateExperienceState(experienceId, { postingComment: false });
        showToast('Failed to post comment', 'error');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      updateExperienceState(experienceId, { postingComment: false });
      showToast('Failed to post comment', 'error');
    }
  };

  const handleFollowToggle = async (userId: string) => {
    if (!user) {
      showToast('Please log in to follow users', 'error');
      return;
    }

    // Find the user in likesUsers across all experiences
    let targetExperienceId = '';
    let userToUpdate: any = null;
    
    for (const review of restaurant.reviews) {
      const state = getExperienceState(review.id);
      userToUpdate = state.likesUsers.find((u: any) => u.id === userId);
      if (userToUpdate) {
        targetExperienceId = review.id;
        break;
      }
    }

    if (!userToUpdate || !targetExperienceId) return;

    const newFollowingState = !userToUpdate.isFollowing;
    const state = getExperienceState(targetExperienceId);

    // Optimistic update
    updateExperienceState(targetExperienceId, {
      likesUsers: state.likesUsers.map((u: any) => 
        u.id === userId ? { ...u, isFollowing: newFollowingState } : u
      ),
    });

    try {
      const url = newFollowingState 
        ? '/api/follows'
        : `/api/follows?userId=${userId}`;
      
      const response = await fetch(url, {
        method: newFollowingState ? 'POST' : 'DELETE',
        headers: newFollowingState ? { 'Content-Type': 'application/json' } : {},
        body: newFollowingState ? JSON.stringify({ userId }) : undefined,
      });

      if (!response.ok) {
        // Revert on error
        updateExperienceState(targetExperienceId, {
          likesUsers: state.likesUsers.map((u: any) => 
            u.id === userId ? { ...u, isFollowing: !newFollowingState } : u
          ),
        });
        showToast('Failed to update follow status', 'error');
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      updateExperienceState(targetExperienceId, {
        likesUsers: state.likesUsers.map((u: any) => 
          u.id === userId ? { ...u, isFollowing: !newFollowingState } : u
        ),
      });
      showToast('Failed to update follow status', 'error');
    }
  };

  const handleLikeComment = async (experienceId: string, commentId: string) => {
    if (!user) {
      showToast('Please log in to like comments', 'error');
      return;
    }

    const state = getExperienceState(experienceId);
    const comment = state.comments.find((c: any) => c.id === commentId);
    if (!comment) return;

    const newLikedState = !comment.isLiked;
    const newCount = newLikedState ? comment.likesCount + 1 : comment.likesCount - 1;

    // Optimistic update
    updateExperienceState(experienceId, {
      comments: state.comments.map((c: any) => 
        c.id === commentId 
          ? { ...c, isLiked: newLikedState, likesCount: newCount }
          : c
      ),
    });

    try {
      const url = `/api/reviews/${experienceId}/comments/${commentId}/like`;
      const response = await fetch(url, {
        method: newLikedState ? 'POST' : 'DELETE',
      });

      if (!response.ok) {
        // Revert on error
        updateExperienceState(experienceId, {
          comments: state.comments.map((c: any) => 
            c.id === commentId 
              ? { ...c, isLiked: !newLikedState, likesCount: comment.likesCount }
              : c
          ),
        });
        showToast('Failed to update like', 'error');
      }
    } catch (error) {
      console.error('Error updating comment like:', error);
      updateExperienceState(experienceId, {
        comments: state.comments.map((c: any) => 
          c.id === commentId 
            ? { ...c, isLiked: !newLikedState, likesCount: comment.likesCount }
            : c
        ),
      });
      showToast('Failed to update like', 'error');
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
          comments: state.comments.filter((c: any) => c.id !== commentId),
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
        };
        updateExperienceState(experienceId, {
          comments: state.comments.map((c: any) => c.id === commentId ? transformedComment : c),
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

  if (!restaurant.reviews || restaurant.reviews.length === 0) {
    return null;
  }

  // Initialize states for all reviews
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
                {restaurant.address}
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
            const isGoogleReview = experience.id.startsWith('google-');
            
            return (
              <div
                key={experience.id}
                className="experience-card flex-shrink-0 w-80 snap-start"
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
                  /* Modern gradient + icon placeholder for experiences without photos */
                  (() => {
                    const config = getPlaceholderConfig(experience.id);
                    return (
                      <div className="mb-3">
                        <div className={`w-full h-48 bg-gradient-to-br ${config.gradient} rounded-xl flex items-center justify-center opacity-20`}>
                          <config.Icon className="w-24 h-24 text-white" strokeWidth={1.5} />
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* Experience Content */}
                {experience.content && (
                  <p className="text-sm text-gray-700 leading-relaxed mb-3 line-clamp-3">
                    {experience.content}
                  </p>
                )}

                {/* Instagram-style Like/Comment Bar - Only for user/friend reviews, NOT Google reviews */}
                {!isGoogleReview && (
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
                        {state.likesCount || experience.likesCount || 0}
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
                    <div className="text-center py-12">
                      <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No comments yet</p>
                      <p className="text-sm text-gray-400 mt-1">Be the first to comment!</p>
                    </div>
                  ) : (
                    state.comments.map((comment: any) => (
                      <div key={comment.id} className="flex gap-3">
                        <Link href={user && comment.user.id === user.id ? '/profile' : `/profile/${comment.user.id}`} className="flex-shrink-0 self-start">
                          {comment.user.avatar_url ? (
                            <img
                              src={comment.user.avatar_url}
                              alt={comment.user.full_name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
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
                                    <span className="font-semibold text-sm text-gray-900 hover:text-gray-600">
                                      {comment.user.full_name || comment.user.username}
                                    </span>
                                  </Link>
                                  <span className="text-sm text-gray-900 ml-2">
                                    {comment.content}
                                  </span>
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
                                <span className="text-xs text-gray-500">
                                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                                </span>
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

                {/* Comment Input - Fixed at Bottom */}
                {user && (
                  <div className="sticky bottom-0 bg-white pt-3 pb-safe border-t border-gray-200 px-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder="Add a comment..."
                        value={state.newComment}
                        onChange={(e) => updateExperienceState(experience.id, { newComment: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleCommentSubmit(experience.id);
                          }
                        }}
                        className="flex-1 text-sm border-0 focus:outline-none focus:ring-0 placeholder-gray-400"
                      />
                      <button
                        onClick={() => handleCommentSubmit(experience.id)}
                        disabled={!state.newComment.trim() || state.postingComment}
                        className="text-blue-500 font-semibold text-sm disabled:opacity-40 transition-opacity"
                      >
                        {state.postingComment ? 'Posting...' : 'Post'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </BottomSheet>

            {/* Likes Bottom Sheet */}
            <BottomSheet
              isOpen={state.showLikes}
              onClose={() => updateExperienceState(experience.id, { showLikes: false })}
              title="Likes"
            >
              {state.loadingLikes ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-900" />
                </div>
              ) : state.likesUsers.length > 0 ? (
                <div className="space-y-0 -mx-4">
                  {state.likesUsers.map((likeUser: any) => (
                    <div key={likeUser.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                      <Link href={likeUser.isCurrentUser ? '/profile' : `/profile/${likeUser.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                        {likeUser.avatarUrl ? (
                          <img
                            src={likeUser.avatarUrl}
                            alt={likeUser.fullName}
                            className="w-11 h-11 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-base font-bold text-white">
                              {likeUser.fullName?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">{likeUser.username}</p>
                          <p className="text-xs text-gray-500 truncate">{likeUser.fullName}</p>
                        </div>
                      </Link>
                      {!likeUser.isCurrentUser && (
                        <button
                          onClick={() => handleFollowToggle(likeUser.id)}
                          className={`px-6 py-1.5 rounded-lg text-sm font-semibold transition-colors flex-shrink-0 ${
                            likeUser.isFollowing
                              ? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                              : 'bg-blue-500 text-white hover:bg-blue-600'
                          }`}
                        >
                          {likeUser.isFollowing ? 'Following' : 'Follow'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Heart className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No likes yet</p>
                  <p className="text-sm text-gray-400 mt-1">Be the first to like!</p>
                </div>
              )}
            </BottomSheet>
          </div>
        );
      })}
    </div>
  );
}
