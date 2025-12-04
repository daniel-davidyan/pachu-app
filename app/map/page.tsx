'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { BottomNav } from '@/components/layout/bottom-nav';
import { RestaurantCard } from '@/components/map/restaurant-card';
import { AIChatSheet, RestaurantFilters } from '@/components/map/ai-chat-sheet';
import { Loader2, UtensilsCrossed, Hotel, Briefcase, Coffee, Wine, MapPin } from 'lucide-react';
import type { Restaurant } from '@/components/map/mapbox';

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
  { id: 'restaurants', name: 'Restaurants', icon: UtensilsCrossed, active: true },
  { id: 'cafes', name: 'Cafés', icon: Coffee, active: false },
  { id: 'bars', name: 'Bars', icon: Wine, active: false },
  { id: 'hotels', name: 'Hotels', icon: Hotel, active: false },
  { id: 'services', name: 'Services', icon: Briefcase, active: false },
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

  const handleRecenterMap = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Unable to get your location. Please enable location services.');
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

  // Hide chat when restaurant is selected
  useEffect(() => {
    if (selectedRestaurant) {
      setShowChat(false);
    }
  }, [selectedRestaurant]);

  return (
    <div className="fixed inset-0 bg-[#f5f5f7]">
      {/* Full Screen Map */}
      <div className="absolute inset-0">
        {mapboxToken ? (
          <Mapbox 
            accessToken={mapboxToken}
            restaurants={filteredRestaurants}
            onRestaurantClick={setSelectedRestaurant}
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
                className={`
                  flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold
                  whitespace-nowrap transition-all duration-200 flex-shrink-0 shadow-lg border-2
                  ${isActive 
                    ? 'bg-primary/10 text-primary border-primary' 
                    : isDisabled
                      ? 'bg-white/90 text-gray-400 border-transparent cursor-not-allowed'
                      : 'bg-white text-gray-700 border-transparent hover:bg-gray-50'
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

      {/* Loading Indicator */}
      {loading && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 glass rounded-full px-4 py-2 shadow-lg flex items-center gap-2 z-30 animate-fade-in">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          <span className="text-xs text-gray-700">Finding places...</span>
        </div>
      )}

      {/* Custom Location Button - Gentle & Modern */}
      <button
        onClick={handleRecenterMap}
        className="fixed bottom-[140px] right-4 z-50 w-11 h-11 bg-white/95 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center border border-gray-200 hover:bg-white hover:shadow-xl transition-all hover:scale-105 active:scale-95 group"
        aria-label="Center map on my location"
      >
        <MapPin className="w-5 h-5 text-gray-600 group-hover:text-primary transition-colors" strokeWidth={2} />
      </button>

      {/* AI Chat Bottom Sheet - Hide when restaurant selected */}
      {showChat && (
        <AIChatSheet 
          onFilterChange={handleFilterChange}
          onRestaurantsFound={handleRestaurantsFound}
          matchedCount={filteredRestaurants.length}
          userLocation={userLocation}
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

