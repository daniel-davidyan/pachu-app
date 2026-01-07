'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TikTokFeed } from '@/components/feed/tiktok-feed';
import { FeedHeader } from '@/components/feed/feed-header';
import { FilterBottomSheet } from '@/components/feed/filter-bottom-sheet';
import { NotificationsPane } from '@/components/feed/notifications-pane';
import { BottomNav } from '@/components/layout/bottom-nav';
import { Loader2 } from 'lucide-react';

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

export default function FeedPage() {
  // Tab and filter state
  const [activeTab, setActiveTab] = useState<'following' | 'foryou'>('foryou');
  const [showFilters, setShowFilters] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [distanceKm, setDistanceKm] = useState(5);
  
  // Feed state - cached per tab for instant switching
  const [forYouReviews, setForYouReviews] = useState<FeedReview[]>([]);
  const [followingReviews, setFollowingReviews] = useState<FeedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [forYouPage, setForYouPage] = useState(0);
  const [followingPage, setFollowingPage] = useState(0);
  const [forYouHasMore, setForYouHasMore] = useState(true);
  const [followingHasMore, setFollowingHasMore] = useState(true);
  
  // Get current tab's data
  const reviews = activeTab === 'foryou' ? forYouReviews : followingReviews;
  const page = activeTab === 'foryou' ? forYouPage : followingPage;
  const hasMore = activeTab === 'foryou' ? forYouHasMore : followingHasMore;
  
  // User location
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  
  // Handle tab change - instant switch with cached data
  const handleTabChange = useCallback((tab: 'following' | 'foryou') => {
    if (tab === activeTab) return;
    setActiveTab(tab);
  }, [activeTab]);
  
  // Request tracking
  const latestRequestId = useRef(0);
  const hasFetchedOnMount = useRef(false);

  // Get user location on mount
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.warn('Could not get location:', error);
        // Default to Tel Aviv
        setUserLocation({ latitude: 32.0853, longitude: 34.7818 });
      }
    );
  }, []);

  // Fetch reviews for a specific tab
  const fetchReviewsForTab = useCallback(async (tab: 'following' | 'foryou', pageNum: number, reset: boolean = false) => {
    if (!userLocation) return;
    
    const requestId = ++latestRequestId.current;
    
    try {
      if (reset && ((tab === 'foryou' && forYouReviews.length === 0) || (tab === 'following' && followingReviews.length === 0))) {
        setLoading(true);
      } else if (!reset) {
        setLoadingMore(true);
      }

      const searchLocation = selectedCity || userLocation;
      const radius = distanceKm * 1000;
      
      const response = await fetch(
        `/api/feed/reviews?page=${pageNum}&limit=10&latitude=${searchLocation.latitude}&longitude=${searchLocation.longitude}&radius=${radius}&tab=${tab}${selectedCity ? `&city=${encodeURIComponent(selectedCity.name)}` : ''}`
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
        }
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
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
    
    if (!hasFetchedOnMount.current) {
      hasFetchedOnMount.current = true;
      // Load both tabs in parallel for instant switching
      fetchReviewsForTab('foryou', 0, true);
      fetchReviewsForTab('following', 0, true);
      return;
    }
  }, [userLocation, fetchReviewsForTab]);

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
        notificationCount={6}
      />

      {/* Main Feed Content - Full screen, video behind everything */}
      <div 
        className="w-full h-full"
      >
        {loading && reviews.length === 0 ? (
          <div className="fixed inset-0 bg-black flex items-center justify-center z-10">
            <div className="text-center">
              {/* Simple fast loader */}
              <div className="w-12 h-12 mx-auto mb-3 rounded-full border-2 border-white/20 border-t-white animate-spin"></div>
              <p className="text-white/50 text-sm">Loading...</p>
            </div>
          </div>
        ) : (
          <TikTokFeed
            reviews={reviews}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            isLoading={loadingMore}
            onCommentsVisibilityChange={setShowComments}
          />
        )}
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
      />
    </div>
  );
}
