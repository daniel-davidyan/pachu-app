'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, UserPlus, MapPin, Calendar, Edit2, Trash2, Send, X } from 'lucide-react';
import { CompactRating } from '@/components/ui/modern-rating';
import { formatDistanceToNow, format } from 'date-fns';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/components/ui/toast';

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
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
}

export function PostCard({ post, showRestaurantInfo = false, onEdit, onDelete, onUpdate }: PostCardProps) {
  const { user } = useUser();
  const { showToast } = useToast();
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [expandedContent, setExpandedContent] = useState(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [availableFriends, setAvailableFriends] = useState<Array<{ id: string; username: string; fullName: string }>>([]);
  const [mentionedUsers, setMentionedUsers] = useState<Array<{ id: string; username: string }>>([]);

  const shouldShowExpand = post.content.length > 200;
  const isOwnPost = user && post.user.id === user.id;

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
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      showToast('Failed to load comments', 'error');
    } finally {
      setLoadingComments(false);
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

    setSubmittingComment(true);
    try {
      const response = await fetch(`/api/reviews/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newComment.trim(),
          mentionedUserIds: mentionedUsers.map(u => u.id),
        }),
      });

      const data = await response.json();
      
      if (data.comment) {
        setComments([...comments, data.comment]);
        setNewComment('');
        setMentionedUsers([]);
        if (onUpdate) onUpdate();
      } else {
        showToast('Failed to post comment', 'error');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      showToast('Failed to post comment', 'error');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const response = await fetch(`/api/reviews/${post.id}/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setComments(comments.filter(c => c.id !== commentId));
        if (onUpdate) onUpdate();
      } else {
        showToast('Failed to delete comment', 'error');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      showToast('Failed to delete comment', 'error');
    }
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
        
        // Fetch friends for mention (you'll need to create this API)
        try {
          const response = await fetch('/api/friends/search?q=' + textAfterAt);
          const data = await response.json();
          if (data.friends) {
            setAvailableFriends(data.friends);
          }
        } catch (error) {
          console.error('Error fetching friends:', error);
        }
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  const handleSelectMention = (friend: { id: string; username: string; fullName: string }) => {
    const lastAtIndex = newComment.lastIndexOf('@');
    const beforeAt = newComment.slice(0, lastAtIndex);
    const afterMention = beforeAt + '@' + friend.username + ' ';
    setNewComment(afterMention);
    setMentionedUsers([...mentionedUsers, { id: friend.id, username: friend.username }]);
    setShowMentionDropdown(false);
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
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
                  {post.restaurant.address}
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
          <Link href={`/profile/${post.user.id}`}>
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

      {/* Photos - Carousel with 20% peek */}
      {post.photos && post.photos.length > 0 && (
        <div className="relative">
          {post.photos.length === 1 ? (
            <img
              src={post.photos[0]}
              alt="Experience photo"
              className="w-full h-64 object-cover"
            />
          ) : (
            <div className="overflow-hidden">
              <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-4">
                {post.photos.map((photo, index) => (
                  <img
                    key={index}
                    src={photo}
                    alt={`Experience photo ${index + 1}`}
                    className="flex-shrink-0 h-64 object-cover rounded-2xl snap-start"
                    style={{ width: 'calc(80vw - 2rem)' }}
                  />
                ))}
                <div className="w-4 flex-shrink-0" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Interaction Bar */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center gap-4">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
              isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
            }`}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            <span>{likesCount}</span>
          </button>
          
          <button
            onClick={loadComments}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-primary transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span>{post.commentsCount || comments.length}</span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {loadingComments ? (
            <p className="text-sm text-gray-500 text-center py-4">Loading comments...</p>
          ) : (
            <>
              {/* Comments List */}
              {comments.length > 0 && (
                <div className="space-y-3 mt-3 max-h-80 overflow-y-auto">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-2">
                      {comment.user.avatarUrl ? (
                        <img
                          src={comment.user.avatarUrl}
                          alt={comment.user.fullName}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-white">
                            {comment.user.fullName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="bg-gray-50 rounded-xl px-3 py-2">
                          <Link href={`/profile/${comment.user.id}`}>
                            <p className="font-semibold text-sm text-gray-900 hover:text-primary">
                              {comment.user.fullName}
                            </p>
                          </Link>
                          <p className="text-sm text-gray-700 mt-0.5">
                            {comment.content}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 mt-1 px-3">
                          <span className="text-xs text-gray-400">
                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                          </span>
                          {user && comment.user.id === user.id && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-xs text-red-500 hover:text-red-600"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Comment Input */}
              {user && (
                <div className="mt-3 relative">
                  {mentionedUsers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {mentionedUsers.map((mentioned) => (
                        <span
                          key={mentioned.id}
                          className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full"
                        >
                          @{mentioned.username}
                          <button
                            onClick={() => setMentionedUsers(mentionedUsers.filter(u => u.id !== mentioned.id))}
                            className="hover:text-primary/70"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Write a comment... (use @ to mention)"
                      value={newComment}
                      onChange={(e) => handleMentionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleCommentSubmit();
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      disabled={submittingComment}
                    />
                    <button
                      onClick={handleCommentSubmit}
                      disabled={submittingComment || !newComment.trim()}
                      className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Mention Dropdown */}
                  {showMentionDropdown && availableFriends.length > 0 && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto z-10">
                      {availableFriends.map((friend) => (
                        <button
                          key={friend.id}
                          onClick={() => handleSelectMention(friend)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <UserPlus className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{friend.fullName}</span>
                          <span className="text-gray-500">@{friend.username}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

