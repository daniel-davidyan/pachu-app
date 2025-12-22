'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { 
  ArrowLeft, Heart, MapPin, Phone, Globe, DollarSign, 
  Users, PenLine, Navigation, Share2, Loader2, Calendar, ThumbsUp, Star, Edit2, Trash2, MoreVertical
} from 'lucide-react';
import { WriteReviewModal } from '@/components/review/write-review-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { CompactRating } from '@/components/ui/modern-rating';
import { PostCard, PostCardData } from '@/components/post/post-card';
import { formatDistanceToNow, format } from 'date-fns';
import Link from 'next/link';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/components/ui/toast';

interface Review {
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
}

interface Restaurant {
  id: string;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  website?: string;
  priceLevel?: number;
  cuisineTypes: string[];
  imageUrl?: string;
  averageRating: number;
  totalReviews: number;
  googlePlaceId?: string;
  latitude: number;
  longitude: number;
}

interface Friend {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
}

export default function RestaurantPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const { showToast } = useToast();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [friendsWhoReviewed, setFriendsWhoReviewed] = useState<Friend[]>([]);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [loadingWishlist, setLoadingWishlist] = useState(false);
  const [restaurantDbId, setRestaurantDbId] = useState<string | null>(null);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  
  const restaurantId = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    if (restaurantId) {
      fetchRestaurant();
    }
  }, [restaurantId]);

  const fetchRestaurant = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/restaurants/${restaurantId}`);
      const data = await response.json();

      if (data.restaurant) {
        setRestaurant(data.restaurant);
        setReviews(data.reviews || []);
        setFriendsWhoReviewed(data.friendsWhoReviewed || []);
        setIsWishlisted(data.isWishlisted || false);
        setRestaurantDbId(data.restaurant.id);
      }
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWishlist = async () => {
    if (loadingWishlist || !restaurant) return;
    
    setLoadingWishlist(true);
    const newWishlistState = !isWishlisted;
    setIsWishlisted(newWishlistState);
    
    try {
      if (newWishlistState) {
        // Add to wishlist
        const response = await fetch('/api/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            googlePlaceId: restaurant.googlePlaceId || restaurantId,
            name: restaurant.name,
            address: restaurant.address,
            imageUrl: restaurant.imageUrl,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to add to wishlist');
        }
      } else {
        // Remove from wishlist
        if (restaurantDbId) {
          const response = await fetch(`/api/wishlist?restaurantId=${restaurantDbId}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            throw new Error('Failed to remove from wishlist');
          }
        }
      }
    } catch (error) {
      console.error('Error updating wishlist:', error);
      // Revert on error
      setIsWishlisted(!newWishlistState);
    } finally {
      setLoadingWishlist(false);
    }
  };

  const handleEditReview = (post: PostCardData) => {
    const review = reviews.find(r => r.id === post.id);
    if (review) {
      setEditingReview(review);
      setShowWriteReview(true);
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
        fetchRestaurant(); // Refresh the restaurant data
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

  const openInMaps = () => {
    if (restaurant) {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${restaurant.latitude},${restaurant.longitude}`;
      window.open(mapsUrl, '_blank');
    }
  };

  const handleShare = async () => {
    if (navigator.share && restaurant) {
      try {
        await navigator.share({
          title: restaurant.name,
          text: `Check out ${restaurant.name} on Pachu!`,
          url: window.location.href,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!restaurant) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <p className="text-gray-500 mb-4">Restaurant not found</p>
          <button 
            onClick={() => router.back()}
            className="text-primary font-semibold"
          >
            Go Back
          </button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showBottomNav={!showWriteReview && !sheetOpen}>
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Header Image */}
        <div className="relative h-64 bg-gray-200">
          {restaurant.imageUrl ? (
            <img 
              src={restaurant.imageUrl} 
              alt={restaurant.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10">
              <span className="text-8xl">🍽️</span>
            </div>
          )}
          
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/95 backdrop-blur-sm shadow-lg flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>

          {/* Action Buttons */}
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={handleWishlist}
              disabled={loadingWishlist}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg disabled:opacity-50 ${
                isWishlisted
                  ? 'bg-red-50 backdrop-blur-sm'
                  : 'bg-white/95 backdrop-blur-sm'
              }`}
            >
              {loadingWishlist ? (
                <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
              ) : (
                <Heart
                  className={`w-5 h-5 ${
                    isWishlisted
                      ? 'fill-red-500 text-red-500'
                    : 'text-gray-700'
                  }`}
                />
              )}
            </button>
            <button
              onClick={handleShare}
              className="w-10 h-10 rounded-full bg-white/95 backdrop-blur-sm shadow-lg flex items-center justify-center"
            >
              <Share2 className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Restaurant Info */}
        <div className="bg-white px-4 py-5 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{restaurant.name}</h1>
          
          {/* Match Percentage */}
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-white border border-gray-200 rounded-full px-3 py-1.5 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-green-400 to-green-500 animate-pulse" />
                <span className="text-sm font-bold text-gray-900">{Math.round((restaurant.averageRating / 5) * 100)}%</span>
                <span className="text-[10px] text-gray-500 font-medium">match</span>
              </div>
            </div>
            <span className="text-sm text-gray-500">
              {restaurant.totalReviews} {restaurant.totalReviews === 1 ? 'experience' : 'experiences'}
            </span>
          </div>

          {/* Cuisine Types */}
          {restaurant.cuisineTypes.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {restaurant.cuisineTypes.map((cuisine, index) => (
                <span 
                  key={index}
                  className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full"
                >
                  {cuisine}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {restaurant.description && (
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              {restaurant.description}
            </p>
          )}

          {/* Friends Who Reviewed */}
          {friendsWhoReviewed.length > 0 && (
            <div className="bg-primary/5 rounded-xl p-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {friendsWhoReviewed.slice(0, 3).map((friend) => (
                    friend.avatarUrl ? (
                      <img
                        key={friend.id}
                        src={friend.avatarUrl}
                        alt={friend.fullName}
                        className="w-7 h-7 rounded-full border-2 border-white object-cover"
                      />
                    ) : (
                      <div
                        key={friend.id}
                        className="w-7 h-7 rounded-full border-2 border-white bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center"
                      >
                        <span className="text-xs font-bold text-white">
                          {friend.fullName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )
                  ))}
                </div>
                <p className="text-xs text-gray-700">
                  <span className="font-semibold">{friendsWhoReviewed[0].fullName}</span>
                  {friendsWhoReviewed.length > 1 && (
                    <> and {friendsWhoReviewed.length - 1} other friend{friendsWhoReviewed.length > 2 ? 's' : ''}</>
                  )                  }
                  {' '}experienced this place
                </p>
              </div>
            </div>
          )}

          {/* Contact Info */}
          <div className="space-y-2">
            {restaurant.address && (
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600">{restaurant.address}</span>
              </div>
            )}
            {restaurant.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <a href={`tel:${restaurant.phone}`} className="text-primary hover:underline">
                  {restaurant.phone}
                </a>
              </div>
            )}
            {restaurant.website && (
              <div className="flex items-center gap-3 text-sm">
                <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <a 
                  href={restaurant.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline truncate"
                >
                  Website
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white px-4 py-4 border-b border-gray-200 flex gap-3">
          <button
            onClick={() => setShowWriteReview(true)}
            className="flex-1 py-3 rounded-xl font-semibold text-sm bg-primary text-white active:scale-95 transition-all"
          >
            <PenLine className="w-4 h-4 inline-block mr-2 -mt-0.5" />
            Share Experience
          </button>
          <button
            onClick={openInMaps}
            className="flex-1 py-3 rounded-xl font-semibold text-sm bg-gray-100 text-gray-700 active:scale-95 transition-all"
          >
            <Navigation className="w-4 h-4 inline-block mr-2 -mt-0.5" />
            Directions
          </button>
        </div>

        {/* Experiences Section */}
        <div className="px-4 py-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Experiences ({reviews.length})
          </h2>

          {reviews.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No experiences yet</p>
              <p className="text-sm text-gray-400 mt-1">Be the first to share your experience!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <PostCard
                  key={review.id}
                  post={review}
                  showRestaurantInfo={false}
                  onEdit={handleEditReview}
                  onDelete={handleDeleteReview}
                  onSheetStateChange={setSheetOpen}
                  onUpdate={fetchRestaurant}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Write Review Modal */}
      {restaurant && (
        <WriteReviewModal
          isOpen={showWriteReview}
          onClose={() => {
            setShowWriteReview(false);
            setEditingReview(null);
          }}
          restaurant={{
            googlePlaceId: restaurant.googlePlaceId || restaurant.id,
            name: restaurant.name,
            address: restaurant.address || '',
            latitude: restaurant.latitude,
            longitude: restaurant.longitude,
            photoUrl: restaurant.imageUrl,
          }}
          existingReview={editingReview ? {
            id: editingReview.id,
            rating: editingReview.rating,
            content: editingReview.content || '',
            photos: editingReview.photos || [],
          } : undefined}
          onSuccess={() => {
            setShowWriteReview(false);
            setEditingReview(null);
            fetchRestaurant(); // Refresh data
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

