'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, UserPlus, MapPin, Calendar, Edit2, Trash2, Send, X, MoreVertical, Camera, Bookmark } from 'lucide-react';
import { CompactRating } from '@/components/ui/modern-rating';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { formatDistanceToNow, format } from 'date-fns';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/components/ui/toast';
import { formatAddress } from '@/lib/address-utils';
import { CollectionPicker } from '@/components/collections/collection-picker';
import { CollectionModal } from '@/components/collections/collection-modal';
import { VideoPlayer } from '@/components/feed/video-player';

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  likesCount: number;
  isLiked: boolean;
  user: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  mentions: Array<{
    id: string;
    username: string;
    fullName: string;
  }>;
}

export interface PostCardData {
  id: string;
  rating: number;
  title?: string;
  content: string;
  visitDate?: string;
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
  restaurant?: {
    id: string;
    name: string;
    address: string;
    imageUrl?: string;
    googlePlaceId?: string;
  };
}

interface PostCardProps {
  post: PostCardData;
  showRestaurantInfo?: boolean;
  onEdit?: (post: PostCardData) => void;
  onDelete?: (postId: string) => void;
  onUpdate?: () => void;
  onSheetStateChange?: (isOpen: boolean) => void;
  embedded?: boolean;
  isVisible?: boolean;
}

