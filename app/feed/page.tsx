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
  // Always use default values for SSR compatibility
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
  const restoringScroll = useRef(false);
  const savedStateRef = useRef<any>(null);
  const hasRestoredState = useRef(false);

  // Restore saved state from sessionStorage (client-side only)
  useEffect(() => {
    if (hasRestoredState.current) return;
    
    try {
      const saved = sessionStorage.getItem('feedState');
      if (saved) {
        const savedState = JSON.parse(saved);
        
        // Validate saved state - don't restore if too old or invalid
        const age = Date.now() - (savedState.timestamp || 0);
        if (age < 5 * 60 * 1000 && savedState.feedMode && savedState.restaurants) {
          savedStateRef.current = savedState;
          
          // Restore feed mode and distance
          if (savedState.feedMode) setFeedMode(savedState.feedMode);
          if (savedState.distanceKm) setDistanceKm(savedState.distanceKm);
        } else {
          // Clear stale cache
          sessionStorage.removeItem('feedState');
        }
        
        hasRestoredState.current = true;
      }
    } catch (error) {
      console.error('Error restoring feed state:', error);
      sessionStorage.removeItem('feedState');
    }
  }, []);

  // Save feed state and restaurants data before navigation
  useEffect(() => {
    // Only save if we have restaurants and not loading
    if (loading || restaurants.length === 0) return;
    
    const saveState = () => {
      const state = {
        feedMode,
        distanceKm,
        scrollPosition: window.scrollY,
        restaurants: restaurants,
        timestamp: Date.now(),
      };
      sessionStorage.setItem('feedState', JSON.stringify(state));
    };

    // Save state on scroll (debounced)
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(saveState, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Save state periodically and before leaving
    const saveInterval = setInterval(saveState, 3000);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearInterval(saveInterval);
      saveState();
    };
  }, [feedMode, distanceKm, restaurants, loading]);

  // Restore scroll position after content loads
  useEffect(() => {
    const savedState = savedStateRef.current;
    if (!savedState?.scrollPosition || restoringScroll.current) return;
    
    // Wait for restaurants to load
    if (loading || restaurants.length === 0) return;
    
    restoringScroll.current = true;
    const targetScroll = savedState.scrollPosition;
    
    console.log('Attempting to restore scroll to:', targetScroll);
    
    // Aggressive scroll restoration with multiple attempts
    let attempts = 0;
    const maxAttempts = 20;
    
    const restoreScroll = () => {
      attempts++;
      const currentScroll = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      
      // If we're already at the right position, we're done
      if (Math.abs(currentScroll - targetScroll) < 10) {
        console.log('Scroll restored successfully at:', currentScroll);
        restoringScroll.current = false;
        return;
      }
      
      // If we have enough content or we've tried enough times, scroll now
      if (maxScroll >= targetScroll * 0.7 || attempts >= maxAttempts) {
        window.scrollTo({
          top: targetScroll,
          behavior: 'instant' as ScrollBehavior,
        });
        
        // Keep trying for a bit in case something resets it
        if (attempts < maxAttempts) {
          requestAnimationFrame(restoreScroll);
        } else {
          console.log('Scroll restoration completed after', attempts, 'attempts');
          restoringScroll.current = false;
        }
      } else {
        // Content not ready yet, try again
        requestAnimationFrame(restoreScroll);
      }
    };
    
    // Start restoration after a small delay
    const timeoutId = setTimeout(() => {
      restoreScroll();
    }, 50);
    
    return () => clearTimeout(timeoutId);
  }, [loading, restaurants]);

  // Prevent Next.js from scrolling to top on navigation
  useEffect(() => {
    // Override history scrollRestoration
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    
    return () => {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'auto';
      }
    };
  }, []);

  // Scroll behavior - hide/show header and bottom nav
  useEffect(() => {
    const handleScroll = () => {
      // Don't hide/show header while restoring scroll
      if (restoringScroll.current) return;
      
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
  const fetchRestaurants = useCallback(async (pageNum: number, skipCache = false) => {
    if (!userLocation) return;
    
    // Try to use cached data on first load (only if same mode and within 2 minutes)
    const savedState = savedStateRef.current;
    if (
      pageNum === 0 && 
      !skipCache && 
      savedState?.restaurants && 
      savedState?.restaurants.length > 0 &&
      savedState?.timestamp &&
      savedState?.feedMode === feedMode
    ) {
      const age = Date.now() - savedState.timestamp;
      // Use cache if less than 2 minutes old and same feed mode
      if (age < 2 * 60 * 1000) {
        console.log('Using cached restaurants:', savedState.restaurants.length);
        setRestaurants(savedState.restaurants);
        setLoading(false);
        setHasMore(true);
        return;
      }
    }
    
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
            // Deduplicate when appending new restaurants
            setRestaurants(prev => {
              const combined = [...prev, ...validRestaurants];
              const unique = combined.reduce((acc, restaurant) => {
                if (!acc.find(r => r.id === restaurant.id)) {
                  acc.push(restaurant);
                }
                return acc;
              }, [] as RestaurantFeed[]);
              return unique;
            });
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
            // Deduplicate when appending new restaurants
            setRestaurants(prev => {
              const combined = [...prev, ...data.restaurants];
              const unique = combined.reduce((acc, restaurant) => {
                if (!acc.find(r => r.id === restaurant.id)) {
                  acc.push(restaurant);
                }
                return acc;
              }, [] as RestaurantFeed[]);
              return unique;
            });
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
      // Skip cache if mode or distance changed
      const savedState = savedStateRef.current;
      const skipCache = savedState && (
        savedState.feedMode !== feedMode || 
        savedState.distanceKm !== distanceKm
      );
      fetchRestaurants(0, skipCache);
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

