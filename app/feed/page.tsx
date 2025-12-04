'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { WriteReviewModal } from '@/components/review/write-review-modal';
import { UtensilsCrossed, Hotel, Briefcase, Coffee, Wine, Star, Heart, MessageCircle, Share2, MapPin, Loader2, Users, Plus } from 'lucide-react';

interface Review {
  id: string;
  restaurantName: string;
  restaurantPhoto: string;
  rating: number;
  reviewText: string;
  authorName: string;
  authorPhoto?: string;
  timeAgo: string;
  isGoogle: boolean;
  address?: string;
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
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedReviews, setLikedReviews] = useState<Set<string>>(new Set());
  const [showWriteReview, setShowWriteReview] = useState(false);

  // Fetch reviews (friends first, then Google for cold start)
  useEffect(() => {
    const fetchReviews = async () => {
      setLoading(true);
      try {
        // First try to get friends' reviews
        const friendsResponse = await fetch('/api/restaurants/friends-reviews');
        const friendsData = await friendsResponse.json();
        
        if (friendsData.restaurants?.length > 0) {
          // Transform to review format
          const friendReviews = friendsData.restaurants.map((r: any) => ({
            id: r.id,
            restaurantName: r.name,
            restaurantPhoto: r.photoUrl,
            rating: r.rating,
            reviewText: 'Great place! Loved the atmosphere and food.',
            authorName: 'Friend',
            timeAgo: 'Recently',
            isGoogle: false,
            address: r.address
          }));
          setReviews(friendReviews);
        } else {
          // Cold start: Get nearby restaurants from Google
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          }).catch(() => ({ coords: { latitude: 32.0853, longitude: 34.7818 } } as GeolocationPosition));
          
          const googleResponse = await fetch(
            `/api/restaurants/nearby?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&radius=3000`
          );
          const googleData = await googleResponse.json();
          
          // Transform to review format with fake reviews for demo
          const googleReviews = (googleData.restaurants || []).slice(0, 10).map((r: any, index: number) => ({
            id: r.id,
            restaurantName: r.name,
            restaurantPhoto: r.photoUrl,
            rating: r.rating,
            reviewText: getRandomReviewText(),
            authorName: getRandomName(),
            authorPhoto: undefined,
            timeAgo: getRandomTimeAgo(),
            isGoogle: true,
            address: r.address
          }));
          setReviews(googleReviews);
        }
      } catch (error) {
        console.error('Error fetching reviews:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, []);

  const toggleLike = (reviewId: string) => {
    setLikedReviews(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reviewId)) {
        newSet.delete(reviewId);
      } else {
        newSet.add(reviewId);
      }
      return newSet;
    });
  };

  return (
    <MainLayout>
      <div className="pb-24 min-h-screen bg-gray-100">
        {/* Header */}
        <div className="px-4 pt-2 pb-3 bg-white -mx-0 mb-2">
          <h1 className="text-xl font-bold text-gray-900">Feed</h1>
        </div>

        {/* Category Carousel */}
        <div className="px-4 mb-4">
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
                      ? 'bg-primary/10 text-primary border-primary' 
                      : isDisabled
                        ? 'bg-white text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} strokeWidth={2} />
                  <span>{cat.name}</span>
                  {isDisabled && (
                    <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">Soon</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Feed Content */}
        <div className="px-4 space-y-4">
          {/* Cold Start Notice */}
          {reviews.length > 0 && reviews[0]?.isGoogle && (
            <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl p-4 border border-primary/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">Popular near you</p>
                  <p className="text-xs text-gray-600">Add friends to see their reviews!</p>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-gray-500">Finding reviews near you...</p>
            </div>
          )}

          {/* Review Cards */}
          {!loading && reviews.map((review) => (
            <div key={review.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Author Header */}
              <div className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-bold text-sm">
                  {review.authorName.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{review.authorName}</p>
                    {review.isGoogle && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Google</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{review.timeAgo}</p>
                </div>
              </div>

              {/* Restaurant Photo */}
              {review.restaurantPhoto && (
                <div className="relative aspect-[16/10] bg-gray-100">
                  <img 
                    src={review.restaurantPhoto} 
                    alt={review.restaurantName}
                    className="w-full h-full object-cover"
                  />
                  {/* Restaurant Name Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                    <h3 className="text-white font-bold text-lg">{review.restaurantName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-0.5 bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs font-semibold text-white">{review.rating.toFixed(1)}</span>
                      </div>
                      {review.address && (
                        <div className="flex items-center gap-1 text-white/80">
                          <MapPin className="w-3 h-3" />
                          <span className="text-xs truncate max-w-[150px]">{review.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Review Text */}
              <div className="p-4">
                <p className="text-sm text-gray-700 leading-relaxed">{review.reviewText}</p>
              </div>

              {/* Actions */}
              <div className="px-4 pb-4 flex items-center gap-4">
                <button 
                  onClick={() => toggleLike(review.id)}
                  className={`flex items-center gap-1.5 transition-colors ${
                    likedReviews.has(review.id) ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
                  }`}
                >
                  <Heart className={`w-5 h-5 ${likedReviews.has(review.id) ? 'fill-current' : ''}`} />
                  <span className="text-xs font-medium">Like</span>
                </button>
                <button className="flex items-center gap-1.5 text-gray-500 hover:text-primary transition-colors">
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-xs font-medium">Comment</span>
                </button>
                <button className="flex items-center gap-1.5 text-gray-500 hover:text-primary transition-colors ml-auto">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}

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
      {/* Floating Write Review Button */}
      <button
        onClick={() => setShowWriteReview(true)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-primary text-white rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary/90 transition-all active:scale-95 z-40"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Write Review Modal */}
      <WriteReviewModal
        isOpen={showWriteReview}
        onClose={() => setShowWriteReview(false)}
        onSuccess={() => {
          // Refresh feed
          window.location.reload();
        }}
      />
    </MainLayout>
  );
}

// Helper functions for demo data
function getRandomReviewText(): string {
  const reviews = [
    "Amazing food and great atmosphere! Definitely coming back soon.",
    "Best restaurant in the area. The service was impeccable.",
    "Tried this place for the first time and was blown away!",
    "Great value for money. The portions are generous.",
    "Cozy ambiance and delicious dishes. Highly recommend!",
    "Perfect spot for a date night. Loved every bite.",
    "The flavors were incredible. A must-visit!",
    "Fantastic experience from start to finish.",
  ];
  return reviews[Math.floor(Math.random() * reviews.length)];
}

function getRandomName(): string {
  const names = ['Alex M.', 'Sarah K.', 'David L.', 'Emma R.', 'Michael S.', 'Lisa T.', 'James W.', 'Anna P.'];
  return names[Math.floor(Math.random() * names.length)];
}

function getRandomTimeAgo(): string {
  const times = ['2 hours ago', '5 hours ago', 'Yesterday', '2 days ago', '3 days ago', 'Last week'];
  return times[Math.floor(Math.random() * times.length)];
}

