'use client';

import { useEffect, useState, useRef, Suspense, useCallback } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { InstagramPostCard, InstagramPostData } from '@/components/feed/instagram-post-card';
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
  videos?: Array<{ url: string; thumbnailUrl?: string }>;
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
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
    if (profileId) {
      fetchProfile();
    }
  }, [profileId]);

  // Scroll to the clicked post after loading with highlight effect
  useEffect(() => {
    if (!loading && startId && !hasScrolled.current) {
      hasScrolled.current = true;
      setTimeout(() => {
        const element = document.getElementById(`post-${startId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'instant', block: 'start' });
          // Add highlight effect
          setHighlightedPostId(startId);
          setTimeout(() => setHighlightedPostId(null), 1000);
        }
      }, 100);
    }
  }, [loading, startId]);

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
              Experiences
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
          <div className="divide-y divide-gray-200">
            {reviews.map((review) => {
              const postData: InstagramPostData = {
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
                videos: review.videos || [],
                restaurant: review.restaurant ? {
                  id: review.restaurant.id,
                  name: review.restaurant.name,
                  address: review.restaurant.address || '',
                  imageUrl: review.restaurant.imageUrl,
                  googlePlaceId: review.restaurant.googlePlaceId,
                } : undefined,
              };

              return (
                <div 
                  key={review.id} 
                  id={`post-${review.id}`}
                  ref={setPostRef(review.id)}
                  data-post-id={review.id}
                >
                  <InstagramPostCard
                    post={postData}
                    onSheetStateChange={setSheetOpen}
                    onUpdate={fetchProfile}
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
              <p className="text-gray-400 text-sm mt-1">This user hasn't shared any experiences yet</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Swipe indicator line on left edge */}
      <div 
        className="fixed left-0 top-0 bottom-0 w-1 bg-gray-300/50 z-50 pointer-events-none opacity-0 transition-opacity"
        style={{ opacity: swipeOffset > 0 ? 0.5 : 0 }}
      />
    </div>
  );
}
