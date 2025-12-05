'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
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
  mapRef?: React.MutableRefObject<mapboxgl.Map | null>;
}

interface Cluster {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  restaurants: Restaurant[];
}

// Enhanced icon mapping with more categories and colors
const getRestaurantIcon = (restaurant: Restaurant): { emoji: string; color: string; bg: string } => {
  const cuisines = restaurant.cuisineTypes || [];
  const name = restaurant.name.toLowerCase();
  
  // Coffee & Café
  if (cuisines.some(c => c.includes('coffee') || c.includes('cafe')) || name.includes('cafe') || name.includes('coffee')) {
    return { emoji: '☕', color: '#8B4513', bg: '#FFF4E6' };
  }
  
  // Pizza & Italian
  if (cuisines.some(c => c.includes('pizza') || c.includes('italian')) || name.includes('pizza')) {
    return { emoji: '🍕', color: '#DC2626', bg: '#FEE2E2' };
  }
  
  // Sushi & Japanese
  if (cuisines.some(c => c.includes('sushi') || c.includes('japanese'))) {
    return { emoji: '🍣', color: '#DC2626', bg: '#FEE2E2' };
  }
  
  // Chinese & Asian
  if (cuisines.some(c => c.includes('chinese') || c.includes('asian'))) {
    return { emoji: '🥡', color: '#EA580C', bg: '#FFEDD5' };
  }
  
  // Burger & American
  if (cuisines.some(c => c.includes('burger') || c.includes('american')) || name.includes('burger')) {
    return { emoji: '🍔', color: '#F59E0B', bg: '#FEF3C7' };
  }
  
  // Mexican
  if (cuisines.some(c => c.includes('mexican')) || name.includes('taco') || name.includes('burrito')) {
    return { emoji: '🌮', color: '#F97316', bg: '#FFEDD5' };
  }
  
  // Indian
  if (cuisines.some(c => c.includes('indian'))) {
    return { emoji: '🍛', color: '#EAB308', bg: '#FEF9C3' };
  }
  
  // Bakery & Desserts
  if (cuisines.some(c => c.includes('bakery') || c.includes('dessert') || c.includes('ice_cream'))) {
    return { emoji: '🧁', color: '#EC4899', bg: '#FCE7F3' };
  }
  
  // Bar & Pub
  if (cuisines.some(c => c.includes('bar') || c.includes('pub')) || name.includes('bar')) {
    return { emoji: '🍺', color: '#F97316', bg: '#FED7AA' };
  }
  
  // Seafood
  if (cuisines.some(c => c.includes('seafood') || c.includes('fish'))) {
    return { emoji: '🦐', color: '#06B6D4', bg: '#CFFAFE' };
  }
  
  // Steakhouse & Grill
  if (cuisines.some(c => c.includes('steakhouse') || c.includes('grill') || c.includes('bbq'))) {
    return { emoji: '🥩', color: '#991B1B', bg: '#FEE2E2' };
  }
  
  // Thai
  if (cuisines.some(c => c.includes('thai'))) {
    return { emoji: '🍜', color: '#EF4444', bg: '#FEE2E2' };
  }
  
  // Mediterranean & Greek
  if (cuisines.some(c => c.includes('mediterranean') || c.includes('greek') || c.includes('middle_eastern'))) {
    return { emoji: '🥙', color: '#059669', bg: '#D1FAE5' };
  }
  
  // French
  if (cuisines.some(c => c.includes('french'))) {
    return { emoji: '🥐', color: '#C2410C', bg: '#FED7AA' };
  }
  
  // Vietnamese
  if (cuisines.some(c => c.includes('vietnamese'))) {
    return { emoji: '🍲', color: '#D97706', bg: '#FEF3C7' };
  }
  
  // Korean
  if (cuisines.some(c => c.includes('korean'))) {
    return { emoji: '🍱', color: '#DC2626', bg: '#FEE2E2' };
  }
  
  // Breakfast & Brunch
  if (cuisines.some(c => c.includes('breakfast') || c.includes('brunch'))) {
    return { emoji: '🥞', color: '#F59E0B', bg: '#FEF3C7' };
  }
  
  // Vegan & Vegetarian
  if (cuisines.some(c => c.includes('vegan') || c.includes('vegetarian'))) {
    return { emoji: '🥗', color: '#16A34A', bg: '#DCFCE7' };
  }
  
  // Default restaurant
  return { emoji: '🍽️', color: '#6366F1', bg: '#E0E7FF' };
};

