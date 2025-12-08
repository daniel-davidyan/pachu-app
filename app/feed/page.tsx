'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Star, Heart, MapPin, Loader2, Users, Plus, Bookmark } from 'lucide-react';
import { RestaurantFeedCard } from '@/components/feed/restaurant-feed-card';
import { formatDistanceToNow } from 'date-fns';

interface MutualFriend {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface Review {
  id: string;
  rating: number;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  photos: string[];
}

interface RestaurantFeed {
  id: string;
  name: string;
  address?: string;
  imageUrl?: string;
  rating: number;
  totalReviews: number;
  distance?: number;
  matchPercentage: number;
  mutualFriends: MutualFriend[];
  reviews: Review[];
  googlePlaceId?: string;
  latitude: number;
  longitude: number;
}

export default function FeedPage() {
  const [feedMode, setFeedMode] = useState<'following' | 'all'>('all');
  const [restaurants, setRestaurants] = useState<RestaurantFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distanceKm, setDistanceKm] = useState(5);
  const [showHeader, setShowHeader] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const lastScrollY = useRef(0);
  const scrollThreshold = 10; // Minimum scroll distance to trigger hide/show

  // Scroll behavior - hide/show header and bottom nav
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Only trigger on significant scroll
      if (Math.abs(currentScrollY - lastScrollY.current) < scrollThreshold) {
        return;
      }
      
