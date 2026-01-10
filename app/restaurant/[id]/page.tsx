'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { MainLayout } from '@/components/layout/main-layout';
import { 
  ArrowLeft, Bookmark, MapPin, Phone, Globe, DollarSign, 
  Users, PenLine, Navigation, Share2, Loader2, Calendar, ThumbsUp, Star, Edit2, Trash2, MoreVertical, Utensils, Clock, ChevronDown, ChevronUp
} from 'lucide-react';
import { WriteReviewModal } from '@/components/review/write-review-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { CompactRating } from '@/components/ui/modern-rating';
import { PostCard, PostCardData } from '@/components/post/post-card';
import { formatDistanceToNow, format } from 'date-fns';
import Link from 'next/link';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/components/ui/toast';
import { formatAddress } from '@/lib/address-utils';
import { useFeedData } from '@/components/providers';
import { cacheKeys } from '@/lib/swr-config';

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
  videos?: Array<{ url: string; thumbnailUrl?: string; durationSeconds?: number }>;
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
  openingHours?: {
    open_now?: boolean;
    weekday_text?: string[];
    periods?: Array<{
      open: { day: number; time: string };
      close?: { day: number; time: string };
    }>;
  };
}

interface RestaurantData {
  restaurant: Restaurant;
  reviews: Review[];
  friendsWhoReviewed: Friend[];
  isWishlisted: boolean;
  showingGoogleReviews?: boolean;
  showingNonFriendReviews?: boolean;
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
  const { getCachedRestaurant } = useFeedData();
  
  const restaurantId = Array.isArray(params.id) ? params.id[0] : params.id;
  
  // Get cached data from feed for instant display
  const cachedData = restaurantId ? getCachedRestaurant(restaurantId) : null;
  
  // Use SWR for data fetching with fallback from feed cache
  const { data: apiData, error, isLoading, mutate } = useSWR<RestaurantData>(
    restaurantId ? cacheKeys.restaurant(restaurantId) : null,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    {
      // Use cached data for instant render, then revalidate
      fallbackData: cachedData as RestaurantData | undefined,
      revalidateOnFocus: false,
      revalidateIfStale: true,
    }
  );
  
