'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { MainLayout } from '@/components/layout/main-layout';
import { RestaurantCard } from '@/components/map/restaurant-card';
import { UtensilsCrossed, Hotel, Briefcase, Loader2 } from 'lucide-react';
import type { Restaurant } from '@/components/map/mapbox';

// Dynamically import Mapbox with no SSR to avoid build issues
const Mapbox = dynamic(() => import('@/components/map/mapbox').then(mod => mod.Mapbox), {
  ssr: false,
  loading: () => (
    <div className="bg-white rounded-lg shadow h-full flex items-center justify-center text-gray-500">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
        <p>Loading map...</p>
      </div>
    </div>
  )
});

export default function MapPage() {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

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
          setRestaurants(friendsRestaurants);
          setLoading(false);
          return;
        }

        // Otherwise, fetch Google Places restaurants
        const googleResponse = await fetch(
          `/api/restaurants/nearby?latitude=${userLocation.lat}&longitude=${userLocation.lng}&radius=2000`
        );
        const googleData = await googleResponse.json();
        const googleRestaurants = googleData.restaurants || [];

        setRestaurants(googleRestaurants);
      } catch (error) {
        console.error('Error fetching restaurants:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, [userLocation]);

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        {/* Category Icons */}
        <div className="flex gap-4 mb-6 justify-center items-start">
          {/* Restaurants - Active */}
          <div className="flex flex-col items-center">
            <button 
              style={{ backgroundColor: '#C5459C' }}
              className="flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg transition-all"
              aria-label="Restaurants"
            >
              <UtensilsCrossed className="w-6 h-6 text-white" strokeWidth={2.5} />
            </button>
            <div className="h-4"></div>
          </div>

          {/* Hotels - Disabled */}
          <div className="flex flex-col items-center">
            <button 
              disabled
              className="flex items-center justify-center w-14 h-14 bg-gray-200 rounded-2xl shadow-sm opacity-50 cursor-not-allowed"
              aria-label="Hotels (Coming Soon)"
            >
              <Hotel className="w-6 h-6 text-gray-400" strokeWidth={2} />
            </button>
            <span className="text-[10px] text-gray-400 mt-1.5 font-medium">Coming Soon</span>
          </div>

          {/* Business - Disabled */}
          <div className="flex flex-col items-center">
            <button 
              disabled
              className="flex items-center justify-center w-14 h-14 bg-gray-200 rounded-2xl shadow-sm opacity-50 cursor-not-allowed"
              aria-label="Business (Coming Soon)"
            >
              <Briefcase className="w-6 h-6 text-gray-400" strokeWidth={2} />
            </button>
            <span className="text-[10px] text-gray-400 mt-1.5 font-medium">Coming Soon</span>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow p-4 mb-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-gray-700">Finding restaurants near you...</span>
          </div>
        )}

        {/* Map Content */}
        <div className="h-[calc(100vh-220px)] relative">
          {mapboxToken ? (
            <Mapbox 
              accessToken={mapboxToken}
              restaurants={restaurants}
              onRestaurantClick={setSelectedRestaurant}
            />
          ) : (
            <div className="bg-white rounded-lg shadow h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="font-semibold">Mapbox token not found</p>
                <p className="text-sm mt-2">Please add NEXT_PUBLIC_MAPBOX_TOKEN to your .env.local file</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Restaurant Detail Card */}
      <RestaurantCard 
        restaurant={selectedRestaurant}
        onClose={() => setSelectedRestaurant(null)}
      />
    </MainLayout>
  );
}

