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

// Enhanced icon mapping with more categories and variety
const getRestaurantIcon = (restaurant: Restaurant): { emoji: string; color: string; bg: string } => {
  const cuisines = restaurant.cuisineTypes || [];
  const name = restaurant.name.toLowerCase();
  const allText = [...cuisines, name].join(' ').toLowerCase();
  
  // Coffee & Café
  if (allText.includes('coffee') || allText.includes('cafe') || allText.includes('espresso')) {
    return { emoji: '☕', color: '#8B4513', bg: '#FFF4E6' };
  }
  
  // Pizza
  if (allText.includes('pizza') || allText.includes('pizzeria')) {
    return { emoji: '🍕', color: '#DC2626', bg: '#FEE2E2' };
  }
  
  // Sushi & Japanese
  if (allText.includes('sushi') || allText.includes('japanese') || allText.includes('ramen')) {
    return { emoji: '🍣', color: '#DC2626', bg: '#FEE2E2' };
  }
  
  // Chinese & Asian
  if (allText.includes('chinese') || allText.includes('dim sum') || allText.includes('noodles')) {
    return { emoji: '🥡', color: '#EA580C', bg: '#FFEDD5' };
  }
  
  // Burger
  if (allText.includes('burger') || allText.includes('hamburger')) {
    return { emoji: '🍔', color: '#F59E0B', bg: '#FEF3C7' };
  }
  
  // Mexican
  if (allText.includes('mexican') || allText.includes('taco') || allText.includes('burrito')) {
    return { emoji: '🌮', color: '#F97316', bg: '#FFEDD5' };
  }
  
  // Indian
  if (allText.includes('indian') || allText.includes('curry') || allText.includes('tandoor')) {
    return { emoji: '🍛', color: '#EAB308', bg: '#FEF9C3' };
  }
  
  // Bakery & Pastry
  if (allText.includes('bakery') || allText.includes('patisserie') || allText.includes('pastry')) {
    return { emoji: '🥐', color: '#C2410C', bg: '#FED7AA' };
  }
  
  // Ice cream & Desserts
  if (allText.includes('ice cream') || allText.includes('gelato') || allText.includes('dessert')) {
    return { emoji: '🍨', color: '#EC4899', bg: '#FCE7F3' };
  }
  
  // Bar & Pub & Wine
  if (allText.includes('bar') || allText.includes('pub') || allText.includes('wine')) {
    return { emoji: '🍷', color: '#F97316', bg: '#FED7AA' };
  }
  
  // Seafood
  if (allText.includes('seafood') || allText.includes('fish') || allText.includes('oyster')) {
    return { emoji: '🦐', color: '#06B6D4', bg: '#CFFAFE' };
  }
  
  // Steakhouse & Grill & BBQ
  if (allText.includes('steak') || allText.includes('grill') || allText.includes('bbq') || allText.includes('meat')) {
    return { emoji: '🥩', color: '#991B1B', bg: '#FEE2E2' };
  }
  
  // Thai
  if (allText.includes('thai')) {
    return { emoji: '🍜', color: '#EF4444', bg: '#FEE2E2' };
  }
  
  // Mediterranean & Middle Eastern
  if (allText.includes('mediterranean') || allText.includes('greek') || allText.includes('middle eastern') || allText.includes('falafel') || allText.includes('shawarma')) {
    return { emoji: '🥙', color: '#059669', bg: '#D1FAE5' };
  }
  
  // Vietnamese & Pho
  if (allText.includes('vietnamese') || allText.includes('pho')) {
    return { emoji: '🍲', color: '#D97706', bg: '#FEF3C7' };
  }
  
  // Korean
  if (allText.includes('korean') || allText.includes('kimchi') || allText.includes('bibimbap')) {
    return { emoji: '🍱', color: '#DC2626', bg: '#FEE2E2' };
  }
  
  // Breakfast & Brunch
  if (allText.includes('breakfast') || allText.includes('brunch') || allText.includes('pancake')) {
    return { emoji: '🥞', color: '#F59E0B', bg: '#FEF3C7' };
  }
  
  // Salad & Healthy
  if (allText.includes('salad') || allText.includes('healthy') || allText.includes('juice')) {
    return { emoji: '🥗', color: '#16A34A', bg: '#DCFCE7' };
  }
  
  // Sandwich & Deli
  if (allText.includes('sandwich') || allText.includes('deli') || allText.includes('sub')) {
    return { emoji: '🥪', color: '#D97706', bg: '#FEF3C7' };
  }
  
  // Chicken
  if (allText.includes('chicken') || allText.includes('wings') || allText.includes('fried chicken')) {
    return { emoji: '🍗', color: '#F59E0B', bg: '#FEF3C7' };
  }
  
  // Soup
  if (allText.includes('soup')) {
    return { emoji: '🍜', color: '#EF4444', bg: '#FEE2E2' };
  }
  
  // Italian (general, not pizza)
  if (allText.includes('italian') || allText.includes('pasta') || allText.includes('trattoria')) {
    return { emoji: '🍝', color: '#DC2626', bg: '#FEE2E2' };
  }
  
  // American / Diner
  if (allText.includes('american') || allText.includes('diner')) {
    return { emoji: '🍟', color: '#F59E0B', bg: '#FEF3C7' };
  }
  
  // Fast Food
  if (allText.includes('fast food') || allText.includes('quick service')) {
    return { emoji: '🌭', color: '#F97316', bg: '#FFEDD5' };
  }
  
  // Default - use different plate icons based on rating
  if (restaurant.rating >= 4.5) {
    return { emoji: '⭐', color: '#EAB308', bg: '#FEF9C3' }; // High rated
  } else if (restaurant.rating >= 4.0) {
    return { emoji: '🍴', color: '#6366F1', bg: '#E0E7FF' }; // Good rated
  } else {
    return { emoji: '🍽️', color: '#6B7280', bg: '#F3F4F6' }; // Standard
  }
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
  const [currentZoom, setCurrentZoom] = useState(15.5);
  const [loadedRestaurants, setLoadedRestaurants] = useState<Restaurant[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadedBounds = useRef<Set<string>>(new Set());
  const loadRestaurantsRef = useRef<((bounds: mapboxgl.LngLatBounds) => Promise<void>) | null>(null);

  // Smart de-duplication and categorization based on proximity and zoom
  const categorizeRestaurants = useCallback((restaurants: Restaurant[], zoom: number) => {
    // Calculate minimum distance between markers based on zoom
    // Higher zoom = allow closer markers
    const getMinDistance = (zoom: number): number => {
      if (zoom >= 17) return 0.0001; // Very close zoom - show almost all
      if (zoom >= 16) return 0.0003; // Close zoom - show most
      if (zoom >= 15) return 0.0008; // Normal close - smart filtering
      if (zoom >= 14) return 0.0015; // Medium - more filtering
      if (zoom >= 12) return 0.003;  // Far - significant filtering
      return 0.006; // Very far - heavy filtering
    };
    
    const minDistance = getMinDistance(zoom);
    
    // Sort by rating and review count to determine importance
    const sorted = [...restaurants].sort((a, b) => {
      const scoreA = (a.rating * Math.log(a.totalReviews + 1));
      const scoreB = (b.rating * Math.log(b.totalReviews + 1));
      return scoreB - scoreA;
    });
    
    // Smart de-duplication: keep best restaurant when too close
    const filtered: Restaurant[] = [];
    const positions = new Set<string>();
    
    for (const restaurant of sorted) {
      // Check if too close to any existing marker
      let tooClose = false;
      
      for (const existing of filtered) {
        const distance = Math.sqrt(
          Math.pow(restaurant.latitude - existing.latitude, 2) + 
          Math.pow(restaurant.longitude - existing.longitude, 2)
        );
        
        if (distance < minDistance) {
          tooClose = true;
          break;
        }
      }
      
      if (!tooClose) {
        filtered.push(restaurant);
      }
    }
    
    // Based on zoom, decide how many to show as full icons vs dots
    let mainCount: number;
    if (zoom >= 15) {
      mainCount = filtered.length; // Show all filtered as icons when zoomed in close
    } else if (zoom >= 13) {
      mainCount = Math.min(30, filtered.length); // Show top 30 as icons
    } else if (zoom >= 11) {
      mainCount = Math.min(15, filtered.length); // Show top 15 as icons
    } else {
      mainCount = Math.min(8, filtered.length); // Show top 8 as icons
    }
    
    return {
      mainRestaurants: filtered.slice(0, mainCount),
      dotRestaurants: filtered.slice(mainCount)
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
      style: 'mapbox://styles/mapbox/streets-v11', // Clean, modern, minimal style
      center: userLocation,
      zoom: 15.5, // Closer zoom to see details clearly
      pitch: 0,
      attributionControl: false
    });

    // Add user location control with mobile support (manual trigger only)
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      },
      trackUserLocation: true,
      showUserHeading: true,
      showAccuracyCircle: true, // Show blue circle for current location
      fitBoundsOptions: {
        maxZoom: 15.5,
        zoom: 15.5
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
      
      // Get category label (like "israeli bakery", "shop", etc.)
      const getCategoryLabel = () => {
        if (!restaurant.cuisineTypes || restaurant.cuisineTypes.length === 0) return 'place';
        // Get first cuisine type and clean it up
        let category = restaurant.cuisineTypes[0];
        // Remove common prefixes and clean up
        category = category.replace(/_/g, ' ');
        // Remove generic terms
        if (category === 'restaurant' || category === 'food' || category === 'point of interest' || category === 'establishment') {
          // Try to get second type if available
          if (restaurant.cuisineTypes.length > 1) {
            category = restaurant.cuisineTypes[1].replace(/_/g, ' ');
          } else {
            return 'place';
          }
        }
        return category.toLowerCase();
      };
      
      // Main restaurant marker - white circle with icon + text label (transparent background)
      el.innerHTML = `
        <div class="marker-wrapper" style="
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          position: relative;
        ">
          <!-- White circle with icon (no extra ring) -->
          <div class="marker-circle" style="
            width: 40px;
            height: 40px;
            background: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            border: 2px solid ${isFriendOrOwn ? '#C5459C' : '#e5e7eb'};
            transition: all 0.2s ease;
            flex-shrink: 0;
          ">
            <span style="font-size: 20px; line-height: 1;">${iconData.emoji}</span>
          </div>
          
          <!-- Text labels (transparent background with text shadow) -->
          <div class="marker-labels" style="
            display: flex;
            flex-direction: column;
            gap: 0px;
            min-width: 0;
            line-height: 1;
          ">
            <!-- Restaurant name (FIRST - above) -->
            <div style="
              font-size: 10px;
              color: #1f2937;
              font-weight: 600;
              white-space: nowrap;
              max-width: 120px;
              overflow: hidden;
              text-overflow: ellipsis;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              text-shadow: 0 1px 3px rgba(255,255,255,0.9), 0 0 6px rgba(255,255,255,0.95);
              line-height: 1.1;
              margin-bottom: 0px;
            ">
              ${restaurant.name}
            </div>
            
            <!-- Category (SECOND - below, small gray text) -->
            <div style="
              font-size: 9px;
              color: #6b7280;
              font-weight: 500;
              text-transform: lowercase;
              white-space: nowrap;
              letter-spacing: 0.3px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              text-shadow: 0 1px 2px rgba(255,255,255,0.8), 0 0 4px rgba(255,255,255,0.9);
              line-height: 1.1;
              margin-top: 0px;
            ">
              ${getCategoryLabel()}
            </div>
          </div>
        </div>
      `;

      const markerCircle = el.querySelector('.marker-circle') as HTMLElement;
      const markerWrapper = el.querySelector('.marker-wrapper') as HTMLElement;
      el.addEventListener('mouseenter', () => {
        if (markerCircle) {
          markerCircle.style.transform = 'scale(1.1)';
          markerCircle.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
        }
      });
      el.addEventListener('mouseleave', () => {
        if (markerCircle) {
          markerCircle.style.transform = 'scale(1)';
          markerCircle.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
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

