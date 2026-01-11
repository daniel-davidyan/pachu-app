'use client';

import { useUser } from '@/hooks/use-user';
import { useEffect, useState, useRef, Suspense, useCallback } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { InstagramPostCard, InstagramPostData } from '@/components/feed/instagram-post-card';
import { useRouter, useSearchParams } from 'next/navigation';
import { WriteReviewModal } from '@/components/review/write-review-modal';
import { useToast } from '@/components/ui/toast';
import { ConfirmModal } from '@/components/ui/confirm-modal';

interface Review {
  id: string;
  rating: number;
  content: string;
  created_at: string;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  user: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  restaurants: {
    id: string;
    name: string;
    address: string;
    image_url?: string;
    google_place_id?: string;
  };
  review_photos: Array<{ photo_url: string }>;
  review_videos?: Array<{ video_url: string; thumbnail_url?: string }>;
  // Combined media array with correct sort order
  media?: Array<{ type: 'photo' | 'video'; url: string; thumbnailUrl?: string; sortOrder: number }>;
}

interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

// Wrapper component to handle Suspense for useSearchParams
export default function ProfileFeedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    }>
      <ProfileFeedContent />
    </Suspense>
  );
}

function ProfileFeedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { showToast } = useToast();
  
  const tab = searchParams.get('tab') || 'published';
  const startId = searchParams.get('startId');
  
  const [reviews, setReviews] = useState<Review[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  
  const hasScrolled = useRef(false);
  const [visiblePostId, setVisiblePostId] = useState<string | null>(null);
  const postRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Swipe back gesture state
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);
  const isSwiping = useRef<boolean>(false);
  const [swipeOffset, setSwipeOffset] = useState(0);

  // Intersection Observer for video autoplay
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            setVisiblePostId(entry.target.getAttribute('data-post-id'));
          }
        });
      },
      { threshold: 0.5 }
    );

    postRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [reviews]);

  const setPostRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) {
      postRefs.current.set(id, el);
    } else {
      postRefs.current.delete(id);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchReviews();
    }
  }, [user, tab]);

  // Scroll to the clicked post after loading with highlight effect
  useEffect(() => {
    if (!loading && startId && !hasScrolled.current && reviews.length > 0) {
      hasScrolled.current = true;
      
      const scrollToPost = () => {
        const element = document.getElementById(`post-${startId}`);
        if (element) {
          // scrollIntoView respects the scroll-margin-top CSS property
          element.scrollIntoView({ behavior: 'instant', block: 'start' });
          
          // Add highlight effect
          setHighlightedPostId(startId);
          setTimeout(() => setHighlightedPostId(null), 1000);
        }
      };
      
      // Wait for DOM to be fully painted and images to start loading
      requestAnimationFrame(() => {
        // First scroll attempt
        setTimeout(scrollToPost, 50);
        // Retry after images might have loaded and adjusted layout
        setTimeout(scrollToPost, 500);
      });
    }
  }, [loading, startId, reviews.length]);

  // Touch handlers for swipe back gesture (mobile only)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only start swipe if touching from the left edge (first 30px)
    if (e.touches[0].clientX < 30) {
      touchStartX.current = e.touches[0].clientX;
      touchCurrentX.current = e.touches[0].clientX;
      isSwiping.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping.current) return;
    
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;
    
    // Only allow swiping right (positive diff)
    if (diff > 0) {
      setSwipeOffset(Math.min(diff, window.innerWidth));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping.current) return;
    
    const diff = touchCurrentX.current - touchStartX.current;
    
    // If swiped more than 100px, trigger navigation
    if (diff > 100) {
      setIsExiting(true);
      setSwipeOffset(window.innerWidth);
      setTimeout(() => {
        router.back();
      }, 300);
    } else {
      // Snap back
      setSwipeOffset(0);
    }
    
    isSwiping.current = false;
    touchStartX.current = 0;
    touchCurrentX.current = 0;
  }, [router]);

  const handleBack = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      router.back();
    }, 300);
  }, [router]);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`/api/profile/${user?.id}`);
      const data = await response.json();
      if (data.profile) {
        setProfile(data.profile);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchReviews = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      let url = `/api/reviews?userId=${user.id}`;
      if (tab === 'published') {
        url += '&published=true';
      } else if (tab === 'unpublished') {
        url += '&published=false';
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        console.error('API error:', data.error);
        setReviews([]);
      } else {
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    setReviewToDelete(reviewId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteReview = async () => {
    if (!reviewToDelete) return;

    try {
      const response = await fetch(`/api/reviews?reviewId=${reviewToDelete}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setReviews(prev => prev.filter(review => review.id !== reviewToDelete));
        showToast('Experience deleted successfully', 'success');
      } else {
        showToast('Failed to delete experience', 'error');
      }
    } catch (error) {
      console.error('Error deleting review:', error);
      showToast('Failed to delete experience', 'error');
    } finally {
      setReviewToDelete(null);
    }
  };

  const handleEditReview = (postId: string) => {
    const review = reviews.find(r => r.id === postId);
    if (review) {
      setEditingReview(review);
      setShowEditModal(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`min-h-screen bg-white ${isExiting ? 'animate-slide-out-right' : 'animate-slide-in-left'}`}
      style={{
        transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : undefined,
        transition: swipeOffset === 0 && !isSwiping.current ? 'transform 0.3s ease-out' : 'none',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Instagram-Style Header */}
      <div 
        className="sticky top-0 z-20 bg-white border-b border-gray-200"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center px-4 h-11">
          <button
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center -ml-3"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <div className="flex-1 text-center pr-7">
            <p className="font-semibold text-[15px] text-gray-900 leading-tight">
              {tab === 'published' ? 'Experiences' : 'Unpublished'}
            </p>
            <p className="text-[11px] text-gray-500 leading-tight">
              @{profile?.username}
            </p>
          </div>
        </div>
      </div>

      {/* Posts Feed - Instagram Style */}
      <div 
        className="pb-safe"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {reviews.length > 0 ? (
          <div>
            {reviews.map((review) => {
              const postData: InstagramPostData = {
                id: review.id,
                rating: review.rating,
                content: review.content,
                createdAt: review.created_at,
                likesCount: review.likesCount || 0,
                commentsCount: review.commentsCount || 0,
                isLiked: review.isLiked || false,
                user: review.user || {
                  id: user?.id || '',
                  username: profile?.username || '',
                  fullName: profile?.full_name || '',
                  avatarUrl: profile?.avatar_url || undefined,
                },
                photos: review.review_photos?.map(p => p.photo_url) || [],
                videos: review.review_videos?.map(v => ({ url: v.video_url, thumbnailUrl: v.thumbnail_url })) || [],
                // Pass the combined media array for correct sort order
                media: review.media,
                restaurant: {
                  id: review.restaurants?.id || '',
                  name: review.restaurants?.name || 'Restaurant',
                  address: review.restaurants?.address || '',
                  imageUrl: review.restaurants?.image_url,
                  googlePlaceId: review.restaurants?.google_place_id,
                },
              };

              return (
                <div 
                  key={review.id} 
                  id={`post-${review.id}`}
                  ref={setPostRef(review.id)}
                  data-post-id={review.id}
                  style={{ scrollMarginTop: 'calc(44px + env(safe-area-inset-top))' }}
                >
                  <InstagramPostCard
                    post={postData}
                    onSheetStateChange={setSheetOpen}
                    onUpdate={fetchReviews}
                    isVisible={visiblePostId === review.id}
                    isHighlighted={highlightedPostId === review.id}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center px-4">
              <p className="text-gray-500 text-lg font-medium">No experiences found</p>
              <p className="text-gray-400 text-sm mt-1">
                {tab === 'published' 
                  ? 'Start sharing your restaurant experiences!'
                  : 'Your saved experiences will appear here'}
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Swipe indicator line on left edge */}
      <div 
        className="fixed left-0 top-0 bottom-0 w-1 bg-gray-300/50 z-50 pointer-events-none opacity-0 transition-opacity"
        style={{ opacity: swipeOffset > 0 ? 0.5 : 0 }}
      />

      {/* Edit Review Modal */}
      {editingReview && (
        <WriteReviewModal
          key={`edit-review-${editingReview.id}-${showEditModal}`}
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingReview(null);
          }}
          restaurant={{
            googlePlaceId: editingReview.restaurants?.google_place_id || editingReview.restaurants?.id || '',
            name: editingReview.restaurants?.name || '',
            address: editingReview.restaurants?.address || '',
            latitude: 0,
            longitude: 0,
            photoUrl: editingReview.restaurants?.image_url,
          }}
          existingReview={{
            id: editingReview.id,
            rating: editingReview.rating,
            content: editingReview.content || '',
            photos: editingReview.review_photos?.map(p => p.photo_url) || [],
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setEditingReview(null);
            fetchReviews();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setReviewToDelete(null);
        }}
        onConfirm={confirmDeleteReview}
        title="Delete this experience?"
        message="This will permanently remove your review and photos."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />
    </div>
  );
}
