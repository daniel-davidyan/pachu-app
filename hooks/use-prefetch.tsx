'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

interface PlaceResult {
  googlePlaceId: string;
  name: string;
  address: string;
  rating: number;
  photoUrl?: string;
  visitedByFollowing?: Array<{
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  }>;
  distance?: number;
  latitude?: number;
  longitude?: number;
}

interface UserLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface ProfileData {
  profile: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    created_at: string;
  } | null;
  stats: {
    experiences: number;
    followers: number;
    following: number;
  };
  reviews: any[];
  timestamp: number;
}

interface PrefetchContextType {
  // Location
  userLocation: UserLocation | null;
  locationLoading: boolean;
  
  // Nearby places
  nearbyPlaces: PlaceResult[];
  nearbyPlacesLoading: boolean;
  nearbyPlacesError: string | null;
  
  // Profile data
  profileData: ProfileData | null;
  profileLoading: boolean;
  
  // Manual refresh
  refreshNearbyPlaces: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  
  // Status
  isInitialized: boolean;
}

const PrefetchContext = createContext<PrefetchContextType | null>(null);

// Default location (Tel Aviv)
const DEFAULT_LOCATION = { latitude: 32.0853, longitude: 34.7818 };

// Cache duration: 5 minutes for places, 10 minutes for location, 2 minutes for profile
const PLACES_CACHE_DURATION = 5 * 60 * 1000;
const LOCATION_CACHE_DURATION = 10 * 60 * 1000;
const PROFILE_CACHE_DURATION = 2 * 60 * 1000;

export function PrefetchProvider({ children }: { children: React.ReactNode }) {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [nearbyPlaces, setNearbyPlaces] = useState<PlaceResult[]>([]);
  const [nearbyPlacesLoading, setNearbyPlacesLoading] = useState(true);
  const [nearbyPlacesError, setNearbyPlacesError] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const fetchingRef = useRef(false);
  const profileFetchingRef = useRef(false);
  const locationFetchedRef = useRef(false);

  // Get user's location
  const getUserLocation = useCallback(async (): Promise<UserLocation> => {
    // Check if we have a cached location that's still valid
    if (userLocation && Date.now() - userLocation.timestamp < LOCATION_CACHE_DURATION) {
      return userLocation;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false, // Faster response
          timeout: 5000, // 5 second timeout
          maximumAge: LOCATION_CACHE_DURATION, // Accept cached position
        });
      });

      const newLocation: UserLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp: Date.now(),
      };
      
      setUserLocation(newLocation);
      return newLocation;
    } catch (error) {
      console.log('Geolocation error, using default location:', error);
      const defaultLoc: UserLocation = {
        ...DEFAULT_LOCATION,
        timestamp: Date.now(),
      };
      setUserLocation(defaultLoc);
      return defaultLoc;
    }
  }, [userLocation]);

  // Fetch nearby places
  const fetchNearbyPlaces = useCallback(async (location: UserLocation) => {
    if (fetchingRef.current) return;
    
    fetchingRef.current = true;
    setNearbyPlacesLoading(true);
    setNearbyPlacesError(null);

    try {
      const response = await fetch(
        `/api/restaurants/nearby?latitude=${location.latitude}&longitude=${location.longitude}&radius=2000`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch nearby places');
      }
      
      const data = await response.json();
      
      // Calculate distance and sort by closest
      const placesWithDistance = (data.restaurants || []).map((r: any) => {
        const lat = r.latitude || 0;
        const lng = r.longitude || 0;
        
        // Haversine distance in meters
        const R = 6371000;
        const dLat = (lat - location.latitude) * Math.PI / 180;
        const dLng = (lng - location.longitude) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(location.latitude * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        return {
          googlePlaceId: r.googlePlaceId || r.id,
          name: r.name,
          address: r.address,
          rating: r.rating,
          photoUrl: r.photoUrl,
          visitedByFollowing: r.visitedByFollowing || [],
          distance: Math.round(distance),
          latitude: lat,
          longitude: lng,
        };
      });
      
      // Sort by distance (closest first) and take top 5
      const sortedPlaces = placesWithDistance
        .sort((a: PlaceResult, b: PlaceResult) => (a.distance || 0) - (b.distance || 0))
        .slice(0, 5);
      
      setNearbyPlaces(sortedPlaces);
    } catch (error) {
      console.error('Error fetching nearby places:', error);
      setNearbyPlacesError('Failed to load nearby places');
    } finally {
      setNearbyPlacesLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // Fetch profile data
  const fetchProfileData = useCallback(async () => {
    // Check if we have cached data that's still valid
    if (profileData && Date.now() - profileData.timestamp < PROFILE_CACHE_DURATION) {
      return;
    }

    if (profileFetchingRef.current) return;
    
    profileFetchingRef.current = true;
    setProfileLoading(true);

    try {
      const response = await fetch('/api/profile/me?tab=published');
      
      if (!response.ok) {
        // User might not be logged in, that's ok
        setProfileLoading(false);
        profileFetchingRef.current = false;
        return;
      }
      
      const data = await response.json();
      
      if (data.error) {
        // User not logged in or other error
        setProfileLoading(false);
        profileFetchingRef.current = false;
        return;
      }
      
      setProfileData({
        profile: data.profile,
        stats: data.stats,
        reviews: data.reviews,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error prefetching profile:', error);
    } finally {
      setProfileLoading(false);
      profileFetchingRef.current = false;
    }
  }, [profileData]);

  // Initialize on mount - get location and prefetch places + profile in parallel
  useEffect(() => {
    if (locationFetchedRef.current) return;
    locationFetchedRef.current = true;

    const initialize = async () => {
      setLocationLoading(true);
      
      try {
        // Start profile fetch immediately (doesn't need location)
        fetchProfileData();
        
        // Get location and then fetch nearby places
        const location = await getUserLocation();
        setLocationLoading(false);
        
        // Fetch places
        await fetchNearbyPlaces(location);
      } catch (error) {
        console.error('Initialization error:', error);
        setLocationLoading(false);
        setNearbyPlacesLoading(false);
      } finally {
        setIsInitialized(true);
      }
    };

    initialize();
  }, [getUserLocation, fetchNearbyPlaces, fetchProfileData]);

  // Manual refresh functions
  const refreshNearbyPlaces = useCallback(async () => {
    const location = await getUserLocation();
    await fetchNearbyPlaces(location);
  }, [getUserLocation, fetchNearbyPlaces]);

  const refreshProfile = useCallback(async () => {
    // Force refresh by resetting timestamp
    setProfileData(prev => prev ? { ...prev, timestamp: 0 } : null);
    await fetchProfileData();
  }, [fetchProfileData]);

  return (
    <PrefetchContext.Provider
      value={{
        userLocation,
        locationLoading,
        nearbyPlaces,
        nearbyPlacesLoading,
        nearbyPlacesError,
        profileData,
        profileLoading,
        refreshNearbyPlaces,
        refreshProfile,
        isInitialized,
      }}
    >
      {children}
    </PrefetchContext.Provider>
  );
}

export function usePrefetch() {
  const context = useContext(PrefetchContext);
  if (!context) {
    throw new Error('usePrefetch must be used within a PrefetchProvider');
  }
  return context;
}
