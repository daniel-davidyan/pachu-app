'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { useUser } from '@/hooks/use-user';
import { useEffect, useState, useRef, Suspense } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { PostCard, PostCardData } from '@/components/post/post-card';
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
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </MainLayout>
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
  
  const startPostRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchReviews();
    }
  }, [user, tab]);

  // Scroll to the clicked post after loading
  useEffect(() => {
    if (!loading && startId && !hasScrolled.current) {
      hasScrolled.current = true;
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const element = document.getElementById(`post-${startId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      }, 100);
    }
  }, [loading, startId]);

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

  const handleEditReview = (post: PostCardData) => {
    const review = reviews.find(r => r.id === post.id);
    if (review) {
      setEditingReview(review);
      setShowEditModal(true);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showBottomNav={!showEditModal && !sheetOpen}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="flex items-center px-4 py-3">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center -ml-2"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <h1 className="flex-1 text-center font-semibold text-gray-900 pr-10">
            {tab === 'published' ? 'Published' : 'Unpublished'}
          </h1>
        </div>
      </div>

      {/* Posts Feed */}
      <div className="pb-24 bg-gray-50">
        {reviews.length > 0 ? (
          <div className="space-y-4 p-4">
            {reviews.map((review) => {
              const postData: PostCardData = {
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
                restaurant: {
                  id: review.restaurants?.id || '',
                  name: review.restaurants?.name || 'Restaurant',
                  address: review.restaurants?.address || '',
                  imageUrl: review.restaurants?.image_url,
                  googlePlaceId: review.restaurants?.google_place_id,
                },
              };

              return (
                <div key={review.id} id={`post-${review.id}`}>
                  <PostCard
                    post={postData}
                    showRestaurantInfo={true}
                    onEdit={handleEditReview}
                    onDelete={handleDeleteReview}
                    onSheetStateChange={setSheetOpen}
                    onUpdate={fetchReviews}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center px-4">
              <p className="text-gray-500 text-lg font-medium">No posts found</p>
              <p className="text-gray-400 text-sm mt-1">
                {tab === 'published' 
                  ? 'Start sharing your restaurant experiences!'
                  : 'Your saved experiences will appear here'}
              </p>
            </div>
          </div>
        )}
      </div>

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
    </MainLayout>
  );
}
