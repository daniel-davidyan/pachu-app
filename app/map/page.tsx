'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { BottomNav } from '@/components/layout/bottom-nav';
import { RestaurantCard } from '@/components/map/restaurant-card';
import { AIChatSheet, RestaurantFilters } from '@/components/map/ai-chat-sheet';
import { Loader2, UtensilsCrossed, Hotel, Briefcase, Coffee, Wine, MapPin, ArrowLeft, MessageCircle } from 'lucide-react';
import type { Restaurant } from '@/components/map/mapbox';
import type mapboxgl from 'mapbox-gl';

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
  { id: 'restaurants', name: 'Restaurants', icon: UtensilsCrossed, active: true, color: '#C5459C' },
  { id: 'cafes', name: 'Cafés', icon: Coffee, active: false, color: '#8B4513' },
  { id: 'bars', name: 'Bars', icon: Wine, active: false, color: '#F97316' },
  { id: 'hotels', name: 'Hotels', icon: Hotel, active: false, color: '#6366F1' },
  { id: 'services', name: 'Services', icon: Briefcase, active: false, color: '#10B981' },
];

export default function MapPage() {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [filters, setFilters] = useState<RestaurantFilters>({ query: '' });
  const [activeCategory, setActiveCategory] = useState('restaurants');
  const [showChat, setShowChat] = useState(true);
  const [suggestedRestaurants, setSuggestedRestaurants] = useState<Restaurant[]>([]);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [isRecentering, setIsRecentering] = useState(false);
  const [chatActive, setChatActive] = useState(false);
  const [openNow, setOpenNow] = useState(false);
  const [viewMode, setViewMode] = useState<'following' | 'all'>('all');
  const [isTogglingView, setIsTogglingView] = useState(false);
  const [showViewDropup, setShowViewDropup] = useState(false);

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
          alert('Unable to get your location. Please enable location services.');
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
          `/api/restaurants/nearby?latitude=${userLocation.lat}&longitude=${userLocation.lng}&radius=2000`
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

  const handleFilterChange = (newFilters: RestaurantFilters) => {
    setFilters(newFilters);
  };

  const handleRestaurantsFound = (restaurants: Restaurant[]) => {
    // Store AI-suggested restaurants
    setSuggestedRestaurants(restaurants);
    // Also add them to the map
    setAllRestaurants(prev => {
      const existingIds = new Set(prev.map(r => r.id));
      const newRestaurants = restaurants.filter(r => !existingIds.has(r.id));
      return [...prev, ...newRestaurants];
    });
  };

  const handleChatStateChange = (isActive: boolean) => {
    setChatActive(isActive);
  };

  // Handle restaurant click from chat - zoom to location
  const handleRestaurantClickFromChat = (restaurant: Restaurant) => {
    if (mapRef.current) {
      // Zoom to restaurant with smooth animation
      mapRef.current.flyTo({
        center: [restaurant.longitude, restaurant.latitude],
        zoom: 17,
        duration: 2000,
        essential: true
      });
      
      // Optionally show the restaurant card after zoom
      setTimeout(() => {
        setSelectedRestaurant(restaurant);
      }, 1500);
    }
  };

  // Don't automatically hide chat when restaurant is selected
  // Let user control chat visibility manually

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
            suggestedRestaurants={suggestedRestaurants}
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

        /* Pulse animation for suggested restaurants */
        @keyframes suggested-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(197, 69, 156, 0.7);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(197, 69, 156, 0);
          }
        }
        
        .suggested-marker {
          animation: suggested-pulse 2s ease-in-out infinite;
        }
      `}</style>

      {/* Return to Chat Button - Shows when restaurant is selected */}
      {selectedRestaurant && (
        <div 
          className="absolute left-0 right-0 z-30"
          style={{
            top: 'calc(1rem + env(safe-area-inset-top))',
            paddingLeft: 'max(1rem, env(safe-area-inset-left))',
            paddingRight: 'max(1rem, env(safe-area-inset-right))',
          }}
        >
          <button
            onClick={() => {
              setSelectedRestaurant(null);
              setChatActive(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/95 backdrop-blur-sm rounded-full shadow-lg border-2 border-primary hover:bg-white transition-all active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-primary" strokeWidth={2.5} />
            <MessageCircle className="w-4 h-4 text-primary" strokeWidth={2} />
            <span className="text-sm font-semibold text-primary">Return to chat</span>
          </button>
        </div>
      )}

      {/* Category Carousel - Top */}
      {!selectedRestaurant && (
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
      )}

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
      {!chatActive && (
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
            bottom: 'calc(8.25rem + env(safe-area-inset-bottom))',
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
      )}

      {/* Filter Controls - Above Search */}
      {showChat && !chatActive && (
        <div 
          className="fixed z-50"
          style={{
            left: 'max(1rem, env(safe-area-inset-left))',
            bottom: 'calc(8.75rem + env(safe-area-inset-bottom))',
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
          matchedCount={filteredRestaurants.length}
          userLocation={userLocation}
          onChatStateChange={handleChatStateChange}
          onRestaurantClick={handleRestaurantClickFromChat}
        />
      )}

      {/* Restaurant Detail Card */}
      <RestaurantCard 
        restaurant={selectedRestaurant}
        onClose={() => {
          setSelectedRestaurant(null);
        }}
        userLocation={userLocation}
        onBackToChat={() => {
          setSelectedRestaurant(null);
          setChatActive(true);
        }}
      />

      {/* Bottom Navigation - Hide when chat is active */}
      <BottomNav show={!chatActive} />
    </div>
  );
}
