'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { BottomNav } from '@/components/layout/bottom-nav';
import { RestaurantCard } from '@/components/map/restaurant-card';
import { AIChatSheet, RestaurantFilters } from '@/components/map/ai-chat-sheet';
import { Loader2, UtensilsCrossed, Hotel, Briefcase, Coffee, Wine, MapPin } from 'lucide-react';
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
  const [highlightedRestaurants, setHighlightedRestaurants] = useState<string[]>([]);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [isRecentering, setIsRecentering] = useState(false);
  const [chatActive, setChatActive] = useState(false);
  const [chatHeight, setChatHeight] = useState(200);

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
              zoom: 13,
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

  const handleRestaurantsFound = (restaurants: any[]) => {
    // Add AI-suggested restaurants to the map
    setAllRestaurants(restaurants);
    setHighlightedRestaurants(restaurants.map(r => r.id));
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
      <div className="absolute top-4 left-0 right-0 z-20">
        <div className="flex gap-2 px-4 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            const isDisabled = !cat.active;
            
            return (
              <button
                key={cat.id}
                onClick={() => cat.active && setActiveCategory(cat.id)}
                disabled={isDisabled}
                style={{
                  backgroundColor: isActive ? `${cat.color}15` : 'rgba(255, 255, 255, 0.95)',
                  color: isActive ? cat.color : isDisabled ? '#9CA3AF' : '#374151',
                  borderColor: isActive ? cat.color : 'transparent',
                  boxShadow: isActive 
                    ? `0 4px 16px ${cat.color}30, 0 0 0 2px white` 
                    : '0 2px 12px rgba(0,0,0,0.1)',
                }}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold
                  whitespace-nowrap transition-all duration-300 flex-shrink-0 border-2
                  backdrop-blur-sm
                  ${isDisabled 
                    ? 'cursor-not-allowed opacity-60' 
                    : 'hover:scale-105 active:scale-95'
                  }
                `}
              >
                <Icon 
                  className="w-4 h-4" 
                  strokeWidth={2.5}
                  style={{ color: isActive ? cat.color : isDisabled ? '#9CA3AF' : '#6B7280' }}
                />
                <span>{cat.name}</span>
                {isDisabled && (
                  <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full font-semibold">
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
          className="absolute top-16 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 z-30 animate-fade-in"
          style={{
            boxShadow: '0 4px 16px rgba(197, 69, 156, 0.2), 0 0 0 2px white',
          }}
        >
          <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-r from-primary via-pink-500 to-orange-500 animate-spin" 
            style={{
              background: 'conic-gradient(from 0deg, #C5459C, #EC4899, #F97316, #C5459C)',
            }}
          />
          <span className="text-xs font-semibold bg-gradient-to-r from-primary to-pink-600 bg-clip-text text-transparent">
            Finding places...
          </span>
        </div>
      )}

      {/* Custom Location Button - Above chat, right side */}
      <button
        onClick={handleRecenterMap}
        disabled={isRecentering}
        className={`fixed right-4 z-50 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
          isRecentering 
            ? 'bg-gradient-to-br from-primary/70 to-pink-500/70 scale-95' 
            : 'bg-gradient-to-br from-primary to-pink-500 hover:scale-105 active:scale-95'
        }`}
        style={{
          bottom: chatActive ? `${chatHeight + 88}px` : '132px', // Collapsed: 76px (search pos) + 40px (search height) + 16px (spacing) = 132px
          boxShadow: isRecentering
            ? '0 2px 8px rgba(197, 69, 156, 0.3), 0 0 0 2px rgba(255,255,255,0.8)'
            : '0 3px 12px rgba(197, 69, 156, 0.4), 0 0 0 2px white',
        }}
        aria-label="Center map on my location"
      >
        {isRecentering ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <MapPin className="w-4 h-4 text-white" strokeWidth={2.5} fill="white" />
        )}
      </button>

      {/* AI Chat Bottom Sheet - Hide when restaurant selected */}
      {showChat && (
        <AIChatSheet 
          onFilterChange={handleFilterChange}
          onRestaurantsFound={handleRestaurantsFound}
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
      />

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

