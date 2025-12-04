'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { BottomNav } from '@/components/layout/bottom-nav';
import { RestaurantCard } from '@/components/map/restaurant-card';
import { AIChatPanel, RestaurantFilters } from '@/components/map/ai-chat-panel';
import { Loader2 } from 'lucide-react';
import type { Restaurant } from '@/components/map/mapbox';

// Dynamically import Mapbox with no SSR to avoid build issues
const Mapbox = dynamic(() => import('@/components/map/mapbox').then(mod => mod.Mapbox), {
  ssr: false,
  loading: () => (
    <div className="bg-white rounded-2xl shadow h-full flex items-center justify-center text-gray-500">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
        <p>Loading map...</p>
      </div>
    </div>
  )
});

export default function MapPage() {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [filters, setFilters] = useState<RestaurantFilters>({ query: '' });

  // Filter restaurants based on AI chat filters
  const filteredRestaurants = useMemo(() => {
    let result = [...allRestaurants];
    
    // Filter by price level
    if (filters.priceLevel && filters.priceLevel.length > 0) {
      result = result.filter(r => 
        r.priceLevel !== undefined && filters.priceLevel!.includes(r.priceLevel)
      );
    }
    
    // Filter by rating
    if (filters.rating) {
      result = result.filter(r => r.rating >= filters.rating!);
    }
    
    // Filter by cuisine types
    if (filters.cuisineTypes && filters.cuisineTypes.length > 0) {
      result = result.filter(r => 
        r.cuisineTypes?.some(c => 
          filters.cuisineTypes!.some(fc => c.toLowerCase().includes(fc.toLowerCase()))
        )
      );
    }
    
    // Limit to 15 max for display
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
          // Default to Tel Aviv if location fails
          setUserLocation({ lat: 32.0853, lng: 34.7818 });
        }
      );
    } else {
      setUserLocation({ lat: 32.0853, lng: 34.7818 });
    }
  }, []);

  // Fetch restaurants (hybrid: friends + Google)
  useEffect(() => {
    if (!userLocation) return;

    const fetchRestaurants = async () => {
      setLoading(true);
      try {
        // Fetch friends' reviews first
        const friendsResponse = await fetch('/api/restaurants/friends-reviews');
        const friendsData = await friendsResponse.json();
        const friendsRestaurants = friendsData.restaurants || [];

        // If user has friends with reviews, prioritize them
        if (friendsRestaurants.length > 0) {
          setAllRestaurants(friendsRestaurants);
          setLoading(false);
          return;
        }

        // Otherwise, fetch Google Places restaurants
        const googleResponse = await fetch(
          `/api/restaurants/nearby?latitude=${userLocation.lat}&longitude=${userLocation.lng}&radius=2000`
        );
        const googleData = await googleResponse.json();
        
        if (googleData.error) {
          console.error('Google API error:', googleData.error);
        }
        
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

  return (
    <div className="fixed inset-0 bg-gray-100">
      {/* Full Screen Map */}
      <div className="absolute inset-0">
        {mapboxToken ? (
          <Mapbox 
            accessToken={mapboxToken}
            restaurants={filteredRestaurants}
            onRestaurantClick={setSelectedRestaurant}
          />
        ) : (
          <div className="bg-white h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="font-semibold">Mapbox token not found</p>
              <p className="text-sm mt-2">Please add NEXT_PUBLIC_MAPBOX_TOKEN to your .env.local file</p>
            </div>
          </div>
        )}
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-xl rounded-full px-4 py-2 shadow-lg flex items-center gap-2 z-30">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm text-gray-700">Finding restaurants...</span>
        </div>
      )}

      {/* AI Chat Panel (Draggable) */}
      <AIChatPanel 
        onFilterChange={handleFilterChange}
        matchedCount={filteredRestaurants.length}
      />

      {/* Restaurant Detail Card */}
      <RestaurantCard 
        restaurant={selectedRestaurant}
        onClose={() => setSelectedRestaurant(null)}
      />

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

