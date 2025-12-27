'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { BottomNav } from '@/components/layout/bottom-nav';
import { RestaurantCard } from '@/components/map/restaurant-card';
import { AIChatSheet, RestaurantFilters } from '@/components/map/ai-chat-sheet';
import { Loader2, UtensilsCrossed, Hotel, Home, Landmark, Car, MapPin } from 'lucide-react';
import type { Restaurant } from '@/components/map/mapbox';
import type mapboxgl from 'mapbox-gl';
import { useToast } from '@/components/ui/toast';

// Dynamically import Mapbox with no SSR to avoid build issues
const Mapbox = dynamic(() => import('@/components/map/mapbox').then(mod => mod.Mapbox), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-gradient-to-b from-gray-100 to-gray-200">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
        <p className="text-sm text-gray-500">Loading map...</p>
      </div>
    </div>
  )
});

const categories = [
  { id: 'food-drinks', name: 'Food & Drinks', icon: UtensilsCrossed, active: true, color: '#C5459C' },
  { id: 'hotels', name: 'Hotels', icon: Hotel, active: false, color: '#6366F1' },
  { id: 'cabins', name: 'Cabins', icon: Home, active: false, color: '#8B4513' },
  { id: 'attractions', name: 'Attractions', icon: Landmark, active: false, color: '#F97316' },
  { id: 'car-services', name: 'Car Services', icon: Car, active: false, color: '#10B981' },
];

