'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { UtensilsCrossed, Hotel, Briefcase, Coffee, Wine, Star, Heart, MessageCircle, Share2, MapPin, Loader2, Users } from 'lucide-react';
import { FullScreenReviewViewer } from '@/components/feed/full-screen-review-viewer';
import { formatDistanceToNow } from 'date-fns';

interface Review {
  id: string;
  rating: number;
  content: string;
  createdAt: string;
  likesCount: number;
  isLiked: boolean;
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
    imageUrl?: string;
    rating?: number;
  };
  photos: string[];
  source: 'own' | 'friend' | 'nearby';
}

const categories = [
  { id: 'restaurants', name: 'Restaurants', icon: UtensilsCrossed, active: true },
  { id: 'cafes', name: 'Cafés', icon: Coffee, active: false },
  { id: 'bars', name: 'Bars', icon: Wine, active: false },
  { id: 'hotels', name: 'Hotels', icon: Hotel, active: false },
  { id: 'services', name: 'Services', icon: Briefcase, active: false },
];

export default function FeedPage() {
  const [activeCategory, setActiveCategory] = useState('restaurants');
  const [feedMode, setFeedMode] = useState<'all' | 'friends'>('all'); // New filter
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedReviewIndex, setSelectedReviewIndex] = useState<number | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Get user location
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.warn('Could not get location:', error);
        // Default to Tel Aviv
        setUserLocation({ latitude: 32.0853, longitude: 34.7818 });
      }
    );
  }, []);

  // Fetch reviews based on mode
  const fetchReviews = useCallback(async (pageNum: number) => {
    if (!userLocation) return;
    
    try {
      if (pageNum === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      if (feedMode === 'all') {
        // Fetch real Google reviews for nearby restaurants
        const googleResponse = await fetch(
          `/api/restaurants/nearby?latitude=${userLocation.latitude}&longitude=${userLocation.longitude}&radius=5000`
        );
        const googleData = await googleResponse.json();

        if (googleData.restaurants) {
          // Fetch detailed reviews for each restaurant
          const reviewsPromises = googleData.restaurants.slice(pageNum * 10, (pageNum + 1) * 10).map(async (restaurant: any) => {
            try {
              const detailsResponse = await fetch(`/api/restaurants/details?placeId=${restaurant.googlePlaceId}`);
              const detailsData = await detailsResponse.json();
              
              // Convert Google reviews to our format
              return (detailsData.reviews || []).map((googleReview: any) => ({
                id: `${restaurant.id}-${googleReview.author_name}`,
                rating: googleReview.rating,
                content: googleReview.text,
                createdAt: new Date(googleReview.time * 1000).toISOString(),
                likesCount: 0,
                isLiked: false,
                user: {
                  id: googleReview.author_name,
                  username: googleReview.author_name,
                  fullName: googleReview.author_name,
                  avatarUrl: googleReview.profile_photo_url,
                },
                restaurant: {
                  id: restaurant.id,
                  name: restaurant.name,
                  address: restaurant.address,
                  imageUrl: restaurant.photoUrl,
                  rating: restaurant.rating,
                  googlePlaceId: restaurant.googlePlaceId,
                },
                photos: [],
                source: 'nearby' as const,
              }));
            } catch (error) {
              return [];
            }
          });

          const allReviews = (await Promise.all(reviewsPromises)).flat();
          
          if (pageNum === 0) {
            setReviews(allReviews);
          } else {
            setReviews(prev => [...prev, ...allReviews]);
          }
          setHasMore(googleData.restaurants.length > (pageNum + 1) * 10);
          setPage(pageNum);
        }
      } else {
        // Friends mode - fetch from database
        const response = await fetch(
          `/api/feed/nearby?page=${pageNum}&limit=10&latitude=${userLocation.latitude}&longitude=${userLocation.longitude}&radius=10000`
        );
        const data = await response.json();

        if (data.reviews) {
          if (pageNum === 0) {
            setReviews(data.reviews);
          } else {
            setReviews(prev => [...prev, ...data.reviews]);
          }
          setHasMore(data.hasMore);
          setPage(pageNum);
        }
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userLocation, feedMode]);

  // Initial load and when mode changes
  useEffect(() => {
    if (userLocation) {
      fetchReviews(0);
    }
  }, [userLocation, feedMode, fetchReviews]);

  // Infinite scroll observer
  useEffect(() => {
    if (loading || loadingMore || !hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchReviews(page + 1);
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observerRef.current.observe(currentRef);
    }

    return () => {
      if (observerRef.current && currentRef) {
        observerRef.current.unobserve(currentRef);
      }
    };
  }, [loading, loadingMore, hasMore, page, fetchReviews]);

  // Like/Unlike review
  const toggleLike = async (reviewId: string) => {
    try {
      const review = reviews.find(r => r.id === reviewId);
      if (!review) return;

      const method = review.isLiked ? 'DELETE' : 'POST';
      const response = await fetch('/api/reviews/like', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId }),
      });

      if (response.ok) {
        setReviews(prev =>
          prev.map(r =>
            r.id === reviewId
              ? {
                  ...r,
                  isLiked: !r.isLiked,
                  likesCount: r.isLiked ? r.likesCount - 1 : r.likesCount + 1,
                }
              : r
          )
        );
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleComment = (reviewId: string) => {
    alert('Comments coming soon!');
  };

  const handleShare = (reviewId: string) => {
    // Share functionality
    if (navigator.share) {
      navigator.share({
        title: 'Check out this review',
        url: window.location.href,
      });
    } else {
      alert('Share functionality coming soon!');
    }
  };

  return (
    <>
      <MainLayout>
        <div className="pb-24 min-h-screen bg-gray-100">
          {/* Header */}
          <div className="px-4 pt-2 pb-3 bg-white -mx-0 mb-2">
            <h1 className="text-xl font-bold text-gray-900">Feed</h1>
          </div>

          {/* Category Carousel */}
          <div className="px-4 mb-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                const isDisabled = !cat.active;
                
                return (
                  <button 
                    key={cat.id}
                    onClick={() => cat.active && setActiveCategory(cat.id)}
                    disabled={isDisabled}
                    className={`
                      flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold
                      whitespace-nowrap transition-all duration-200 flex-shrink-0 border-2
                      ${isActive 
                        ? 'bg-primary/10 text-[#C5459C] border-primary shadow-[0_4px_12px_rgba(197,69,156,0.25)]' 
                        : isDisabled
                          ? 'bg-white text-gray-400 border-gray-200 cursor-not-allowed shadow-sm'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 shadow-sm'
                      }
                    `}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#C5459C]' : ''}`} strokeWidth={2} />
                    <span>{cat.name}</span>
                    {isDisabled && (
                      <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">Soon</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feed Mode Filter */}
          <div className="px-4 mb-4">
            <div className="flex gap-3">
              <button
                onClick={() => setFeedMode('friends')}
                className={`
                  flex-1 px-4 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ${feedMode === 'friends'
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'bg-gray-50 text-gray-600 border border-transparent hover:bg-gray-100'
                  }
                `}
              >
                <Users className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                My Friends
              </button>
              <button
                onClick={() => setFeedMode('all')}
                className={`
                  flex-1 px-4 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ${feedMode === 'all'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-gray-50 text-gray-600 border border-transparent hover:bg-gray-100'
                  }
                `}
              >
                <MapPin className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                All (Google)
              </button>
            </div>
          </div>

          {/* Feed Content */}
          <div className="px-4 space-y-4">
            {/* Info Notice */}
            {reviews.length > 0 && feedMode === 'all' && (
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl p-4 border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-200 rounded-xl flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">Real Google Reviews Near You</p>
                    <p className="text-xs text-gray-600">Showing reviews from nearby restaurants</p>
                  </div>
                </div>
              </div>
            )}
            {reviews.length > 0 && feedMode === 'friends' && reviews.some(r => r.source === 'friend') && (
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl p-4 border border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">Reviews from your friends</p>
                    <p className="text-xs text-gray-600">See what your network is loving!</p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading && reviews.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-gray-500">Finding reviews near you...</p>
              </div>
            )}

            {/* Review Cards */}
            {reviews.map((review, index) => {
              const displayImage = review.photos[0] || review.restaurant.imageUrl;
              const timeAgo = formatDistanceToNow(new Date(review.createdAt), { addSuffix: true });
              
              return (
                <div 
                  key={review.id} 
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer transition-transform active:scale-[0.98]"
                  onClick={() => setSelectedReviewIndex(index)}
                >
                  {/* Author Header */}
                  <div className="p-4 flex items-center gap-3">
                    {review.user.avatarUrl ? (
                      <img
                        src={review.user.avatarUrl}
                        alt={review.user.username}
                        className="w-10 h-10 rounded-full object-cover border-2 border-blue-100 shadow"
                        onError={(e) => {
                          // Fallback if image fails to load
                          e.currentTarget.style.display = 'none';
                          const sibling = e.currentTarget.nextElementSibling as HTMLElement;
                          if (sibling) sibling.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md ${review.user.avatarUrl ? 'hidden' : ''}`}>
                      {review.user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{review.user.username}</p>
                        {feedMode === 'all' && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Google Review</span>
                        )}
                        {review.source === 'friend' && feedMode === 'friends' && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">Friend</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{timeAgo}</p>
                    </div>
                  </div>

                  {/* Restaurant Photo */}
                  {displayImage && (
                    <div className="relative aspect-[16/10] bg-gray-100">
                      <img 
                        src={displayImage} 
                        alt={review.restaurant.name}
                        className="w-full h-full object-cover"
                      />
                      {/* Restaurant Name Overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                        <h3 className="text-white font-bold text-lg">{review.restaurant.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-0.5 bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs font-semibold text-white">{review.rating}/5</span>
                          </div>
                          {review.restaurant.address && (
                            <div className="flex items-center gap-1 text-white/80">
                              <MapPin className="w-3 h-3" />
                              <span className="text-xs truncate max-w-[150px]">{review.restaurant.address}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Review Text */}
                  {review.content && (
                    <div className="p-4">
                      <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{review.content}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="px-4 pb-4 flex items-center gap-4">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLike(review.id);
                      }}
                      className={`flex items-center gap-1.5 transition-colors ${
                        review.isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${review.isLiked ? 'fill-current' : ''}`} />
                      <span className="text-xs font-medium">{review.likesCount}</span>
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleComment(review.id);
                      }}
                      className="flex items-center gap-1.5 text-gray-500 hover:text-primary transition-colors"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span className="text-xs font-medium">Comment</span>
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShare(review.id);
                      }}
                      className="flex items-center gap-1.5 text-gray-500 hover:text-primary transition-colors ml-auto"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Load More Trigger */}
            {hasMore && !loading && (
              <div ref={loadMoreRef} className="py-8 flex justify-center">
                {loadingMore && (
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                )}
              </div>
            )}

            {/* Empty State */}
            {!loading && reviews.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UtensilsCrossed className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">No reviews yet</p>
                <p className="text-sm text-gray-400 mt-1">Be the first to share a review!</p>
              </div>
            )}
          </div>
        </div>
      </MainLayout>

      {/* Full Screen Viewer */}
      {selectedReviewIndex !== null && (
        <FullScreenReviewViewer
          reviews={reviews}
          initialIndex={selectedReviewIndex}
          onClose={() => setSelectedReviewIndex(null)}
          onLike={toggleLike}
          onComment={handleComment}
          onShare={handleShare}
        />
      )}
    </>
  );
}