export function PostCard({ post, showRestaurantInfo = false, onEdit, onDelete, onUpdate, onSheetStateChange, embedded = false, isVisible = false }: PostCardProps) {
  const { user } = useUser();
  const { showToast } = useToast();
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [likesUsers, setLikesUsers] = useState<Array<{
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
    isFollowing: boolean;
    isCurrentUser: boolean;
  }>>([]);
  const [newComment, setNewComment] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [expandedContent, setExpandedContent] = useState(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [availableFriends, setAvailableFriends] = useState<Array<{ id: string; username: string; fullName: string }>>([]);
  const [mentionedUsers, setMentionedUsers] = useState<Array<{ id: string; username: string }>>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [commentMenuOpen, setCommentMenuOpen] = useState<string | null>(null);
  const commentMenuRef = useRef<{ [key: string]: HTMLDivElement | null }>({});
  
  // Save/Collection state
  const [isSaved, setIsSaved] = useState(false);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);

  // Check if this is a Google review (ID starts with "google-")
  const isGoogleReview = post.id.startsWith('google-');

  // Generate random food emoji once and keep it stable
  const randomFoodEmoji = useMemo(() => {
    const foodEmojis = ['🍕', '🍔', '🍣', '🍜', '🥗', '🍝', '🥘', '🍱', '🌮', '🍛'];
    return foodEmojis[Math.floor(Math.random() * foodEmojis.length)];
  }, []);

  const shouldShowExpand = post.content.length > 200;
  const isOwnPost = user && post.user.id === user.id;

  // Notify parent when sheet state changes
  useEffect(() => {
    if (onSheetStateChange) {
      onSheetStateChange(showComments || showLikes || showCollectionPicker);
    }
  }, [showComments, showLikes, showCollectionPicker, onSheetStateChange]);

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
          
          // Match by google_place_id first
          if (restaurantGooglePlaceId && itemGooglePlaceId) {
            return itemGooglePlaceId === restaurantGooglePlaceId;
          }
          // Then try matching by id
          if (restaurantId && itemId) {
            return itemId === restaurantId;
          }
          // Also try matching restaurantId with google_place_id
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

  // Close comment menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (commentMenuOpen) {
        const menuElement = commentMenuRef.current[commentMenuOpen];
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setCommentMenuOpen(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [commentMenuOpen]);

  // Get user profile for optimistic updates
  const [profile, setProfile] = useState<any>(null);
  
  // Load profile when user is available
  if (user && !profile) {
    fetch(`/api/profile/${user.id}`)
      .then(response => response.json())
      .then(data => {
        if (data.profile) {
          setProfile(data.profile);
        }
      })
      .catch(error => {
        console.error('Error fetching profile:', error);
      });
  }

  // Fetch friends list when component mounts or comments are shown
  const fetchFriends = async (search = '') => {
    try {
      const response = await fetch('/api/friends/search?q=' + search);
      const data = await response.json();
      if (data.friends) {
        setAvailableFriends(data.friends);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const handleLike = async () => {
    if (!user) {
      showToast('Please log in to like posts', 'error');
      return;
    }

    const newLikedState = !isLiked;
    const newCount = newLikedState ? likesCount + 1 : likesCount - 1;

    // Optimistic update
    setIsLiked(newLikedState);
    setLikesCount(newCount);

    try {
      const url = `/api/reviews/${post.id}/like`;
      const response = await fetch(url, {
        method: newLikedState ? 'POST' : 'DELETE',
      });

      if (!response.ok) {
        // Revert on error
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
        // Load friends list for mentions
        fetchFriends();
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      showToast('Failed to load comments', 'error');
    } finally {
      setLoadingComments(false);
    }
  };

  const loadLikes = async () => {
    if (likesUsers.length > 0) {
      setShowLikes(!showLikes);
      return;
    }

    setLoadingLikes(true);
    try {
      const response = await fetch(`/api/reviews/${post.id}/likes`);
      const data = await response.json();
      
      if (data.users) {
        setLikesUsers(data.users);
        setShowLikes(true);
      }
    } catch (error) {
      console.error('Error loading likes:', error);
      showToast('Failed to load likes', 'error');
    } finally {
      setLoadingLikes(false);
    }
  };

  const handleFollowToggle = async (userId: string) => {
    if (!user) {
      showToast('Please log in to follow users', 'error');
      return;
    }

    const userToUpdate = likesUsers.find(u => u.id === userId);
    if (!userToUpdate) return;

    const newFollowingState = !userToUpdate.isFollowing;

    // Optimistic update
    setLikesUsers(likesUsers.map(u => 
      u.id === userId ? { ...u, isFollowing: newFollowingState } : u
    ));

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
        setLikesUsers(likesUsers.map(u => 
          u.id === userId ? { ...u, isFollowing: !newFollowingState } : u
        ));
        showToast('Failed to update follow status', 'error');
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      setLikesUsers(likesUsers.map(u => 
        u.id === userId ? { ...u, isFollowing: !newFollowingState } : u
      ));
      showToast('Failed to update follow status', 'error');
    }
  };

  const handleCommentSubmit = async () => {
    if (!user) {
      showToast('Please log in to comment', 'error');
      return;
    }

    if (!newComment.trim()) {
      return;
    }

    const commentText = newComment.trim();
    const mentionedIds = mentionedUsers.map(u => u.id);
    
    // Create optimistic comment
    const optimisticComment: Comment = {
      id: `temp-${Date.now()}`, // Temporary ID
      content: commentText,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      likesCount: 0,
      isLiked: false,
      user: {
        id: user.id,
        username: profile?.username || user.email?.split('@')[0] || 'You',
        fullName: profile?.full_name || profile?.username || 'You',
        avatarUrl: profile?.avatar_url,
      },
      mentions: mentionedUsers.map(u => ({
        id: u.id,
        username: u.username,
        fullName: u.username,
      })),
    };

    // Clear input immediately
    setNewComment('');
    setMentionedUsers([]);

    // Add comment to UI after 1 second (feels more natural)
    setTimeout(() => {
      setComments([...comments, optimisticComment]);
    }, 1000);

    // Post to server in background (don't wait for it)
    fetch(`/api/reviews/${post.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: commentText,
        mentionedUserIds: mentionedIds,
      }),
    })
      .then(response => response.json())
      .then(data => {
        if (data.comment) {
          // Replace optimistic comment with real one from server
          setTimeout(() => {
            setComments(prev => 
              prev.map(c => c.id === optimisticComment.id ? data.comment : c)
            );
          }, 1000);
        } else {
          // If failed, remove optimistic comment
          setTimeout(() => {
            setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
            showToast('Failed to post comment', 'error');
          }, 1000);
        }
      })
      .catch(error => {
        console.error('Error posting comment:', error);
        // Remove optimistic comment on error
        setTimeout(() => {
          setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
          showToast('Failed to post comment', 'error');
        }, 1000);
      });
  };

  const handleDeleteComment = async (commentId: string) => {
    setCommentMenuOpen(null);
    try {
      const response = await fetch(`/api/reviews/${post.id}/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setComments(comments.filter(c => c.id !== commentId));
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

  const handleEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditCommentContent(comment.content);
    setCommentMenuOpen(null);
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editCommentContent.trim()) {
      showToast('Comment cannot be empty', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/reviews/${post.id}/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editCommentContent.trim() }),
      });

      if (response.ok) {
        const { comment: updatedComment } = await response.json();
        setComments(comments.map(c => c.id === commentId ? updatedComment : c));
        setEditingCommentId(null);
        setEditCommentContent('');
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

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditCommentContent('');
  };

  const handleMentionInput = async (value: string) => {
    setNewComment(value);
    
    // Check if typing @mention
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const textAfterAt = value.slice(lastAtIndex + 1);
      if (!textAfterAt.includes(' ')) {
        setMentionSearch(textAfterAt);
        setShowMentionDropdown(true);
        
        // Fetch friends for mention
        fetchFriends(textAfterAt);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  const handleSelectMention = (friend: { id: string; username: string; fullName: string }) => {
    // Check if user is already mentioned
    if (mentionedUsers.some(u => u.id === friend.id)) {
      showToast(`@${friend.username} is already mentioned`, 'error');
      setShowMentionDropdown(false);
      return;
    }

    const lastAtIndex = newComment.lastIndexOf('@');
    const beforeAt = newComment.slice(0, lastAtIndex);
    const afterMention = beforeAt + '@' + friend.username + ' ';
    setNewComment(afterMention);
    setMentionedUsers([...mentionedUsers, { id: friend.id, username: friend.username }]);
    setShowMentionDropdown(false);
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) {
      showToast('Please log in to like comments', 'error');
      return;
    }

    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    const newLikedState = !comment.isLiked;
    const newCount = newLikedState ? comment.likesCount + 1 : comment.likesCount - 1;

    // Optimistic update
    setComments(comments.map(c => 
      c.id === commentId 
        ? { ...c, isLiked: newLikedState, likesCount: newCount }
        : c
    ));

    try {
      const url = `/api/reviews/${post.id}/comments/${commentId}/like`;
      const response = await fetch(url, {
        method: newLikedState ? 'POST' : 'DELETE',
      });

      if (!response.ok) {
        // Revert on error
        setComments(comments.map(c => 
          c.id === commentId 
            ? { ...c, isLiked: !newLikedState, likesCount: comment.likesCount }
            : c
        ));
        showToast('Failed to update like', 'error');
      }
    } catch (error) {
      console.error('Error updating comment like:', error);
      setComments(comments.map(c => 
        c.id === commentId 
          ? { ...c, isLiked: !newLikedState, likesCount: comment.likesCount }
          : c
      ));
      showToast('Failed to update like', 'error');
    }
  };

  // Save to collection handlers
  const handleSave = async () => {
    if (!post.restaurant) {
      showToast('Cannot save - no restaurant info', 'error');
      return;
    }

    if (isSaved) {
      // If already saved, remove from wishlist
      try {
        const wishlistResponse = await fetch('/api/wishlist');
        const wishlistData = await wishlistResponse.json();
        
        // Find the wishlist item - check both googlePlaceId and regular id
        const restaurantGooglePlaceId = post.restaurant?.googlePlaceId;
        const restaurantId = post.restaurant?.id;
        
        const wishlistItem = wishlistData.wishlist?.find((item: any) => {
          const itemGooglePlaceId = item.restaurants?.google_place_id;
          const itemId = item.restaurants?.id;
          
          // Match by google_place_id first, then by id
          if (restaurantGooglePlaceId && itemGooglePlaceId) {
            return itemGooglePlaceId === restaurantGooglePlaceId;
          }
          if (restaurantId && itemId) {
            return itemId === restaurantId;
          }
          // Also try matching restaurantId with google_place_id (in case they're the same)
          if (restaurantId && itemGooglePlaceId) {
            return itemGooglePlaceId === restaurantId;
          }
          return false;
        });

        if (wishlistItem) {
          // Use restaurant_id from the wishlist item, or fallback to nested restaurants.id
          const deleteId = wishlistItem.restaurant_id || wishlistItem.restaurants?.id;
          
          if (!deleteId) {
            showToast('Cannot find restaurant to remove', 'error');
            return;
          }
          
          const response = await fetch(`/api/wishlist?restaurantId=${deleteId}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            setIsSaved(false);
            showToast('Removed from saved', 'success');
          } else {
            const errorData = await response.json();
            console.error('Delete error:', errorData);
            showToast('Failed to remove', 'error');
          }
        } else {
          // Item not found, but we thought it was saved - reset state
          setIsSaved(false);
          showToast('Already removed', 'success');
        }
      } catch (error) {
        console.error('Error removing from saved:', error);
        showToast('Failed to remove', 'error');
      }
    } else {
      // If not saved, close other sheets first then open collection picker
      setShowComments(false);
      setShowLikes(false);
      // Small delay to ensure other sheets close first
      setTimeout(() => {
        setShowCollectionPicker(true);
      }, 50);
    }
  };

  const handleSavedToCollection = (collectionId: string | null) => {
    setIsSaved(true);
  };

  const handleCreateNewCollection = () => {
    setShowCollectionModal(true);
  };

  const handleCollectionCreated = () => {
    // Re-open collection picker after creating a collection
    setShowCollectionPicker(true);
  };

  return (
    <div className={embedded ? "" : "bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"}>
      {/* Content at Top */}
      <div className="p-4">
        {/* User/Restaurant Info with Rating on Right */}
        {showRestaurantInfo && post.restaurant ? (
          // Show restaurant info
          <Link
            href={`/restaurant/${post.restaurant.googlePlaceId || post.restaurant.id}`}
            className="block mb-3"
          >
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <div className="w-14 h-14 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl overflow-hidden flex-shrink-0">
                {post.restaurant.imageUrl ? (
                  <img src={post.restaurant.imageUrl} alt={post.restaurant.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🍽️</div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base text-gray-900 truncate">
                  {post.restaurant.name}
                </h3>
                <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {formatAddress(post.restaurant.address)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                </p>
              </div>
              
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <CompactRating rating={post.rating} />
                {isOwnPost && onEdit && onDelete && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setShowMenu(!showMenu);
                      }}
                      className="w-7 h-7 rounded-full hover:bg-gray-200 flex items-center justify-center transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                    
                    {showMenu && (
                      <>
                        <div 
                          className="fixed inset-0 z-10"
                          onClick={() => setShowMenu(false)}
                        />
                        <div className="absolute right-0 top-9 z-20 bg-white rounded-xl shadow-xl border border-gray-200 py-1 w-36">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              onEdit(post);
                              setShowMenu(false);
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700 font-medium"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              onDelete(post.id);
                              setShowMenu(false);
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600 font-medium"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ) : (
          // Show user info
          <Link href={isOwnPost ? '/profile' : `/profile/${post.user.id}`}>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors mb-3">
              {post.user.avatarUrl ? (
                <img
                  src={post.user.avatarUrl}
                  alt={post.user.fullName}
                  className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl font-bold text-white">
                    {post.user.fullName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base text-gray-900 truncate">
                  {post.user.fullName}
                </p>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  @{post.user.username}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                </p>
              </div>
              
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <CompactRating rating={post.rating} />
                {isOwnPost && onEdit && onDelete && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setShowMenu(!showMenu);
                      }}
                      className="w-7 h-7 rounded-full hover:bg-gray-200 flex items-center justify-center transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                    
                    {showMenu && (
                      <>
                        <div 
                          className="fixed inset-0 z-10"
                          onClick={() => setShowMenu(false)}
                        />
                        <div className="absolute right-0 top-9 z-20 bg-white rounded-xl shadow-xl border border-gray-200 py-1 w-36">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              onEdit(post);
                              setShowMenu(false);
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700 font-medium"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              onDelete(post.id);
                              setShowMenu(false);
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600 font-medium"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Link>
        )}

        {/* Photos & Videos - Carousel with 20% peek OR Placeholder */}
        {((post.photos && post.photos.length > 0) || (post.videos && post.videos.length > 0)) ? (
          <div className="relative">
            {(() => {
              // Combine photos and videos into a single media array
              const mediaItems: Array<{ type: 'photo' | 'video'; url: string; thumbnailUrl?: string }> = [
                ...(post.videos || []).map(v => ({ type: 'video' as const, url: v.url, thumbnailUrl: v.thumbnailUrl })),
                ...(post.photos || []).map(p => ({ type: 'photo' as const, url: p })),
              ];
              
              if (mediaItems.length === 1) {
                const item = mediaItems[0];
                return item.type === 'video' ? (
                  <VideoPlayer
                    src={item.url}
                    poster={item.thumbnailUrl}
                    isVisible={isVisible}
                    className="w-full h-64 object-cover bg-black"
                  />
                ) : (
                  <img
                    src={item.url}
                    alt="Experience photo"
                    className="w-full h-64 object-cover"
                  />
                );
              }
              
              return (
                <div className="overflow-hidden">
                  <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-4">
                    {mediaItems.map((item, index) => (
                      item.type === 'video' ? (
                        <div 
                          key={index}
                          className="flex-shrink-0 h-64 rounded-2xl snap-start overflow-hidden"
                          style={{ width: 'calc(80vw - 2rem)' }}
                        >
                          <VideoPlayer
                            src={item.url}
                            poster={item.thumbnailUrl}
                            isVisible={isVisible && index === 0}
                            className="w-full h-full bg-black"
                          />
                        </div>
                      ) : (
                        <img
                          key={index}
                          src={item.url}
                          alt={`Experience photo ${index + 1}`}
                          className="flex-shrink-0 h-64 object-cover rounded-2xl snap-start"
                          style={{ width: 'calc(80vw - 2rem)' }}
                        />
                      )
                    ))}
                    <div className="w-4 flex-shrink-0" />
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          /* Placeholder when no photos - Different for Google reviews vs user posts */
          isGoogleReview ? (
            /* Restaurant gradient placeholder for Google reviews */
            <div className="relative bg-gradient-to-br from-primary/20 to-primary/10">
              <div className="w-full h-48 flex items-center justify-center">
                <span className="text-7xl">🍽️</span>
              </div>
            </div>
          ) : (
            /* Upload placeholder for user posts without photos (profile/my experiences) */
            <div className="relative bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 border-2 border-dashed border-gray-300">
              <div className="w-full h-48 flex flex-col items-center justify-center gap-3 py-8">
                <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center">
                  <Camera className="w-8 h-8 text-gray-400" />
                </div>
                <div className="text-center px-4">
                  <p className="text-sm font-semibold text-gray-600">No photos yet</p>
                  <p className="text-xs text-gray-400 mt-1">Add photos to share your experience</p>
                </div>
              </div>
            </div>
          )
        )}

        {/* Content section after photos */}
        <div className="px-4 pt-3">
          {/* Review Title */}
          {post.title && (
            <h3 className="font-semibold text-gray-900 mb-2">
              {post.title}
            </h3>
          )}

          {/* Review Content */}
          {post.content && (
            <div className="mb-3">
              <p className={`text-sm text-gray-700 leading-relaxed ${!expandedContent && shouldShowExpand ? 'line-clamp-3' : ''}`}>
                {post.content}
              </p>
              {shouldShowExpand && (
                <button
                  onClick={() => setExpandedContent(!expandedContent)}
                  className="text-primary text-sm font-semibold mt-1"
                >
                  {expandedContent ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          )}

          {/* Visit Date */}
          {post.visitDate && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
              <Calendar className="w-3.5 h-3.5" />
              <span>Visited {format(new Date(post.visitDate), 'MMM d, yyyy')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Interaction Bar - Instagram Style - Only for user/friend reviews, NOT Google reviews */}
      {!isGoogleReview && (
        <div className="px-4 py-2.5 border-t border-gray-50">
          <div className="flex items-center gap-4">
            {/* Like Button + Count */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleLike}
                className="transition-transform active:scale-90"
              >
                <Heart 
                  className={`w-[26px] h-[26px] ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-900'}`}
                  strokeWidth={isLiked ? 0 : 1.5}
                />
              </button>
              {likesCount > 0 && (
                <button
                  onClick={loadLikes}
                  className="text-sm font-semibold text-gray-900"
                >
                  {likesCount}
                </button>
              )}
            </div>
            
            {/* Comment Button + Count */}
            <div className="flex items-center gap-2">
              <button
                onClick={loadComments}
                className="transition-transform active:scale-90"
              >
                <MessageCircle 
                  className="w-[26px] h-[26px] text-gray-900" 
                  strokeWidth={1.5}
                />
              </button>
              {post.commentsCount > 0 && (
                <button
                  onClick={loadComments}
                  className="text-sm font-semibold text-gray-900"
                >
                  {post.commentsCount}
                </button>
              )}
            </div>

            {/* Spacer to push save button to right */}
            <div className="flex-1" />

            {/* Save Button - Only show if restaurant info exists */}
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
        </div>
      )}

      {/* Likes Bottom Sheet */}
      <BottomSheet
        isOpen={showLikes}
        onClose={() => setShowLikes(false)}
        title="Likes"
      >
        {loadingLikes ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : likesUsers.length > 0 ? (
          <div className="space-y-0 -mx-4">
            {likesUsers.map((likeUser) => (
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
                        {likeUser.fullName.charAt(0).toUpperCase()}
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

      {/* Comments Bottom Sheet - Instagram Style */}
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
            {/* Comments List */}
            {comments.length > 0 ? (
              <div className="space-y-4 mb-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Link href={user && comment.user.id === user.id ? '/profile' : `/profile/${comment.user.id}`} className="flex-shrink-0">
                      {comment.user.avatarUrl ? (
                        <img
                          src={comment.user.avatarUrl}
                          alt={comment.user.fullName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                          <span className="text-base font-bold text-white">
                            {(comment.user.fullName || comment.user.username).charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </Link>
                    
                    <div className="flex-1 min-w-0">
                      {editingCommentId === comment.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editCommentContent}
                            onChange={(e) => setEditCommentContent(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-sm resize-none"
                            rows={2}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateComment(comment.id)}
                              className="px-3 py-1 bg-primary text-white text-xs rounded-lg hover:bg-primary/90"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelEdit}
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
                                  {comment.user.fullName || comment.user.username}
                                </span>
                              </Link>
                              <span className="text-sm text-gray-900 ml-2">
                                {comment.content}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={() => handleLikeComment(comment.id)}
                                className="transition-transform active:scale-90"
                              >
                                <Heart 
                                  className={`w-4 h-4 ${comment.isLiked ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
                                  strokeWidth={comment.isLiked ? 0 : 2}
                                />
                              </button>
                              
                              {user && comment.user.id === user.id && (
                                <div className="relative" ref={el => { commentMenuRef.current[comment.id] = el; }}>
                                  <button
                                    onClick={() => setCommentMenuOpen(commentMenuOpen === comment.id ? null : comment.id)}
                                    className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                                    title="More options"
                                  >
                                    <MoreVertical className="w-3.5 h-3.5" />
                                  </button>
                                  
                                  {commentMenuOpen === comment.id && (
                                    <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[9999] min-w-[120px]">
                                      <button
                                        onClick={() => handleEditComment(comment)}
                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => handleDeleteComment(comment.id)}
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
                              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                            </span>
                            {comment.likesCount > 0 && (
                              <button
                                onClick={() => handleLikeComment(comment.id)}
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
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No comments yet</p>
                <p className="text-sm text-gray-400 mt-1">Be the first to comment!</p>
              </div>
            )}

            {/* Comment Input - Fixed at Bottom */}
            {user && (
              <div className="sticky bottom-0 bg-white pt-3 pb-safe border-t border-gray-200 -mx-4 px-4">
                {mentionedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {mentionedUsers.map((mentioned) => (
                      <span
                        key={mentioned.id}
                        className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded-full font-medium"
                      >
                        @{mentioned.username}
                        <button
                          onClick={() => setMentionedUsers(mentionedUsers.filter(u => u.id !== mentioned.id))}
                          className="hover:text-blue-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => handleMentionInput(e.target.value)}
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
                  
                  {/* Mention Dropdown */}
                  {showMentionDropdown && availableFriends.length > 0 && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-48 overflow-y-auto">
                      {availableFriends.map((friend) => (
                        <button
                          key={friend.id}
                          onClick={() => handleSelectMention(friend)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-white">
                              {friend.fullName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-900">{friend.fullName}</p>
                            <p className="text-xs text-gray-500">@{friend.username}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
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

