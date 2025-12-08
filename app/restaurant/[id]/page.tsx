'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { 
  ArrowLeft, Star, Heart, MapPin, Phone, Globe, DollarSign, 
  Users, PenLine, Navigation, Share2, Loader2, Calendar, ThumbsUp
} from 'lucide-react';
import { WriteReviewModal } from '@/components/review/write-review-modal';
import { formatDistanceToNow, format } from 'date-fns';
import Link from 'next/link';

interface Review {
  id: string;
  rating: number;
  title?: string;
  content: string;
  visitDate?: string;
  createdAt: string;
  likesCount: number;
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
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [friendsWhoReviewed, setFriendsWhoReviewed] = useState<Friend[]>([]);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [userHasReviewed, setUserHasReviewed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());
  
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
        setUserHasReviewed(data.userHasReviewed || false);
      }
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWishlist = async () => {
    // TODO: Implement wishlist API call
    setIsWishlisted(!isWishlisted);
  };

  const handleLikeReview = async (reviewId: string) => {
    // TODO: Implement like review API call
    setReviews(reviews.map(r => 
      r.id === reviewId 
        ? { ...r, isLiked: !r.isLiked, likesCount: r.isLiked ? r.likesCount - 1 : r.likesCount + 1 }
        : r
    ));
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

  const toggleReviewExpansion = (reviewId: string) => {
    const newExpanded = new Set(expandedReviews);
    if (newExpanded.has(reviewId)) {
      newExpanded.delete(reviewId);
    } else {
      newExpanded.add(reviewId);
    }
    setExpandedReviews(newExpanded);
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

  const priceLevelText = restaurant.priceLevel ? '$'.repeat(restaurant.priceLevel) : null;

  return (
    <MainLayout>
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
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${
                isWishlisted 
                  ? 'bg-red-50 backdrop-blur-sm' 
                  : 'bg-white/95 backdrop-blur-sm'
              }`}
            >
              <Heart 
                className={`w-5 h-5 ${
                  isWishlisted 
                    ? 'fill-red-500 text-red-500' 
                    : 'text-gray-700'
                }`} 
              />
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
          
          {/* Rating */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-1.5 bg-yellow-50 px-3 py-1.5 rounded-lg">
              <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
              <span className="font-bold text-yellow-700">{restaurant.averageRating.toFixed(1)}</span>
            </div>
            <span className="text-sm text-gray-500">
              {restaurant.totalReviews} {restaurant.totalReviews === 1 ? 'review' : 'reviews'}
            </span>
            {priceLevelText && (
              <>
                <span className="text-gray-300">•</span>
                <span className="text-sm font-semibold text-gray-600">{priceLevelText}</span>
              </>
            )}
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
                  )}
                  {' '}reviewed this place
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
            disabled={userHasReviewed}
            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
              userHasReviewed
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-primary text-white active:scale-95'
            }`}
          >
            <PenLine className="w-4 h-4 inline-block mr-2 -mt-0.5" />
            {userHasReviewed ? 'Already Reviewed' : 'Write Review'}
          </button>
          <button
            onClick={openInMaps}
            className="flex-1 py-3 rounded-xl font-semibold text-sm bg-gray-100 text-gray-700 active:scale-95 transition-all"
          >
            <Navigation className="w-4 h-4 inline-block mr-2 -mt-0.5" />
            Directions
          </button>
        </div>

        {/* Reviews Section */}
        <div className="px-4 py-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Reviews ({reviews.length})
          </h2>

          {reviews.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No reviews yet</p>
              <p className="text-sm text-gray-400 mt-1">Be the first to review!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => {
                const isExpanded = expandedReviews.has(review.id);
                const shouldShowExpand = review.content.length > 200;
                
                return (
                  <div 
                    key={review.id} 
                    className="bg-white rounded-2xl p-4 border border-gray-100"
                  >
                    {/* Reviewer Info */}
                    <Link href={`/profile/${review.user.id}`}>
                      <div className="flex items-center gap-3 mb-3">
                        {review.user.avatarUrl ? (
                          <img
                            src={review.user.avatarUrl}
                            alt={review.user.fullName}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                            {review.user.fullName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{review.user.fullName}</p>
                          <p className="text-xs text-gray-500">@{review.user.username}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-0.5 mb-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3.5 h-3.5 ${
                                  i < review.rating
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'fill-gray-200 text-gray-200'
                                }`}
                              />
                            ))}
                          </div>
                          <p className="text-xs text-gray-400">
                            {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </Link>

                    {/* Review Title */}
                    {review.title && (
                      <Link href={`/review/${review.id}`}>
                        <h3 className="font-semibold text-gray-900 mb-2 hover:text-primary transition-colors cursor-pointer">
                          {review.title}
                        </h3>
                      </Link>
                    )}

                    {/* Review Photos */}
                    {review.photos && review.photos.length > 0 && (
                      <div className="mb-3 -mx-4">
                        <div className="flex gap-2 overflow-x-auto px-4 scrollbar-hide">
                          {review.photos.map((photo, index) => (
                            <Link key={index} href={`/review/${review.id}`}>
                              <img
                                src={photo}
                                alt={`Review photo ${index + 1}`}
                                className="h-48 w-auto rounded-xl object-cover cursor-pointer hover:opacity-95 transition-opacity"
                              />
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Review Content */}
                    {review.content && (
                      <div>
                        <Link href={`/review/${review.id}`}>
                          <p className={`text-sm text-gray-600 leading-relaxed hover:text-gray-900 transition-colors cursor-pointer ${!isExpanded && shouldShowExpand ? 'line-clamp-3' : ''}`}>
                            {review.content}
                          </p>
                        </Link>
                        {shouldShowExpand && (
                          <button
                            onClick={() => toggleReviewExpansion(review.id)}
                            className="text-primary text-sm font-semibold mt-1"
                          >
                            {isExpanded ? 'Show less' : 'Read more'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Visit Date */}
                    {review.visitDate && (
                      <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Visited {format(new Date(review.visitDate), 'MMM d, yyyy')}</span>
                      </div>
                    )}

                    {/* Like Button */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => handleLikeReview(review.id)}
                        className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                          review.isLiked ? 'text-primary' : 'text-gray-500 hover:text-primary'
                        }`}
                      >
                        <ThumbsUp className={`w-4 h-4 ${review.isLiked ? 'fill-current' : ''}`} />
                        <span>{review.likesCount}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Write Review Modal */}
      {restaurant && (
        <WriteReviewModal
          isOpen={showWriteReview}
          onClose={() => setShowWriteReview(false)}
          restaurant={{
            googlePlaceId: restaurant.googlePlaceId || restaurant.id,
            name: restaurant.name,
            address: restaurant.address || '',
            latitude: restaurant.latitude,
            longitude: restaurant.longitude,
            photoUrl: restaurant.imageUrl,
          }}
          onSuccess={() => {
            setShowWriteReview(false);
            fetchRestaurant(); // Refresh data
          }}
        />
      )}
    </MainLayout>
  );
}

