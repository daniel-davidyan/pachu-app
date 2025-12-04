'use client';

import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  totalReviews: number;
  photoUrl?: string;
  priceLevel?: number;
  cuisineTypes?: string[];
  source: 'google' | 'friends' | 'own';
  googlePlaceId?: string;
}

interface MapboxProps {
  accessToken: string;
  restaurants: Restaurant[];
  onRestaurantClick?: (restaurant: Restaurant) => void;
  getUserLocation?: boolean;
}

export function Mapbox({ 
  accessToken,
  restaurants,
  onRestaurantClick,
  getUserLocation = true
}: MapboxProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Get user's current location
  useEffect(() => {
    if (getUserLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          setUserLocation([longitude, latitude]);
        },
        (error) => {
          console.error('Error getting location:', error);
          // Default to Tel Aviv if location fails
          setUserLocation([34.7818, 32.0853]);
        }
      );
    } else {
      // Default to Tel Aviv
      setUserLocation([34.7818, 32.0853]);
    }
  }, [getUserLocation]);

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current || !userLocation) return;
    
    mapboxgl.accessToken = accessToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: userLocation,
      zoom: 14
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add user location control
    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
      }),
      'top-right'
    );

    return () => {
      map.current?.remove();
    };
  }, [accessToken, userLocation]);

  // Add markers for restaurants
  useEffect(() => {
    if (!map.current) return;

    // Remove existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Add new markers
    restaurants.forEach((restaurant) => {
      const el = document.createElement('div');
      el.className = 'restaurant-marker';
      
      // Determine if it's a friend/own review or Google
      const isFriendOrOwn = restaurant.source === 'friends' || restaurant.source === 'own';
      
      // Get appropriate emoji based on cuisine or type
      const getIcon = () => {
        const cuisines = restaurant.cuisineTypes || [];
        const name = restaurant.name.toLowerCase();
        
        if (cuisines.some(c => c.includes('coffee') || c.includes('cafe')) || name.includes('cafe') || name.includes('coffee')) return '☕';
        if (cuisines.some(c => c.includes('pizza') || c.includes('italian')) || name.includes('pizza')) return '🍕';
        if (cuisines.some(c => c.includes('sushi') || c.includes('japanese'))) return '🍣';
        if (cuisines.some(c => c.includes('chinese') || c.includes('asian'))) return '🥡';
        if (cuisines.some(c => c.includes('burger') || c.includes('american'))) return '🍔';
        if (cuisines.some(c => c.includes('mexican'))) return '🌮';
        if (cuisines.some(c => c.includes('indian'))) return '🍛';
        if (cuisines.some(c => c.includes('bakery') || c.includes('dessert'))) return '🧁';
        if (cuisines.some(c => c.includes('bar'))) return '🍺';
        if (cuisines.some(c => c.includes('seafood') || c.includes('fish'))) return '🦐';
        if (cuisines.some(c => c.includes('steakhouse') || c.includes('grill'))) return '🥩';
        if (cuisines.some(c => c.includes('thai'))) return '🍜';
        if (cuisines.some(c => c.includes('mediterranean') || c.includes('greek'))) return '🥙';
        return '🍽️';
      };

      // Create marker HTML - Modern pill style like Corner
      el.innerHTML = `
        <div class="marker-content" style="
          display: flex;
          align-items: center;
          gap: 4px;
          background: ${isFriendOrOwn ? '#C5459C' : 'white'};
          color: ${isFriendOrOwn ? 'white' : '#1f2937'};
          padding: 6px 10px;
          border-radius: 20px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.15);
          border: 2px solid ${isFriendOrOwn ? '#C5459C' : 'white'};
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.2s ease;
        ">
          <span style="font-size: 16px;">${getIcon()}</span>
          <span style="max-width: 80px; overflow: hidden; text-overflow: ellipsis;">
            ${restaurant.rating > 0 ? restaurant.rating.toFixed(1) : ''}
          </span>
        </div>
      `;

      // Hover effect
      const markerContent = el.querySelector('.marker-content') as HTMLElement;
      el.addEventListener('mouseenter', () => {
        if (markerContent) {
          markerContent.style.transform = 'scale(1.1)';
          markerContent.style.boxShadow = '0 4px 20px rgba(0,0,0,0.25)';
        }
      });
      el.addEventListener('mouseleave', () => {
        if (markerContent) {
          markerContent.style.transform = 'scale(1)';
          markerContent.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)';
        }
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([restaurant.longitude, restaurant.latitude])
        .addTo(map.current!);

      // Add click handler
      el.addEventListener('click', () => {
        if (onRestaurantClick) {
          onRestaurantClick(restaurant);
        }
      });

      markers.current.push(marker);
    });

  }, [restaurants, onRestaurantClick]);

  return (
    <div 
      ref={mapContainer} 
      className="w-full h-full rounded-lg overflow-hidden"
      style={{ width: '100%', height: '100%' }}
    />
  );
}

