'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TikTokFeed } from '@/components/feed/tiktok-feed';
import { FeedHeader } from '@/components/feed/feed-header';
import { FilterBottomSheet } from '@/components/feed/filter-bottom-sheet';
import { NotificationsPane } from '@/components/feed/notifications-pane';
import { BottomNav } from '@/components/layout/bottom-nav';
import { usePrefetch } from '@/hooks/use-prefetch';

// Session storage keys for feed data persistence
const FEED_DATA_KEY = 'pachu_feed_data';
const FEED_DATA_EXPIRY = 5 * 60 * 1000; // 5 minutes

interface City {
  id: string;
  name: string;
  country?: string;
  latitude: number;
  longitude: number;
}

interface MediaItem {
  id: string;
  type: 'photo' | 'video';
  url: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
}

interface MutualFriend {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface FeedReview {
  id: string;
  rating: number;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  restaurant: {
    id: string;
    name: string;
    address?: string;
    city?: string;
    distance?: number;
    isOpen: boolean;
    matchPercentage: number;
    googlePlaceId?: string;
  };
  media: MediaItem[];
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isSaved: boolean;
  mutualFriends: MutualFriend[];
}

// Helper to load cached feed data from sessionStorage
function loadCachedFeedData(): { forYou: FeedReview[]; following: FeedReview[]; timestamp: number; hasData: boolean } | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = sessionStorage.getItem(FEED_DATA_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      // Check if cache is still valid
      if (Date.now() - data.timestamp < FEED_DATA_EXPIRY) {
        // Add flag to indicate if cache actually has data
        const hasData = (data.forYou?.length > 0) || (data.following?.length > 0);
        return { ...data, hasData };
      }
    }
  } catch {}
  return null;
}