  // Merge cached and API data (API takes precedence when available)
  const data = apiData || cachedData;
  const restaurant = data?.restaurant || null;
  const reviews = data?.reviews || [];
  const friendsWhoReviewed = data?.friendsWhoReviewed || [];
  const loading = isLoading && !cachedData;
  
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [loadingWishlist, setLoadingWishlist] = useState(false);
  const [restaurantDbId, setRestaurantDbId] = useState<string | null>(null);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loadingOntopo, setLoadingOntopo] = useState(false);
  const [ontopoUrl, setOntopoUrl] = useState<string | null>(null);
  const [isIsrael, setIsIsrael] = useState(false);
  const [showingGoogleReviews, setShowingGoogleReviews] = useState(false);
  const [showingNonFriendReviews, setShowingNonFriendReviews] = useState(false);
  const [showAllHours, setShowAllHours] = useState(false);
  const [openingHours, setOpeningHours] = useState<Restaurant['openingHours'] | null>(null);
  const [visiblePostId, setVisiblePostId] = useState<string | null>(null);
  const postRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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

  // Update local state when API data arrives
  useEffect(() => {
    if (apiData) {
      setIsWishlisted(apiData.isWishlisted || false);
      setRestaurantDbId(apiData.restaurant?.id || null);
      setShowingGoogleReviews(apiData.showingGoogleReviews || false);
      setShowingNonFriendReviews(apiData.showingNonFriendReviews || false);
    }
  }, [apiData]);

  // Reset ONTOPO state when restaurant changes
  useEffect(() => {
    if (restaurantId) {
      setOntopoUrl(null);
      setIsIsrael(false);
    }
  }, [restaurantId]);

  // Check if restaurant is in Israel and fetch ONTOPO link + opening hours
  useEffect(() => {
    if (!restaurant) return;
    // Skip if opening hours already loaded
    if (openingHours || restaurant.openingHours) return;

    const checkIsraelAndFetchOntopo = async () => {
      try {
        const placeId = restaurant.googlePlaceId || restaurantId;
        const response = await fetch(`/api/restaurants/details?placeId=${placeId}`);
        const data = await response.json();
        
        console.log('Google Places API response:', data); // Debug log
        
        // Update opening hours in local state
        if (data.opening_hours || data.current_opening_hours) {
          const hoursData = data.opening_hours || data.current_opening_hours;
          console.log('Opening hours data:', hoursData); // Debug log
          setOpeningHours(hoursData);
        }
        
        // Check if country is Israel
        const country = data.country || restaurant.address?.toLowerCase();
        const inIsrael = country?.toLowerCase().includes('israel') || 
                         country?.toLowerCase().includes('ישראל');
        
        setIsIsrael(inIsrael);

        // If in Israel, fetch ONTOPO link
        if (inIsrael) {
          const city = data.city || extractCityFromAddress(restaurant.address);
          const ontopoResponse = await fetch(
            `/api/ontopo?name=${encodeURIComponent(restaurant.name)}${city ? `&city=${encodeURIComponent(city)}` : ''}`
          );
          
          if (ontopoResponse.ok) {
            const ontopoData = await ontopoResponse.json();
            setOntopoUrl(ontopoData.url);
          } else {
            console.log('ONTOPO not available for this restaurant');
            setOntopoUrl(null);
          }
        }
      } catch (error) {
        console.error('Error checking Israel/ONTOPO/OpeningHours:', error);
        setOntopoUrl(null);
      }
    };

    checkIsraelAndFetchOntopo();
  }, [restaurant?.id, restaurantId, openingHours, restaurant?.openingHours]);

  const extractCityFromAddress = (address?: string) => {
    if (!address) return '';
    // Try to extract city from address (e.g., "Street 123, Tel Aviv" -> "Tel Aviv")
    const parts = address.split(',');
    return parts.length > 1 ? parts[parts.length - 1].trim() : '';
  };

  // Refetch restaurant data (SWR mutate)
  const fetchRestaurant = () => {
    mutate();
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
    const review = reviews.find((r: Review) => r.id === post.id);
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
        showToast('Experience deleted successfully', 'success');
        fetchRestaurant(); // Refresh the restaurant data via SWR mutate
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

  const handleOntopo = async () => {
    if (loadingOntopo) return;

    // If we already have the ONTOPO URL, open it
    if (ontopoUrl) {
      window.open(ontopoUrl, '_blank');
      return;
    }

    // Otherwise, try to fetch it
    setLoadingOntopo(true);
    try {
      const city = extractCityFromAddress(restaurant?.address);
      const response = await fetch(
        `/api/ontopo?name=${encodeURIComponent(restaurant?.name || '')}${city ? `&city=${encodeURIComponent(city)}` : ''}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setOntopoUrl(data.url);
        window.open(data.url, '_blank');
      } else {
        showToast('No ONTOPO reservation available', 'error');
      }
    } catch (error) {
      console.error('Error fetching ONTOPO link:', error);
      showToast('Failed to load reservation page', 'error');
    } finally {
      setLoadingOntopo(false);
    }
  };

  if (loading) {
    return (
      <MainLayout showTopBar={false}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!restaurant) {
    return (
      <MainLayout showTopBar={false}>
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
    <MainLayout showTopBar={false} showBottomNav={!showWriteReview && !sheetOpen}>
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Header Image - extends to top of screen */}
        <div 
          className="relative bg-gray-200"
          style={{ 
            height: 'calc(18rem + env(safe-area-inset-top))',
            marginTop: 'calc(-1 * env(safe-area-inset-top))',
          }}
        >
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
            className="absolute left-4 w-10 h-10 rounded-full bg-white/95 backdrop-blur-sm shadow-lg flex items-center justify-center z-20"
            style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>

          {/* Action Buttons */}
          <div 
            className="absolute right-4 flex gap-2 z-20"
            style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}
          >
            {restaurant.website && (
              <button
                onClick={() => window.open(restaurant.website, '_blank')}
                className="w-12 h-12 rounded-full bg-white/95 backdrop-blur-sm shadow-lg flex items-center justify-center"
              >
                <Globe className="w-5 h-5 text-gray-700" />
              </button>
            )}
            <button
              onClick={handleWishlist}
              disabled={loadingWishlist}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg disabled:opacity-50 ${
                isWishlisted
                  ? 'bg-white backdrop-blur-sm'
                  : 'bg-white/95 backdrop-blur-sm'
              }`}
            >
              {loadingWishlist ? (
                <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
              ) : (
                <Bookmark
                  className={`w-5 h-5 ${
                    isWishlisted
                      ? 'fill-primary text-primary'
                    : 'text-gray-700'
                  }`}
                />
              )}
            </button>
            <button
              onClick={handleShare}
              className="w-12 h-12 rounded-full bg-white/95 backdrop-blur-sm shadow-lg flex items-center justify-center"
            >
              <Share2 className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Floating Restaurant Info Card - overlaps image by ~15% */}
        <div className="relative -mt-10 px-4 z-10">
          <div className="bg-white rounded-3xl shadow-xl p-5 relative">
            {/* Restaurant Story Icon with Instagram-like ring */}
            <div className="absolute -top-5 right-5 p-[3px] rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 shadow-lg">
              <div className="bg-white p-[2.5px] rounded-full">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                  <Utensils className="w-6 h-6 text-slate-600" />
                </div>
              </div>
            </div>

            {/* Restaurant Name */}
            <h1 className="text-2xl font-bold text-gray-900 mb-3 pr-16">{restaurant.name}</h1>
            
            {/* Match Percentage */}
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm font-bold text-gray-900">{Math.round((restaurant.averageRating / 5) * 100)}% Match</span>
                </div>
              </div>
              <span className="text-xs text-gray-500">Based on your taste</span>
            </div>

            {/* Address */}
            {restaurant.address && (
              <div className="flex items-start gap-2 text-sm mb-4">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600">{formatAddress(restaurant.address)}</span>
              </div>
            )}

            {/* Phone */}
            {restaurant.phone && (
              <div className="flex items-center gap-2 text-sm mb-4">
                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <a href={`tel:${restaurant.phone}`} className="text-primary hover:underline font-medium">
                  {restaurant.phone}
                </a>
              </div>
            )}

            {/* Opening Hours */}
            {restaurant.openingHours && restaurant.openingHours.weekday_text && restaurant.openingHours.weekday_text.length > 0 && (
              <div className="mb-5">
                <button
                  onClick={() => setShowAllHours(!showAllHours)}
                  className="w-full"
                >
                  <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                      restaurant.openingHours.open_now 
                        ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' 
                        : 'bg-gray-400 shadow-lg shadow-gray-400/20'
                    }`}>
                      <Clock className="w-5 h-5 text-white" strokeWidth={2} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-gray-900">Hours</span>
                        {restaurant.openingHours.open_now !== undefined && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            restaurant.openingHours.open_now 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {restaurant.openingHours.open_now ? 'Open Now' : 'Closed'}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {/* Today's hours */}
                        <div className="text-xs text-gray-600 font-medium">
                          {restaurant.openingHours.weekday_text[(new Date().getDay() + 6) % 7]}
                        </div>
                        
                        {/* All hours - expandable */}
                        {showAllHours && (
                          <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5">
                            {restaurant.openingHours.weekday_text.map((day: string, index: number) => {
                              const isToday = index === (new Date().getDay() + 6) % 7;
                              return (
                                <div 
                                  key={index} 
                                  className={`text-xs flex justify-between ${
                                    isToday 
                                      ? 'font-bold text-gray-900' 
                                      : 'text-gray-600'
                                  }`}
                                >
                                  <span>{day.split(': ')[0]}</span>
                                  <span>{day.split(': ')[1]}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    {showAllHours ? (
                      <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0 mt-2" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 mt-2" />
                    )}
                  </div>
                </button>
              </div>
            )}

            {/* Action Buttons - Modern Grid Layout */}
            <div className={`grid gap-2.5 ${isIsrael ? 'grid-cols-4' : 'grid-cols-3'}`}>
              {/* Share Experience */}
              <button
                onClick={() => setShowWriteReview(true)}
                className="flex flex-col items-center justify-center py-3.5 rounded-2xl font-medium text-xs bg-rose-50 text-rose-700 active:scale-95 transition-all border border-rose-100 hover:bg-rose-100"
              >
                <PenLine className="w-5 h-5 mb-1.5" strokeWidth={1.5} />
                <span>Experience</span>
              </button>


              {/* Directions */}
              <button
                onClick={openInMaps}
                className="flex flex-col items-center justify-center py-3.5 rounded-2xl font-medium text-xs bg-gray-50 text-gray-700 active:scale-95 transition-all border border-gray-200 hover:bg-gray-100"
              >
                <Navigation className="w-5 h-5 mb-1.5" strokeWidth={1.5} />
                <span>Navigate</span>
              </button>

              {/* Go to Map */}
              <button
                onClick={() => {
                  const placeId = restaurant.googlePlaceId || restaurant.id;
                  router.push(`/map?restaurantId=${encodeURIComponent(placeId)}&lat=${restaurant.latitude}&lng=${restaurant.longitude}`);
                }}
                className="flex flex-col items-center justify-center py-3.5 rounded-2xl font-medium text-xs bg-blue-50 text-blue-700 active:scale-95 transition-all border border-blue-100 hover:bg-blue-100"
              >
                <MapPin className="w-5 h-5 mb-1.5" strokeWidth={1.5} />
                <span>Map</span>
              </button>
              
              {/* Reserve Table - Only for Israeli restaurants */}
              {isIsrael && (
                <button
                  onClick={handleOntopo}
                  disabled={loadingOntopo}
                  className="flex flex-col items-center justify-center py-3.5 rounded-2xl font-medium text-xs bg-emerald-50 text-emerald-700 active:scale-95 transition-all border border-emerald-100 hover:bg-emerald-100 disabled:opacity-50"
                >
                  {loadingOntopo ? (
                    <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} />
                  ) : (
                    <>
                      <Calendar className="w-5 h-5 mb-1.5" strokeWidth={1.5} />
                      <span>Reserve</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Experiences Section */}
        <div className="px-4 py-2 mt-4">
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            Experiences ({reviews.length})
          </h2>

          {/* Info banner when showing Google/non-friend reviews */}
          {(showingGoogleReviews || showingNonFriendReviews) && reviews.length > 0 && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  {user && friendsWhoReviewed.length === 0 ? (
                    // User is logged in and has friends but they haven't reviewed
                    <>
                      <p className="text-sm font-semibold text-blue-900 mb-1">
                        None of your friends have shared their experience here yet
                      </p>
                      <p className="text-xs text-blue-700">
                        {showingGoogleReviews 
                          ? "We're showing reviews from Google to help you discover this place. Be the first of your friends to share your experience!"
                          : "We're showing all available reviews to help you discover this place. Be the first of your friends to share your experience!"
                        }
                      </p>
                    </>
                  ) : (
                    // User not logged in or no friends - general message
                    <>
                      <p className="text-sm font-semibold text-blue-900 mb-1">
                        Showing reviews from Google
                      </p>
                      <p className="text-xs text-blue-700">
                        These reviews are from Google Places. Share your own experience to help others discover this place!
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

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
              {reviews.map((review: Review) => (
                <div
                  key={review.id}
                  ref={setPostRef(review.id)}
                  data-post-id={review.id}
                >
                  <PostCard
                    post={review}
                    showRestaurantInfo={false}
                    onEdit={handleEditReview}
                    onDelete={handleDeleteReview}
                    onSheetStateChange={setSheetOpen}
                    onUpdate={fetchRestaurant}
                    isVisible={visiblePostId === review.id}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Write Review Modal */}
      {restaurant && (
        <WriteReviewModal
          key={`review-${editingReview?.id || 'new'}-${showWriteReview}`}
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

