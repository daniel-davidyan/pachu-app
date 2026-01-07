'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { useEffect, useState, useRef, Suspense } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { PostCard, PostCardData } from '@/components/post/post-card';
import { useRouter, useSearchParams, useParams } from 'next/navigation';

interface Review {
  id: string;
  rating: number;
  title?: string;
  content: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  photos: string[];
  restaurant: {
    id: string;
    name: string;
    address?: string;
    imageUrl?: string;
    googlePlaceId?: string;
  } | null;
}

interface Profile {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
}

// Wrapper component to handle Suspense for useSearchParams
export default function UserProfileFeedPage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </MainLayout>
    }>
      <UserProfileFeedContent />
    </Suspense>
  );
}

function UserProfileFeedContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  
  const profileId = Array.isArray(params.id) ? params.id[0] : params.id;
  const startId = searchParams.get('startId');
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  
  const hasScrolled = useRef(false);

  useEffect(() => {
    if (profileId) {
      fetchProfile();
    }
  }, [profileId]);

  // Scroll to the clicked post after loading
  useEffect(() => {
    if (!loading && startId && !hasScrolled.current) {
      hasScrolled.current = true;
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
      setLoading(true);
      const response = await fetch(`/api/profile/${profileId}`);
      const data = await response.json();

      if (data.profile) {
        setProfile(data.profile);
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
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
    <MainLayout showBottomNav={!sheetOpen}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="flex items-center px-4 h-14">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center -ml-2"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <h1 className="flex-1 text-center font-semibold text-gray-900 pr-10">
            Posts
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
                createdAt: review.createdAt,
                likesCount: review.likesCount || 0,
                commentsCount: review.commentsCount || 0,
                isLiked: false,
                user: {
                  id: profile?.id || '',
                  username: profile?.username || '',
                  fullName: profile?.fullName || '',
                  avatarUrl: profile?.avatarUrl,
                },
                photos: review.photos || [],
                restaurant: review.restaurant ? {
                  id: review.restaurant.id,
                  name: review.restaurant.name,
                  address: review.restaurant.address || '',
                  imageUrl: review.restaurant.imageUrl,
                  googlePlaceId: review.restaurant.googlePlaceId,
                } : {
                  id: '',
                  name: 'Restaurant',
                  address: '',
                  imageUrl: undefined,
                  googlePlaceId: undefined,
                },
              };

              return (
                <div key={review.id} id={`post-${review.id}`}>
                  <PostCard
                    post={postData}
                    showRestaurantInfo={true}
                    onSheetStateChange={setSheetOpen}
                    onUpdate={fetchProfile}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center px-4">
              <p className="text-gray-500 text-lg font-medium">No posts found</p>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