export default function FeedPage() {
  // Get prefetched data from app-level provider (starts loading when app opens!)
  const { userLocation: prefetchedLocation, feedData: prefetchedFeed, feedLoading: prefetchLoading } = usePrefetch();
  
  // Load cached data on mount for instant display
  const cachedData = useRef(loadCachedFeedData());
  
  // Tab and filter state
  const [activeTab, setActiveTab] = useState<'following' | 'foryou'>('foryou');
  const [showFilters, setShowFilters] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [distanceKm, setDistanceKm] = useState(5);
  const [notificationCount, setNotificationCount] = useState(0);
  
  // Determine initial data: prefer prefetched > cached > empty
  const getInitialData = () => {
    // First check prefetched data (most fresh)
    if (prefetchedFeed && (prefetchedFeed.forYou.length > 0 || prefetchedFeed.following.length > 0)) {
      return { forYou: prefetchedFeed.forYou, following: prefetchedFeed.following, hasData: true };
    }
    // Then check cached data
    if (cachedData.current?.hasData) {
      return cachedData.current;
    }
    return { forYou: [], following: [], hasData: false };
  };
  
  const initialData = useRef(getInitialData());
  
  // Feed state - initialize from prefetched or cached data for instant display
  const [forYouReviews, setForYouReviews] = useState<FeedReview[]>(
    () => initialData.current.forYou || []
  );
  const [followingReviews, setFollowingReviews] = useState<FeedReview[]>(
    () => initialData.current.following || []
  );
  // Show loading if we don't have data yet
  // Note: Even if prefetch is loading, we should show our own loading state if no data
  const [loading, setLoading] = useState(!initialData.current.hasData);
  const [loadingMore, setLoadingMore] = useState(false);
  const [forYouPage, setForYouPage] = useState(0);
  const [followingPage, setFollowingPage] = useState(0);
  const [forYouHasMore, setForYouHasMore] = useState(true);
  const [followingHasMore, setFollowingHasMore] = useState(true);
  // Track if we've completed at least one successful load (prevents empty state flicker)
  // ONLY true if we have actual data
  const [hasLoadedOnce, setHasLoadedOnce] = useState(!!initialData.current.hasData);
  
  // Get current tab's data
  const reviews = activeTab === 'foryou' ? forYouReviews : followingReviews;
  const page = activeTab === 'foryou' ? forYouPage : followingPage;
  const hasMore = activeTab === 'foryou' ? forYouHasMore : followingHasMore;
  
  // User location - use prefetched location if available, otherwise default (Tel Aviv)
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number }>(() => {
    if (prefetchedLocation) {
      return { latitude: prefetchedLocation.latitude, longitude: prefetchedLocation.longitude };
    }
    return { latitude: 32.0853, longitude: 34.7818 };
  });
  const [hasAccurateLocation, setHasAccurateLocation] = useState(!!prefetchedLocation);
  
  // Handle tab change - instant switch with cached data
  const handleTabChange = useCallback((tab: 'following' | 'foryou') => {
    if (tab === activeTab) return;
    setActiveTab(tab);
  }, [activeTab]);
  
  // Request tracking
  const latestRequestId = useRef(0);
  const hasFetchedOnMount = useRef(!!initialData.current.hasData); // Skip fetch if we have data
  
  // Update from prefetched data when it arrives
  useEffect(() => {
    if (prefetchedFeed && !hasFetchedOnMount.current) {
      const hasForYouData = prefetchedFeed.forYou.length > 0;
      const hasFollowingData = prefetchedFeed.following.length > 0;
      
      if (hasForYouData) {
        setForYouReviews(prefetchedFeed.forYou);
      }
      if (hasFollowingData) {
        setFollowingReviews(prefetchedFeed.following);
      }
      
      // Only mark as loaded if we actually got data from prefetch
      // Otherwise, let the direct fetch happen
      if (hasForYouData || hasFollowingData) {
        setHasLoadedOnce(true);
        setLoading(false);
        hasFetchedOnMount.current = true;
      }
      // If prefetch returned empty, don't set hasFetchedOnMount
      // This allows the direct fetch to run when userLocation is ready
    }
  }, [prefetchedFeed]);
  
  // Update location from prefetch when it arrives
  useEffect(() => {
    if (prefetchedLocation && !hasAccurateLocation) {
      setUserLocation({
        latitude: prefetchedLocation.latitude,
        longitude: prefetchedLocation.longitude,
      });
      setHasAccurateLocation(true);
    }
  }, [prefetchedLocation, hasAccurateLocation]);

  // Save feed data to sessionStorage for instant return
  useEffect(() => {
    if (forYouReviews.length > 0 || followingReviews.length > 0) {
      try {
        sessionStorage.setItem(FEED_DATA_KEY, JSON.stringify({
          forYou: forYouReviews.slice(0, 20), // Only cache first 20 for each
          following: followingReviews.slice(0, 20),
          timestamp: Date.now(),
        }));
      } catch {}
    }
  }, [forYouReviews, followingReviews]);

  // Get accurate user location - skip if prefetch already provided it
  useEffect(() => {
    // Skip if we already have accurate location from prefetch
    if (hasAccurateLocation) return;
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLat = position.coords.latitude;
        const newLng = position.coords.longitude;
        
        // Only update if location is significantly different (>1km)
        const latDiff = Math.abs(newLat - userLocation.latitude);
        const lngDiff = Math.abs(newLng - userLocation.longitude);
        const significantChange = latDiff > 0.01 || lngDiff > 0.01; // ~1km
        
        if (significantChange) {
          setUserLocation({ latitude: newLat, longitude: newLng });
        }
        setHasAccurateLocation(true);
      },
      (error) => {
        console.warn('Could not get location, using default:', error);
        setHasAccurateLocation(true); // Mark as done even on failure
      },
      { timeout: 5000, maximumAge: 60000 } // Faster timeout, allow cached location
    );
  }, [hasAccurateLocation, userLocation.latitude, userLocation.longitude]);

  // Fetch reviews for a specific tab
  const fetchReviewsForTab = useCallback(async (tab: 'following' | 'foryou', pageNum: number, reset: boolean = false, isBackgroundRefresh: boolean = false) => {
    if (!userLocation) return;
    
    const requestId = ++latestRequestId.current;
    const currentReviews = tab === 'foryou' ? forYouReviews : followingReviews;
    
    try {
      // Only show loading state if:
      // 1. It's a reset AND we have no data yet AND it's not a background refresh
      if (reset && currentReviews.length === 0 && !isBackgroundRefresh) {
        setLoading(true);
      } else if (!reset && !isBackgroundRefresh) {
        // Loading more (pagination) - only show if not background
        setLoadingMore(true);
      }
      // Background refresh: don't show any loader

      const searchLocation = selectedCity || userLocation;
      const radius = distanceKm * 1000;
      // Use smaller batch (5) for initial load for faster first paint, then 10 for pagination
      const limit = reset && currentReviews.length === 0 ? 5 : 10;
      
      const response = await fetch(
        `/api/feed/reviews?page=${pageNum}&limit=${limit}&latitude=${searchLocation.latitude}&longitude=${searchLocation.longitude}&radius=${radius}&tab=${tab}${selectedCity ? `&city=${encodeURIComponent(selectedCity.name)}` : ''}`
      );
      
      const data = await response.json();

      if (requestId === latestRequestId.current) {
        if (data.reviews) {
          const setReviews = tab === 'foryou' ? setForYouReviews : setFollowingReviews;
          const setPageNum = tab === 'foryou' ? setForYouPage : setFollowingPage;
          const setHasMoreTab = tab === 'foryou' ? setForYouHasMore : setFollowingHasMore;
          
          if (reset) {
            setReviews(data.reviews);
          } else {
            setReviews((prev: FeedReview[]) => {
              const combined = [...prev, ...data.reviews];
              const unique = combined.reduce((acc: FeedReview[], review: FeedReview) => {
                if (!acc.find(r => r.id === review.id)) {
                  acc.push(review);
                }
                return acc;
              }, []);
              return unique;
            });
          }
          setHasMoreTab(data.hasMore);
          setPageNum(pageNum);
          // Mark that we've completed at least one successful load
          setHasLoadedOnce(true);
        }
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      // Even on error, mark as loaded to prevent infinite loader
      setHasLoadedOnce(true);
    } finally {
      if (requestId === latestRequestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [userLocation, selectedCity, distanceKm, forYouReviews.length, followingReviews.length]);

  // Initial load - fetch both tabs for instant switching!
  useEffect(() => {
    if (!userLocation) return;
    
    // Fetch if we haven't fetched yet OR if we still don't have data
    const needsFetch = !hasFetchedOnMount.current || 
      (forYouReviews.length === 0 && followingReviews.length === 0 && !hasLoadedOnce);
    
    if (needsFetch) {
      hasFetchedOnMount.current = true;
      // Only do background refresh if we have actual cached data with content
      // Empty arrays don't count - we need to show loader
      const hasActualData = forYouReviews.length > 0 || followingReviews.length > 0;
      fetchReviewsForTab('foryou', 0, true, hasActualData);
      fetchReviewsForTab('following', 0, true, hasActualData);
    }
  }, [userLocation, forYouReviews.length, followingReviews.length, hasLoadedOnce, fetchReviewsForTab]);

  // Refetch when filters change (not tab - tab switch is now instant)
  useEffect(() => {
    if (!userLocation || !hasFetchedOnMount.current) return;
    // Refetch both tabs when filters change
    fetchReviewsForTab('foryou', 0, true);
    fetchReviewsForTab('following', 0, true);
  }, [selectedCity, distanceKm, userLocation, fetchReviewsForTab]);

  // Load more handler
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchReviewsForTab(activeTab, page + 1, false);
    }
  }, [loadingMore, hasMore, page, activeTab, fetchReviewsForTab]);

  // Fetch notification count
  const fetchNotificationCount = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications?limit=1&unreadOnly=true');
      const data = await response.json();
      setNotificationCount(data.unreadCount || 0);
    } catch (error) {
      console.error('Error fetching notification count:', error);
    }
  }, []);

  // Fetch notification count on mount
  useEffect(() => {
    fetchNotificationCount();
  }, [fetchNotificationCount]);

  // Handle notifications marked as read
  const handleNotificationsRead = useCallback(() => {
    setNotificationCount(0);
  }, []);

  // Check if filters are active
  const hasActiveFilters = selectedCity !== null || distanceKm !== 5;

  return (
    <div className="fixed inset-0 bg-black">
      {/* Feed Header */}
      <FeedHeader
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenFilters={() => setShowFilters(true)}
        onOpenNotifications={() => setShowNotifications(true)}
        hasActiveFilters={hasActiveFilters}
        notificationCount={notificationCount}
      />

      {/* Main Feed Content - Full screen, video behind everything */}
      <div className="w-full h-full">
        <TikTokFeed
          key={activeTab}
          reviews={reviews}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          isLoading={loadingMore}
          isInitialLoading={loading}
          hasLoadedOnce={hasLoadedOnce}
          onCommentsVisibilityChange={setShowComments}
        />
      </div>

      {/* Bottom Navigation - always visible */}
      <BottomNav show={!showComments} variant="feed" />

      {/* Filter Bottom Sheet */}
      <FilterBottomSheet
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        selectedCity={selectedCity}
        onSelectCity={setSelectedCity}
        distanceKm={distanceKm}
        onDistanceChange={setDistanceKm}
      />

      {/* Notifications Pane */}
      <NotificationsPane
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onNotificationsRead={handleNotificationsRead}
      />
    </div>
  );
}
