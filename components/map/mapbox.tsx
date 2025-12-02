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
      
      // Different colors based on source
      const markerColor = 
        restaurant.source === 'own' ? '#C5459C' :      // Purple for own reviews
        restaurant.source === 'friends' ? '#C5459C' :  // Purple for friends
        '#459CC5';                                      // Blue for Google

      el.style.cssText = `
        background-color: ${markerColor};
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        transition: transform 0.2s;
      `;
      
      // Add icon
      el.innerHTML = restaurant.source === 'google' ? '🔵' : '⭐';

      // Hover effect
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.2)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
      });

      const marker = new mapboxgl.Marker(el)
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

