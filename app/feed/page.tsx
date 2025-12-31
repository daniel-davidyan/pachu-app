'use client';

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Star, Heart, MapPin, Loader2, Users, Plus, Bookmark } from 'lucide-react';
import { FeedRestaurantCard } from '@/components/feed/feed-restaurant-card';
import { FeedExperienceCard } from '@/components/feed/feed-experience-card';
import { FiltersDropdown } from '@/components/feed/filters-dropdown';
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

interface City {
  id: string;
  name: string;
  country?: string;
  latitude: number;
  longitude: number;
}

export default function FeedPage() {
  // Always use default values for SSR compatibility
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationFilterEnabled, setLocationFilterEnabled] = useState(true);
  const [distanceKm, setDistanceKm] = useState(5);
  const [showHeader, setShowHeader] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showingSource, setShowingSource] = useState<'following' | 'pachu' | 'google' | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const lastScrollY = useRef(0);
  const scrollThreshold = 50; // Minimum scroll distance to trigger hide/show
  const hasFetchedOnMount = useRef(false);
  const scrollRestored = useRef(false);
  const latestRequestId = useRef(0); // Track latest request to prevent race conditions

  // Restore feed settings IMMEDIATELY
  useLayoutEffect(() => {
    if (scrollRestored.current) return;
    scrollRestored.current = true;

    try {
      const settings = sessionStorage.getItem('pachu_feed_settings');
      if (settings) {
        const data = JSON.parse(settings);
        if (data.locationFilterEnabled !== undefined) setLocationFilterEnabled(data.locationFilterEnabled);
        if (data.distanceKm) setDistanceKm(data.distanceKm);
      }
    } catch (error) {
      // Silently handle errors
    }
  }, []);

  // Restore scroll AFTER content loads
  useEffect(() => {
    if (loading || restaurants.length === 0) return;

    try {
      const saved = sessionStorage.getItem('pachu_feed_scroll');
      if (!saved) return;

      const data = JSON.parse(saved);
      const targetScroll = data.position || 0;
      const timestamp = data.timestamp || 0;
      const age = Date.now() - timestamp;

      if (age < 5 * 60 * 1000 && targetScroll > 0) {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        
        if (maxScroll < targetScroll) {
          // Page not tall enough yet, retry after content loads
          const retryTimeout = setTimeout(() => {
            const newMaxScroll = document.documentElement.scrollHeight - window.innerHeight;
            if (newMaxScroll >= targetScroll) {
              window.scrollTo(0, targetScroll);
            }
          }, 500);
          return () => clearTimeout(retryTimeout);
        } else {
          window.scrollTo(0, targetScroll);
          
          // Verify and fix if needed
          setTimeout(() => {
            if (Math.abs(window.scrollY - targetScroll) > 10) {
              window.scrollTo(0, targetScroll);
            }
          }, 100);
        }
      }
    } catch (error) {
      // Silently handle errors
    }
  }, [loading, restaurants]);

  // Save scroll position continuously (simplified)
  useEffect(() => {
    const saveScroll = () => {
      const scrollPos = window.scrollY;
      if (scrollPos > 0) {
        sessionStorage.setItem('pachu_feed_scroll', JSON.stringify({
          position: scrollPos,
          timestamp: Date.now()
        }));
      }
    };

    // Save on scroll (debounced)
    let timeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(saveScroll, 100);
    };

    // Save settings
    const saveSettings = () => {
      sessionStorage.setItem('pachu_feed_settings', JSON.stringify({
        locationFilterEnabled,
        distanceKm
      }));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    saveSettings();
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      saveScroll();
      saveSettings();
    };
  }, [locationFilterEnabled, distanceKm]);


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
      const currentScrollY = window.scrollY;
      
      // Only trigger on significant scroll
      if (Math.abs(currentScrollY - lastScrollY.current) < scrollThreshold) {
        return;
      }
      
      // Scrolling down - hide
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setShowHeader(false);
        lastScrollY.current = currentScrollY;
      }
      // Scrolling up - show (only if scrolled up significantly)
      else if (currentScrollY < lastScrollY.current - scrollThreshold) {
        setShowHeader(true);
        lastScrollY.current = currentScrollY;
      }
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

  // Fetch restaurants based on priority
  const fetchRestaurants = useCallback(async (pageNum: number) => {
    if (!userLocation) return;
    
    // Increment request ID to track this request
    const requestId = ++latestRequestId.current;
    
    try {
      if (pageNum === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      // Use selected city location or user location
      const searchLocation = selectedCity || userLocation;
      
      // Use new prioritized endpoint
      const radius = locationFilterEnabled ? distanceKm * 1000 : 50000;
      const response = await fetch(
        `/api/feed/prioritized?page=${pageNum}&limit=5&latitude=${searchLocation.latitude}&longitude=${searchLocation.longitude}&radius=${radius}`
      );
      const data = await response.json();

      if (data.restaurants) {
        // Only update state if this is still the latest request
        if (requestId === latestRequestId.current) {
          if (pageNum === 0) {
            setRestaurants(data.restaurants);
            setShowingSource(data.showingSource);
          } else {
            // Deduplicate when appending new restaurants
            setRestaurants(prev => {
              const combined = [...prev, ...data.restaurants];
              const unique = combined.reduce((acc, restaurant) => {
                if (!acc.find((r: RestaurantFeed) => r.id === restaurant.id)) {
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
      // Only clear loading if this is still the latest request
      if (requestId === latestRequestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [userLocation, locationFilterEnabled, distanceKm, selectedCity]);

  // Initial load and when distance or city changes
  useEffect(() => {
    if (!userLocation) return;
    
    // Prevent multiple fetches on initial mount
    if (!hasFetchedOnMount.current) {
      hasFetchedOnMount.current = true;
      fetchRestaurants(0);
      return;
    }
    
    // For subsequent changes (distance or city), fetch new data
    fetchRestaurants(0);
  }, [userLocation, locationFilterEnabled, distanceKm, selectedCity, fetchRestaurants]);

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
    <MainLayout showBottomNav={showHeader && !sheetOpen}>
      <div className="pb-24 min-h-screen bg-gray-50">
        {/* Header with Filters */}
        <div 
          className={`sticky z-20 bg-white border-b border-gray-200 transition-transform duration-300 ease-in-out ${
            showHeader ? 'translate-y-0' : '-translate-y-full'
          }`}
          style={{
            top: 'calc(3.5rem + env(safe-area-inset-top))',
          }}
        >
          <div className="px-4 pt-3 pb-2">
            {/* Nearby Dropdown - Centered */}
            <div className="flex justify-center">
              <FiltersDropdown
                selectedCity={selectedCity}
                onSelectCity={setSelectedCity}
                locationFilterEnabled={locationFilterEnabled}
                setLocationFilterEnabled={setLocationFilterEnabled}
                distanceKm={distanceKm}
                setDistanceKm={setDistanceKm}
              />
            </div>
          </div>
        </div>

        {/* Feed Content */}
        <div className="px-4 py-4 space-y-4">
          {/* Info banner when showing Google reviews */}
          {showingSource === 'google' && restaurants.length > 0 && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-900 mb-1">
                    No Pachu experiences found in this area
                  </p>
                  <p className="text-xs text-blue-700">
                    We're showing reviews from Google to help you discover places. Be the first to share your experience on Pachu!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Info banner when showing all Pachu reviews (not following) */}
          {showingSource === 'pachu' && restaurants.length > 0 && (
            <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-purple-900 mb-1">
                    No experiences from people you follow
                  </p>
                  <p className="text-xs text-purple-700">
                    We're showing all Pachu experiences in this area. Follow people to see their experiences first!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Loading Overlay - shows when switching tabs */}
          {loading && restaurants.length > 0 && (
            <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-30 flex items-center justify-center" style={{ top: 'calc(3.5rem + env(safe-area-inset-top))' }}>
              <div className="flex flex-col items-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-gray-500 font-medium">
                  Discovering restaurants for you...
                </p>
              </div>
            </div>
          )}

          {/* Loading State - shows on initial load */}
          {loading && restaurants.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-gray-500">
                Discovering restaurants for you...
              </p>
            </div>
          )}

          {/* Restaurant Cards */}
          {restaurants.map((restaurant) => (
            showingSource === 'following' ? (
              <FeedExperienceCard
                key={restaurant.id}
                restaurant={restaurant}
                userLocation={userLocation}
                onUpdate={() => fetchRestaurants(0)}
                onSheetStateChange={setSheetOpen}
              />
            ) : (
              <FeedRestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                onUpdate={() => fetchRestaurants(0)}
                showInteractions={showingSource === 'pachu'}
                onSheetStateChange={setSheetOpen}
              />
            )
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
                {locationFilterEnabled 
                  ? 'Try increasing the distance range or disable location filter'
                  : 'No restaurants available at the moment'}
              </p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