export function Mapbox({ 
  accessToken,
  restaurants,
  onRestaurantClick,
  getUserLocation = true,
  mapRef: externalMapRef
}: MapboxProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const internalMapRef = useRef<mapboxgl.Map | null>(null);
  const map = externalMapRef || internalMapRef;
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [currentZoom, setCurrentZoom] = useState(13);
  const [loadedRestaurants, setLoadedRestaurants] = useState<Restaurant[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadedBounds = useRef<Set<string>>(new Set());
  const loadRestaurantsRef = useRef<((bounds: mapboxgl.LngLatBounds) => Promise<void>) | null>(null);

  // Categorize restaurants by importance (for display as icons vs dots)
  const categorizeRestaurants = useCallback((restaurants: Restaurant[], zoom: number) => {
    // Sort by rating and review count to determine "main" restaurants
    const sorted = [...restaurants].sort((a, b) => {
      const scoreA = (a.rating * Math.log(a.totalReviews + 1));
      const scoreB = (b.rating * Math.log(b.totalReviews + 1));
      return scoreB - scoreA;
    });
    
    // Based on zoom, decide how many to show as full icons vs dots
    let mainCount: number;
    if (zoom >= 14) {
      mainCount = sorted.length; // Show all as icons when zoomed in
    } else if (zoom >= 12) {
      mainCount = Math.min(30, sorted.length); // Show top 30 as icons
    } else if (zoom >= 10) {
      mainCount = Math.min(15, sorted.length); // Show top 15 as icons
    } else {
      mainCount = Math.min(8, sorted.length); // Show top 8 as icons
    }
    
    return {
      mainRestaurants: sorted.slice(0, mainCount),
      dotRestaurants: sorted.slice(mainCount)
    };
  }, []);

  // Lazy load restaurants based on map bounds
  const loadRestaurantsInBounds = useCallback(async (bounds: mapboxgl.LngLatBounds) => {
    if (isLoadingMore) return;
    
    const center = bounds.getCenter();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    
    // Calculate radius in meters
    const radius = Math.min(
      5000, // Max 5km
      Math.max(
        500, // Min 500m
        Math.sqrt(
          Math.pow((ne.lat - sw.lat) * 111000, 2) + 
          Math.pow((ne.lng - sw.lng) * 111000, 2)
        ) / 2
      )
    );
    
    // Create a unique key for this area
    const gridSize = 0.01; // ~1km
    const gridX = Math.floor(center.lng / gridSize);
    const gridY = Math.floor(center.lat / gridSize);
    const areaKey = `${gridX},${gridY}`;
    
    // Skip if already loaded
    if (loadedBounds.current.has(areaKey)) return;
    
    setIsLoadingMore(true);
    
    try {
      const response = await fetch(
        `/api/restaurants/nearby?latitude=${center.lat}&longitude=${center.lng}&radius=${Math.round(radius)}`
      );
      const data = await response.json();
      const newRestaurants = data.restaurants || [];
      
      // Mark area as loaded
      loadedBounds.current.add(areaKey);
      
      // Merge with existing restaurants (avoid duplicates)
      setLoadedRestaurants(prev => {
        const existingIds = new Set(prev.map(r => r.id));
        const unique = newRestaurants.filter((r: Restaurant) => !existingIds.has(r.id));
        return [...prev, ...unique];
      });
    } catch (error) {
      console.error('Error loading restaurants:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore]);

  // Keep ref updated
  useEffect(() => {
    loadRestaurantsRef.current = loadRestaurantsInBounds;
  }, [loadRestaurantsInBounds]);

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
      style: 'mapbox://styles/mapbox/streets-v12', // More colorful style
      center: userLocation,
      zoom: 13, // Normal zoom like Google Maps (not too close, not too far)
      pitch: 0,
      attributionControl: false
    });

    // Add user location control with mobile support (but don't auto-trigger)
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 0
      },
      trackUserLocation: true,
      showUserHeading: true,
      showAccuracyCircle: false,
      fitBoundsOptions: {
        maxZoom: 13, // Keep same zoom as initial
        zoom: 13 // Maintain current zoom
      }
    });
    
    map.current.addControl(geolocate, 'bottom-right');

    const currentMap = map.current;
    
    // Track zoom changes
    currentMap.on('zoom', () => {
      if (map.current) {
        setCurrentZoom(map.current.getZoom());
      }
    });

    // Lazy load on move
    currentMap.on('moveend', () => {
      if (map.current && loadRestaurantsRef.current) {
        const bounds = map.current.getBounds();
        if (bounds) {
          loadRestaurantsRef.current(bounds);
        }
      }
    });

    // Initial load
    currentMap.on('load', () => {
      // Small delay to ensure map is fully loaded
      setTimeout(() => {
        // Don't auto-trigger geolocate - let user click location button instead
        // This prevents the zoom change flash
        
        // Load initial restaurants
        if (map.current && loadRestaurantsRef.current) {
          const bounds = map.current.getBounds();
          if (bounds) {
            loadRestaurantsRef.current(bounds);
          }
        }
      }, 100);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [accessToken, userLocation]);

  // Add markers for restaurants (icons for main, dots for others)
  useEffect(() => {
    if (!map.current) return;
    
    const currentMap = map.current;

    // Remove existing markers
    markers.current.forEach(marker => {
      try {
        marker.remove();
      } catch (e) {
        console.warn('Error removing marker:', e);
      }
    });
    markers.current = [];

    // Combine loaded restaurants with prop restaurants
    const allRestaurants = [...loadedRestaurants, ...restaurants];
    const uniqueRestaurants = Array.from(
      new Map(allRestaurants.map(r => [r.id, r])).values()
    );

    // Categorize into main (icons) and secondary (dots)
    const { mainRestaurants, dotRestaurants } = categorizeRestaurants(uniqueRestaurants, currentZoom);

    // Render main restaurants as colorful icons
    mainRestaurants.forEach((restaurant) => {
      if (!currentMap) return;
      const el = document.createElement('div');
      el.className = 'restaurant-marker';
      const isFriendOrOwn = restaurant.source === 'friends' || restaurant.source === 'own';
      const iconData = getRestaurantIcon(restaurant);
      
      // Main restaurant marker - colorful pill with icon
      el.innerHTML = `
        <div class="marker-content" style="
          display: flex;
          align-items: center;
          gap: 5px;
          background: ${isFriendOrOwn ? 'linear-gradient(135deg, #C5459C 0%, #EC4899 100%)' : iconData.bg};
          color: ${isFriendOrOwn ? 'white' : iconData.color};
          padding: 7px 12px;
          border-radius: 24px;
          box-shadow: 0 3px 14px rgba(0,0,0,0.2), 0 0 0 2px white;
          border: 2px solid ${isFriendOrOwn ? '#C5459C' : 'white'};
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        ">
          <span style="font-size: 18px; line-height: 1;">${iconData.emoji}</span>
          ${restaurant.rating > 0 ? `
            <span style="
              font-size: 13px;
              font-weight: 700;
              letter-spacing: -0.3px;
            ">
              ${restaurant.rating.toFixed(1)}
            </span>
          ` : ''}
        </div>
      `;

      const markerContent = el.querySelector('.marker-content') as HTMLElement;
      el.addEventListener('mouseenter', () => {
        if (markerContent) {
          markerContent.style.transform = 'translateY(-3px) scale(1.08)';
          markerContent.style.boxShadow = '0 6px 24px rgba(0,0,0,0.3), 0 0 0 3px white';
        }
      });
      el.addEventListener('mouseleave', () => {
        if (markerContent) {
          markerContent.style.transform = 'translateY(0) scale(1)';
          markerContent.style.boxShadow = '0 3px 14px rgba(0,0,0,0.2), 0 0 0 2px white';
        }
      });

      el.addEventListener('click', () => {
        if (onRestaurantClick) {
          onRestaurantClick(restaurant);
        }
      });

      try {
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([restaurant.longitude, restaurant.latitude])
          .addTo(currentMap);
        markers.current.push(marker);
      } catch (e) {
        console.warn('Error adding main restaurant marker:', e);
      }
    });

    // Render secondary restaurants as small dots
    dotRestaurants.forEach((restaurant) => {
      if (!currentMap) return;
      const el = document.createElement('div');
      el.className = 'restaurant-dot';
      
      const isFriendOrOwn = restaurant.source === 'friends' || restaurant.source === 'own';
      const iconData = getRestaurantIcon(restaurant);
      
      // Small dot marker
      el.innerHTML = `
        <div class="dot-marker" style="
          width: 8px;
          height: 8px;
          background: ${isFriendOrOwn ? '#C5459C' : iconData.color};
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3), 0 0 0 2px white;
          border: 2px solid white;
          cursor: pointer;
          transition: all 0.2s ease;
        "></div>
      `;

      const dotContent = el.querySelector('.dot-marker') as HTMLElement;
      el.addEventListener('mouseenter', () => {
        if (dotContent) {
          dotContent.style.transform = 'scale(1.5)';
          dotContent.style.boxShadow = '0 3px 10px rgba(0,0,0,0.4), 0 0 0 2px white';
        }
      });
      el.addEventListener('mouseleave', () => {
        if (dotContent) {
          dotContent.style.transform = 'scale(1)';
          dotContent.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3), 0 0 0 2px white';
        }
      });

      el.addEventListener('click', () => {
        if (onRestaurantClick) {
          onRestaurantClick(restaurant);
        }
      });

      try {
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([restaurant.longitude, restaurant.latitude])
          .addTo(currentMap);
        markers.current.push(marker);
      } catch (e) {
        console.warn('Error adding dot marker:', e);
      }
    });

  }, [restaurants, loadedRestaurants, onRestaurantClick, currentZoom, categorizeRestaurants]);

  return (
    <div className="relative w-full h-full">
      <div 
        ref={mapContainer} 
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* Loading indicator for lazy loading */}
      {isLoadingMore && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg flex items-center gap-2 animate-fade-in">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-primary to-pink-500 animate-pulse" />
          <span className="text-xs font-semibold text-gray-700">Loading places...</span>
        </div>
      )}
    </div>
  );
}