      // Scrolling down - hide
      if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        setShowHeader(false);
      }
      // Scrolling up - show
      else if (currentScrollY < lastScrollY.current) {
        setShowHeader(true);
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

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

  // Fetch restaurants based on mode
  const fetchRestaurants = useCallback(async (pageNum: number) => {
    if (!userLocation) return;
    
    try {
      if (pageNum === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      if (feedMode === 'all') {
        // Fetch real restaurants from Google Places
        const googleResponse = await fetch(
          `/api/restaurants/nearby?latitude=${userLocation.latitude}&longitude=${userLocation.longitude}&radius=${distanceKm * 1000}`
        );
        const googleData = await googleResponse.json();

        if (googleData.restaurants) {
          // Fetch reviews for each restaurant
          const restaurantsWithReviews = await Promise.all(
            googleData.restaurants.slice(pageNum * 5, (pageNum + 1) * 5).map(async (restaurant: any) => {
              try {
                const detailsResponse = await fetch(`/api/restaurants/details?placeId=${restaurant.googlePlaceId}`);
                const detailsData = await detailsResponse.json();
                
                const reviews = (detailsData.reviews || []).slice(0, 10).map((googleReview: any, index: number) => {
                  // Extract photos from Google review if available
                  const reviewPhotos = [];
                  if (googleReview.photos && Array.isArray(googleReview.photos)) {
                    reviewPhotos.push(...googleReview.photos.map((photo: any) => 
                      photo.photo_reference 
                        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`
                        : null
                    ).filter(Boolean));
                  }
                  
                  // If no review photos, use restaurant photos (Google reviews typically don't have individual photos)
                  if (reviewPhotos.length === 0 && detailsData.photos && detailsData.photos[index]) {
                    const photo = detailsData.photos[index];
                    if (photo.photo_reference) {
                      reviewPhotos.push(
                        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`
                      );
                    }
                  }
                  
                  return {
                    id: `${restaurant.id}-${googleReview.author_name}`,
                    rating: googleReview.rating,
                    content: googleReview.text,
                    createdAt: new Date(googleReview.time * 1000).toISOString(),
                    user: {
                      id: googleReview.author_name,
                      username: googleReview.author_name,
                      fullName: googleReview.author_name,
                      avatarUrl: googleReview.profile_photo_url,
                    },
                    photos: reviewPhotos,
                  };
                });

                return {
                  id: restaurant.id,
                  name: restaurant.name,
                  address: restaurant.address,
                  imageUrl: restaurant.photoUrl,
                  rating: restaurant.rating,
                  totalReviews: restaurant.totalReviews || 0,
                  distance: restaurant.distance,
                  matchPercentage: Math.floor(Math.random() * 30 + 70), // 70-100%
                  mutualFriends: [],
                  reviews,
                  googlePlaceId: restaurant.googlePlaceId,
                  latitude: restaurant.latitude,
                  longitude: restaurant.longitude,
                };
              } catch (error) {
                return null;
              }
            })
          );

          const validRestaurants = restaurantsWithReviews.filter(r => r !== null) as RestaurantFeed[];
          
          if (pageNum === 0) {
            setRestaurants(validRestaurants);
          } else {
            setRestaurants(prev => [...prev, ...validRestaurants]);
          }
          setHasMore(googleData.restaurants.length > (pageNum + 1) * 5);
          setPage(pageNum);
        }
      } else {
        // Following mode - fetch from database with mutual friends
        const response = await fetch(
          `/api/feed/following?page=${pageNum}&limit=5&latitude=${userLocation.latitude}&longitude=${userLocation.longitude}`
        );
        const data = await response.json();

        if (data.restaurants) {
          if (pageNum === 0) {
            setRestaurants(data.restaurants);
          } else {
            setRestaurants(prev => [...prev, ...data.restaurants]);
          }
          setHasMore(data.hasMore);
          setPage(pageNum);
        }
      }
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userLocation, feedMode, distanceKm]);

  // Initial load and when mode or distance changes
  useEffect(() => {
    if (userLocation) {
      fetchRestaurants(0);
    }
  }, [userLocation, feedMode, distanceKm, fetchRestaurants]);

  // Infinite scroll observer
  useEffect(() => {
    if (loading || loadingMore || !hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchRestaurants(page + 1);
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
  }, [loading, loadingMore, hasMore, page, fetchRestaurants]);

  return (
    <MainLayout showBottomNav={showHeader}>
      <div className="pb-24 min-h-screen bg-gray-50">
        {/* Header with Tabs */}
        <div 
          className={`sticky top-0 z-20 bg-white border-b border-gray-200 transition-transform duration-300 ease-in-out ${
            showHeader ? 'translate-y-0' : '-translate-y-full'
          }`}
        >
          <div className="px-4 pt-4 pb-3">
            <h1 className="text-xl font-bold text-gray-900 mb-4">Discover</h1>
            
            {/* Following / All Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setFeedMode('following')}
                className={`
                  flex-1 px-4 py-2.5 rounded-full text-sm font-semibold
                  transition-all duration-300 border-2
                  ${feedMode === 'following'
                    ? 'bg-primary/10 text-[#C5459C] border-primary shadow-[0_4px_12px_rgba(197,69,156,0.25)]'
                    : 'bg-white text-gray-600 border-gray-200 shadow-sm hover:border-gray-300'
                  }
                `}
              >
                <Users className="w-4 h-4 inline-block mr-1.5 -mt-0.5" strokeWidth={2} />
                Following
              </button>
              <button
                onClick={() => setFeedMode('all')}
                className={`
                  flex-1 px-4 py-2.5 rounded-full text-sm font-semibold
                  transition-all duration-300 border-2
                  ${feedMode === 'all'
                    ? 'bg-primary/10 text-[#C5459C] border-primary shadow-[0_4px_12px_rgba(197,69,156,0.25)]'
                    : 'bg-white text-gray-600 border-gray-200 shadow-sm hover:border-gray-300'
                  }
                `}
              >
                <MapPin className="w-4 h-4 inline-block mr-1.5 -mt-0.5" strokeWidth={2} />
                All
              </button>
            </div>
          </div>

          {/* Distance Slider for All mode */}
          {feedMode === 'all' && (
            <div className="px-4 pb-3">
              <div className="bg-gray-50 rounded-2xl p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-700">Distance</span>
                  <span className="text-xs font-bold text-primary">{distanceKm} km</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer slider-thumb"
                  style={{
                    background: `linear-gradient(to right, #C5459C 0%, #C5459C ${(distanceKm - 1) / 19 * 100}%, #e5e7eb ${(distanceKm - 1) / 19 * 100}%, #e5e7eb 100%)`
                  }}
                />
                <div className="flex justify-between mt-0.5">
                  <span className="text-[10px] text-gray-400">1 km</span>
                  <span className="text-[10px] text-gray-400">20 km</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Feed Content */}
        <div className="px-4 py-4 space-y-4">
          {/* Loading State */}
          {loading && restaurants.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-gray-500">
                {feedMode === 'following' ? 'Loading restaurants from people you follow...' : 'Finding restaurants near you...'}
              </p>
            </div>
          )}

          {/* Restaurant Cards */}
          {restaurants.map((restaurant) => (
            <RestaurantFeedCard
              key={restaurant.id}
              restaurant={restaurant}
              userLocation={userLocation}
            />
          ))}

          {/* Load More Trigger */}
          {hasMore && !loading && (
            <div ref={loadMoreRef} className="py-8 flex justify-center">
              {loadingMore && (
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              )}
            </div>
          )}

          {/* Empty State */}
          {!loading && restaurants.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No restaurants found</p>
              <p className="text-sm text-gray-400 mt-1">
                {feedMode === 'following' 
                  ? 'Follow people to see their favorite restaurants' 
                  : 'Try increasing the distance range'}
              </p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

