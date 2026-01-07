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
  
  // Feed state
  const [reviews, setReviews] = useState<FeedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  // User location
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  
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

  // Fetch reviews
  const fetchReviews = useCallback(async (pageNum: number, reset: boolean = false) => {
    if (!userLocation) return;
    
    const requestId = ++latestRequestId.current;
    
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const searchLocation = selectedCity || userLocation;
      const radius = distanceKm * 1000;
      
      const response = await fetch(
        `/api/feed/reviews?page=${pageNum}&limit=10&latitude=${searchLocation.latitude}&longitude=${searchLocation.longitude}&radius=${radius}&tab=${activeTab}${selectedCity ? `&city=${encodeURIComponent(selectedCity.name)}` : ''}`
      );
      
      const data = await response.json();
      
      console.log('[Feed Page] API Response:', { 
        reviewsCount: data.reviews?.length || 0, 
        hasMore: data.hasMore,
        error: data.error 
      });

      if (requestId === latestRequestId.current) {
        if (data.reviews) {
          if (reset) {
            setReviews(data.reviews);
          } else {
            // Deduplicate when appending
            setReviews(prev => {
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
          setHasMore(data.hasMore);
          setPage(pageNum);
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
  }, [userLocation, selectedCity, distanceKm, activeTab]);

  // Initial load when location is available
  useEffect(() => {
    if (!userLocation) return;
    
    if (!hasFetchedOnMount.current) {
      hasFetchedOnMount.current = true;
      fetchReviews(0, true);
      return;
    }
  }, [userLocation, fetchReviews]);

  // Refetch when tab or filters change
  useEffect(() => {
    if (!userLocation || !hasFetchedOnMount.current) return;
    fetchReviews(0, true);
  }, [activeTab, selectedCity, distanceKm, userLocation, fetchReviews]);

  // Load more handler
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchReviews(page + 1, false);
    }
  }, [loadingMore, hasMore, page, fetchReviews]);

  // Check if filters are active
  const hasActiveFilters = selectedCity !== null || distanceKm !== 5;

  return (
    <div className="fixed inset-0 bg-black">
      {/* Feed Header */}
      <FeedHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenFilters={() => setShowFilters(true)}
        onOpenNotifications={() => setShowNotifications(true)}
        hasActiveFilters={hasActiveFilters}
        notificationCount={6}
      />

      {/* Main Feed Content */}
      <div 
        className="w-full"
        style={{
          height: '100%',
          paddingTop: 'max(60px, calc(52px + env(safe-area-inset-top)))',
          paddingBottom: 'max(70px, calc(56px + env(safe-area-inset-bottom)))',
        }}
      >
        {loading && reviews.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin text-white mx-auto mb-3" />
              <p className="text-white/60 text-sm">Discovering great food...</p>
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

      {/* Bottom Navigation */}
      <BottomNav show={!showFilters && !showComments} variant="feed" />

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