function MapPageContent() {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [filters, setFilters] = useState<RestaurantFilters>({ query: '' });
  const [activeCategory, setActiveCategory] = useState('food-drinks');
  const [showChat, setShowChat] = useState(true);
  const [highlightedRestaurants, setHighlightedRestaurants] = useState<string[]>([]);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [isRecentering, setIsRecentering] = useState(false);
  const [chatActive, setChatActive] = useState(false);
  const [chatHeight, setChatHeight] = useState(200);
  const [openNow, setOpenNow] = useState(false);
  const [viewMode, setViewMode] = useState<'following' | 'all'>('all');
  const [isTogglingView, setIsTogglingView] = useState(false);
  const [showViewDropup, setShowViewDropup] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [hasHandledUrlParams, setHasHandledUrlParams] = useState(false);

  const handleViewModeChange = (mode: 'following' | 'all') => {
    if (mode !== viewMode) {
      setIsTogglingView(true);
      setViewMode(mode);
      setShowViewDropup(false);
      setTimeout(() => setIsTogglingView(false), 600);
    }
  };

  const handleRecenterMap = () => {
    setIsRecentering(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(newLocation);
          
          // Immediately center the map on the new location
          if (mapRef.current) {
            mapRef.current.flyTo({
              center: [newLocation.lng, newLocation.lat],
              zoom: 15.5,
              duration: 1500
            });
          }
          
          // Reset loading state after animation
          setTimeout(() => setIsRecentering(false), 1500);
        },
        (error) => {
          console.error('Error getting location:', error);
          showToast('Unable to get your location. Please enable location services.', 'error');
          setIsRecentering(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    }
  };

  // Filter restaurants based on AI chat filters
  const filteredRestaurants = useMemo(() => {
    let result = [...allRestaurants];
    
    if (filters.priceLevel && filters.priceLevel.length > 0) {
      result = result.filter(r => 
        r.priceLevel !== undefined && filters.priceLevel!.includes(r.priceLevel)
      );
    }
    
    if (filters.rating) {
      result = result.filter(r => r.rating >= filters.rating!);
    }
    
    if (filters.cuisineTypes && filters.cuisineTypes.length > 0) {
      result = result.filter(r => 
        r.cuisineTypes?.some(c => 
          filters.cuisineTypes!.some(fc => c.toLowerCase().includes(fc.toLowerCase()))
        )
      );
    }
    
    return result.slice(0, 15);
  }, [allRestaurants, filters]);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          setUserLocation({ lat: 32.0853, lng: 34.7818 });
        }
      );
    } else {
      setUserLocation({ lat: 32.0853, lng: 34.7818 });
    }
  }, []);

  // Fetch restaurants
  useEffect(() => {
    if (!userLocation) return;

    const fetchRestaurants = async () => {
      setLoading(true);
      try {
        const friendsResponse = await fetch('/api/restaurants/friends-reviews');
        const friendsData = await friendsResponse.json();
        const friendsRestaurants = friendsData.restaurants || [];

        if (friendsRestaurants.length > 0) {
          setAllRestaurants(friendsRestaurants);
          setLoading(false);
          return;
        }

        const googleResponse = await fetch(
          `/api/restaurants/nearby?latitude=${userLocation.lat}&longitude=${userLocation.lng}&radius=5000`
        );
        const googleData = await googleResponse.json();
        const googleRestaurants = googleData.restaurants || [];
        setAllRestaurants(googleRestaurants);
      } catch (error) {
        console.error('Error fetching restaurants:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, [userLocation]);

  // Handle URL parameters for navigating to specific restaurant
  useEffect(() => {
    if (hasHandledUrlParams || !mapRef.current || loading) return;

    const restaurantId = searchParams.get('restaurantId');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (restaurantId && lat && lng) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);

      // First, fetch restaurant details to show in popup
      const fetchAndShowRestaurant = async () => {
        try {
          // Fetch the specific restaurant details
          const response = await fetch(`/api/restaurants/${restaurantId}`);
          const data = await response.json();
          
          if (data.restaurant) {
            // Create the target restaurant object
            const targetRestaurant = {
              id: data.restaurant.googlePlaceId || data.restaurant.id,
              name: data.restaurant.name,
              address: data.restaurant.address || '',
              latitude: data.restaurant.latitude,
              longitude: data.restaurant.longitude,
              rating: data.restaurant.averageRating,
              totalReviews: data.restaurant.totalReviews,
              photoUrl: data.restaurant.imageUrl,
              priceLevel: data.restaurant.priceLevel,
              cuisineTypes: data.restaurant.cuisineTypes || [],
              source: 'google' as const,
              googlePlaceId: data.restaurant.googlePlaceId || data.restaurant.id,
              website: data.restaurant.website,
            } satisfies Restaurant;
            
            // Fetch nearby restaurants around this location
            try {
              const nearbyResponse = await fetch(
                `/api/restaurants/nearby?latitude=${latitude}&longitude=${longitude}&radius=5000`
              );
              const nearbyData = await nearbyResponse.json();
              const nearbyRestaurants = nearbyData.restaurants || [];
              
              // Check if the target restaurant is already in nearby results
              const targetPlaceId = data.restaurant.googlePlaceId || data.restaurant.id;
              const isInNearby = nearbyRestaurants.some(
                (r: any) => r.googlePlaceId === targetPlaceId || r.id === targetPlaceId
              );
              
              // Always include the target restaurant, even if not in nearby results
              const allRestaurantsList = isInNearby 
                ? nearbyRestaurants 
                : [targetRestaurant, ...nearbyRestaurants];
              
              // Update the restaurants list
              setAllRestaurants(allRestaurantsList);
            } catch (nearbyError) {
              console.error('Error fetching nearby restaurants:', nearbyError);
              // Even if nearby fetch fails, show at least the target restaurant
              setAllRestaurants([targetRestaurant]);
            }
            
            // Hide the chat
            setShowChat(false);
            
            // Center map on the restaurant
            mapRef.current?.flyTo({
              center: [longitude, latitude],
              zoom: 16,
              duration: 2000,
              essential: true,
              curve: 1.5,
              easing: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
            });

            // After a short delay, open the restaurant popup
            setTimeout(() => {
              setSelectedRestaurant(targetRestaurant);
            }, 1000);

            setHasHandledUrlParams(true);
          }
        } catch (error) {
          console.error('Error fetching restaurant for URL params:', error);
          showToast('Could not load restaurant', 'error');
        }
      };

      fetchAndShowRestaurant();
    }
  }, [searchParams, hasHandledUrlParams, loading, showToast]);

  const handleFilterChange = (newFilters: RestaurantFilters) => {
    setFilters(newFilters);
  };

  const handleRestaurantsFound = (restaurants: any[]) => {
    // Add AI-suggested restaurants to the map
    setAllRestaurants(restaurants);
    setHighlightedRestaurants(restaurants.map(r => r.id));
  };

  const handleRestaurantClickFromChat = (restaurant: Restaurant) => {
    // Close the chat
    setShowChat(false);
    
    // Set the selected restaurant (this will open the popup)
    setSelectedRestaurant(restaurant);
    
    // Center the map on the selected restaurant with smooth animation
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [restaurant.longitude, restaurant.latitude],
        zoom: 16,
        duration: 2000, // 2 second smooth animation
        essential: true,
        curve: 1.5, // More dramatic curve
        easing: (t) => {
          // Custom easing function for smooth deceleration
          return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        }
      });
    }
  };

  const handleChatStateChange = (isActive: boolean, height: number) => {
    setChatActive(isActive);
    setChatHeight(height);
  };

  // Hide chat when restaurant is selected
  useEffect(() => {
    if (selectedRestaurant) {
      setShowChat(false);
    }
  }, [selectedRestaurant]);

  // Close dropup when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showViewDropup) {
        setShowViewDropup(false);
      }
    };
    
    if (showViewDropup) {
      document.addEventListener('click', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showViewDropup]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Full Screen Map */}
      <div className="absolute inset-0">
        {mapboxToken ? (
          <Mapbox 
            accessToken={mapboxToken}
            restaurants={filteredRestaurants}
            onRestaurantClick={setSelectedRestaurant}
            mapRef={mapRef}
            userLocationOverride={userLocation}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="font-semibold">Mapbox token not found</p>
              <p className="text-sm mt-2">Please add NEXT_PUBLIC_MAPBOX_TOKEN to your .env.local file</p>
            </div>
          </div>
        )}
      </div>

      {/* Hide default Mapbox controls */}
      <style jsx global>{`
        .mapboxgl-ctrl-bottom-right {
          display: none !important;
        }
        
        /* Animate marker entry */
        .restaurant-marker {
          animation: markerPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        
        @keyframes markerPop {
          0% {
            transform: scale(0) translateY(20px);
            opacity: 0;
          }
          100% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }
        
        /* Fade in animation */
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-in-out;
        }
      `}</style>

      {/* Category Carousel - Top */}
      <div 
        className="absolute left-0 right-0 z-20"
        style={{
          top: 'calc(1rem + env(safe-area-inset-top))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
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
                  flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold
                  whitespace-nowrap transition-all duration-300 flex-shrink-0 border-2
                  backdrop-blur-sm
                  ${isActive 
                    ? 'bg-primary/10 text-[#C5459C] border-primary shadow-[0_6px_20px_rgba(197,69,156,0.3)]' 
                    : 'bg-white/90 text-gray-600 border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.15)]'
                  }
                  ${isDisabled 
                    ? 'cursor-not-allowed opacity-60' 
                    : 'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
                  }
                `}
              >
                <Icon 
                  className={`w-4 h-4 ${isActive ? 'text-[#C5459C]' : isDisabled ? 'text-gray-400' : 'text-gray-500'}`}
                  strokeWidth={2}
                />
                <span>{cat.name}</span>
                {isDisabled && (
                  <span className="text-[9px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div 
          className="absolute left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 z-30 animate-fade-in"
          style={{
            top: 'calc(4rem + env(safe-area-inset-top))',
            boxShadow: '0 4px 16px rgba(197, 69, 156, 0.2), 0 0 0 2px white',
          }}
        >
          <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-r from-primary via-pink-500 to-orange-500 animate-spin" 
            style={{
              background: 'conic-gradient(from 0deg, #C5459C, #EC4899, #F97316, #C5459C)',
            }}
          />
          <span className="text-xs font-semibold text-black">
            Finding places...
          </span>
        </div>
      )}

      {/* Custom Location Button - Above chat, right side */}
      <button
        onClick={handleRecenterMap}
        disabled={isRecentering}
        className={`fixed z-50 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
          isRecentering 
            ? 'bg-gray-100 scale-95' 
            : 'bg-white hover:bg-gray-50 hover:scale-105 active:scale-95'
        }`}
        style={{
          right: 'max(1rem, env(safe-area-inset-right))',
          bottom: chatActive 
            ? `calc(${chatHeight + 28}px + env(safe-area-inset-bottom))` 
            : 'calc(8.25rem + env(safe-area-inset-bottom))',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        }}
        aria-label="Center map on my location"
      >
        {isRecentering ? (
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <MapPin className="w-5 h-5 text-gray-700" strokeWidth={2} fill="gray-700" />
        )}
      </button>

      {/* Filter Controls - Above Search */}
      {showChat && (
        <div 
          className="fixed z-50"
          style={{
            left: 'max(1rem, env(safe-area-inset-left))',
            bottom: chatActive 
              ? `calc(${chatHeight + 28}px + env(safe-area-inset-bottom))` 
              : 'calc(8.75rem + env(safe-area-inset-bottom))',
            transition: 'bottom 0.3s ease'
          }}
        >
          <div className="flex items-center gap-2">
            {/* Open Now Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenNow(!openNow);
              }}
              className={`
                relative flex items-center justify-center gap-1.5 px-2.5 rounded-full text-[10px] font-semibold h-[26px]
                transition-all duration-300 border backdrop-blur-sm
                ${openNow
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-[0_2px_8px_rgba(16,185,129,0.3)]'
                  : 'bg-white/95 text-gray-800 border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.1)]'
                }
                hover:scale-[1.02] active:scale-[0.98] cursor-pointer
              `}
              style={{ paddingTop: '5px', paddingBottom: '5px' }}
            >
              <div 
                className={`w-1.5 h-1.5 rounded-full animate-pulse ${openNow ? 'bg-white' : 'bg-emerald-500'}`}
                style={{ position: 'relative', top: '3.5px' }}
              />
              <span style={{ lineHeight: '1', position: 'relative', top: '0px' }}>Open Now</span>
            </button>

            {/* Following / All Dropup Selector */}
            <div className="relative">
              {/* Dropup Menu */}
              {showViewDropup && (
                <div 
                  className="absolute bottom-full mb-2 left-0 bg-white/95 backdrop-blur-sm rounded-xl border border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.15)] overflow-hidden animate-fade-in"
                  style={{ minWidth: '100%' }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewModeChange('following');
                    }}
                    className="w-full px-3 py-2 text-[10px] font-semibold text-left hover:bg-gray-50 transition-colors"
                    style={{ color: viewMode === 'following' ? '#C5459C' : '#374151' }}
                  >
                    Following
                  </button>
                  <div className="w-full h-px bg-gray-200" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewModeChange('all');
                    }}
                    className="w-full px-3 py-2 text-[10px] font-semibold text-left hover:bg-gray-50 transition-colors"
                    style={{ color: viewMode === 'all' ? '#C5459C' : '#374151' }}
                  >
                    All
                  </button>
                </div>
              )}

              {/* Selected Option Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowViewDropup(!showViewDropup);
                }}
                disabled={isTogglingView}
                className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-semibold h-[26px] bg-white/95 backdrop-blur-sm border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.1)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer transition-all duration-300"
              >
                {/* Loader overlay */}
                {isTogglingView && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[2px] rounded-full z-10">
                    <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                )}
                <span className={isTogglingView ? 'opacity-0' : ''} style={{ color: '#C5459C' }}>
                  {viewMode === 'following' ? 'Following' : 'All'}
                </span>
                <svg 
                  className={`w-3 h-3 transition-transform duration-200 ${showViewDropup ? 'rotate-180' : ''}`}
                  style={{ color: '#C5459C' }}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Chat Bottom Sheet - Hide when restaurant selected */}
      {showChat && (
        <AIChatSheet 
          onFilterChange={handleFilterChange}
          onRestaurantsFound={handleRestaurantsFound}
          onRestaurantClick={handleRestaurantClickFromChat}
          matchedCount={filteredRestaurants.length}
          userLocation={userLocation}
          onChatStateChange={handleChatStateChange}
        />
      )}

      {/* Restaurant Detail Card */}
      <RestaurantCard 
        restaurant={selectedRestaurant}
        onClose={() => {
          setSelectedRestaurant(null);
          setShowChat(true);
        }}
        userLocation={userLocation}
        onReviewModalChange={setIsReviewModalOpen}
      />

      {/* Bottom Navigation - Hide when chat is active or review modal is open */}
      <BottomNav show={!isReviewModalOpen && !chatActive} />
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-sm text-gray-500">Loading map...</p>
        </div>
      </div>
    }>
      <MapPageContent />
    </Suspense>
  );
}

