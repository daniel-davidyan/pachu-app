'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { MainLayout } from '@/components/layout/main-layout';
import { ArrowLeft, UserPlus, UserCheck, Loader2, Heart, Grid3X3, Play } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import { useFeedData } from '@/components/providers';
import { cacheKeys } from '@/lib/swr-config';

// Subtle pastel gradient palettes for varied backgrounds
const subtleGradients = [
  'from-rose-50/70 via-white to-orange-50/50',
  'from-violet-50/70 via-white to-pink-50/50',
  'from-sky-50/70 via-white to-indigo-50/50',
  'from-emerald-50/70 via-white to-teal-50/50',
  'from-amber-50/70 via-white to-yellow-50/50',
  'from-fuchsia-50/70 via-white to-rose-50/50',
  'from-cyan-50/70 via-white to-blue-50/50',
  'from-lime-50/70 via-white to-green-50/50',
  'from-orange-50/70 via-white to-amber-50/50',
  'from-purple-50/70 via-white to-violet-50/50',
  'from-teal-50/70 via-white to-cyan-50/50',
  'from-pink-50/70 via-white to-fuchsia-50/50',
];

const getSubtleGradient = (postId?: string, restaurantName?: string): string => {
  const str = postId || restaurantName || 'default';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return subtleGradients[Math.abs(hash) % subtleGradients.length];
};

const getRestaurantIcon = (restaurantName?: string): string => {
  const name = (restaurantName || '').toLowerCase();
  if (name.includes('coffee') || name.includes('cafe') || name.includes('קפה')) return '☕';
  if (name.includes('pizza') || name.includes('פיצה')) return '🍕';
  if (name.includes('sushi') || name.includes('סושי') || name.includes('japanese')) return '🍱';
  if (name.includes('burger') || name.includes('המבורגר')) return '🍔';
  if (name.includes('thai') || name.includes('chinese') || name.includes('asian')) return '🥡';
  if (name.includes('mexican') || name.includes('taco')) return '🌮';
  if (name.includes('italian') || name.includes('pasta') || name.includes('פסטה')) return '🍝';
  if (name.includes('bakery') || name.includes('מאפייה') || name.includes('cake')) return '🥐';
  if (name.includes('ice cream') || name.includes('גלידה') || name.includes('gelato')) return '🍨';
  if (name.includes('bar') || name.includes('pub') || name.includes('wine')) return '🍷';
  if (name.includes('hummus') || name.includes('falafel') || name.includes('shawarma')) return '🧆';
  if (name.includes('steak') || name.includes('meat') || name.includes('grill')) return '🥩';
  if (name.includes('breakfast') || name.includes('brunch')) return '🍳';
  if (name.includes('salad') || name.includes('healthy') || name.includes('vegan')) return '🥗';
  return '🍽️';
};

// Mini rating ring for grid thumbnails
const MiniRatingRing = ({ rating, emoji }: { rating: number; emoji: string }) => {
  const size = 52;
  const percentage = (rating / 5) * 100;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  const getGradientColors = () => {
    if (rating >= 4.5) return { start: '#C5459C', middle: '#D975B3', end: '#E8A3CA' };
    if (rating >= 4) return { start: '#B8548E', middle: '#CA83AC', end: '#DCB1C9' };
    if (rating >= 3) return { start: '#A86B8A', middle: '#BC92A8', end: '#D0B9C6' };
    return { start: '#9A7F8E', middle: '#B29FAC', end: '#CABFCA' };
  };
  
  const colors = getGradientColors();
  // Use deterministic ID based on rating and emoji (no Math.random during render)
  const uniqueId = `mini-rating-${rating}-${emoji.charCodeAt(0)}`;
  
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <defs>
          <linearGradient id={uniqueId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.start} />
            <stop offset="50%" stopColor={colors.middle} />
            <stop offset="100%" stopColor={colors.end} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F3F4F6" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={`url(#${uniqueId})`} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl">{emoji}</span>
      </div>
    </div>
  );
};

interface Review {
  id: string;
  rating: number;
  title?: string;
  content: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  photos: string[];
  videos?: Array<{ url: string; thumbnailUrl?: string }>;
  restaurant: {
    id: string;
    name: string;
    address?: string;
    imageUrl?: string;
    googlePlaceId?: string;
  } | null;
}

interface Profile {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  createdAt: string;
}

interface Stats {
  followersCount: number;
  followingCount: number;
  reviewsCount: number;
  averageRating: number;
}

interface MutualFriend {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
}

interface ProfileData {
  profile: Profile;
  stats: Stats;
  reviews: Review[];
  mutualFriends: MutualFriend[];
  isFollowing: boolean;
  isOwnProfile: boolean;
}

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { getCachedProfile } = useFeedData();
  
  const profileId = Array.isArray(params.id) ? params.id[0] : params.id;
  
  // Get cached data from feed for instant display
  const cachedData = profileId ? getCachedProfile(profileId) : null;
  
  // Use SWR for data fetching with fallback from feed cache
  const { data: apiData, error, isLoading, mutate } = useSWR<ProfileData>(
    profileId ? cacheKeys.profile(profileId) : null,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    {
      // Use cached data for instant render, then revalidate
      fallbackData: cachedData as ProfileData | undefined,
      revalidateOnFocus: false,
      revalidateIfStale: true,
    }
  );
  
  // Merge cached and API data (API takes precedence when available)
  const data = apiData || cachedData;
  const profile = data?.profile || null;
  const stats = data?.stats || { followersCount: 0, followingCount: 0, reviewsCount: 0, averageRating: 0 };
  const reviews = data?.reviews || [];
  const mutualFriends = data?.mutualFriends || [];
  const loading = isLoading && !cachedData;
  
  // Derive isOwnProfile directly from API data (no need for local state)
  const isOwnProfile = apiData?.isOwnProfile || false;
  
  // Track user-initiated follow state changes (null = use API value)
  const [followOverride, setFollowOverride] = useState<boolean | null>(null);
  const [statsOverride, setStatsOverride] = useState<{ followersCount: number; followingCount: number; reviewsCount: number; averageRating: number } | null>(null);
  
  // Compute effective values: user override takes precedence, then API data
  const isFollowing = followOverride !== null ? followOverride : (apiData?.isFollowing || false);
  const localStats = statsOverride || apiData?.stats || stats;

  const handleFollow = async () => {
    try {
      const action = isFollowing ? 'unfollow' : 'follow';
      const response = await fetch('/api/users/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profileId, action }),
      });

      if (response.ok) {
        // Optimistic update via override
        setFollowOverride(!isFollowing);
        setStatsOverride({
          ...localStats,
          followersCount: isFollowing ? localStats.followersCount - 1 : localStats.followersCount + 1,
        });
        showToast(isFollowing ? 'Unfollowed' : 'Following', 'success');
        // Revalidate the SWR cache, then clear overrides
        mutate().then(() => {
          setFollowOverride(null);
          setStatsOverride(null);
        });
      } else {
        showToast(`Failed to ${action}`, 'error');
      }
    } catch {
      showToast('Failed to update follow status', 'error');
    }
  };

  const handleShareProfile = async () => {
    const profileUrl = `${window.location.origin}/profile/${profileId}`;
    
    if (navigator.share && profile) {
      try {
        await navigator.share({
          title: `${profile.fullName}'s Profile`,
          text: `Check out ${profile.fullName}'s food experiences on Pachu!`,
          url: profileUrl,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      await navigator.clipboard.writeText(profileUrl);
      showToast('Profile link copied!', 'success');
    }
  };

  if (loading) {
    return (
      <MainLayout showTopBar={false}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </MainLayout>
    );
  }

  if (!profile) {
    return (
      <MainLayout showTopBar={false}>
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <p className="text-gray-500 mb-4">User not found</p>
          <button 
            onClick={() => router.back()}
            className="text-primary font-semibold"
          >
            Go Back
          </button>
        </div>
      </MainLayout>
    );
  }

  // Redirect to own profile page if viewing own profile
  if (isOwnProfile) {
    router.replace('/profile');
    return null;
  }

  return (
    <MainLayout showTopBar={false}>
      <div 
        className="pb-24 bg-white min-h-screen"
        style={{
          marginTop: 'calc(-1 * env(safe-area-inset-top))',
        }}
      >
        {/* Header */}
        <div 
          className="sticky top-0 z-10 bg-white"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex items-center px-4 h-14">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 flex items-center justify-center -ml-2"
            >
              <ArrowLeft className="w-6 h-6 text-gray-900" />
            </button>
            <h1 className="font-semibold text-gray-900 ml-1">
              {profile.username}
            </h1>
          </div>
        </div>

        {/* Profile Header */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.fullName}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-2xl font-semibold text-gray-500">
                    {profile.fullName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="flex-1 flex justify-around">
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900">{localStats.reviewsCount}</p>
                <p className="text-xs text-gray-500">posts</p>
              </div>
              <button
                onClick={() => router.push(`/profile/${profileId}/connections?tab=followers`)}
                className="text-center"
              >
                <p className="text-lg font-semibold text-gray-900">{localStats.followersCount}</p>
                <p className="text-xs text-gray-500">followers</p>
              </button>
              <button
                onClick={() => router.push(`/profile/${profileId}/connections?tab=following`)}
                className="text-center"
              >
                <p className="text-lg font-semibold text-gray-900">{localStats.followingCount}</p>
                <p className="text-xs text-gray-500">following</p>
              </button>
            </div>
          </div>

          {/* Name & Bio */}
          <div className="mt-3">
            <p className="font-semibold text-sm text-gray-900">{profile.fullName}</p>
            {profile.bio && (
              <p className="text-sm text-gray-700 mt-1">{profile.bio}</p>
            )}
          </div>

          {/* Mutual Friends */}
          {mutualFriends.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <div className="flex -space-x-2">
                {mutualFriends.slice(0, 3).map((friend: MutualFriend) => (
                  friend.avatarUrl ? (
                    <img
                      key={friend.id}
                      src={friend.avatarUrl}
                      alt={friend.fullName}
                      className="w-5 h-5 rounded-full border-2 border-white object-cover"
                    />
                  ) : (
                    <div
                      key={friend.id}
                      className="w-5 h-5 rounded-full border-2 border-white bg-gray-300 flex items-center justify-center"
                    >
                      <span className="text-[8px] font-bold text-gray-600">
                        {friend.fullName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )
                ))}
              </div>
              <p className="text-xs text-gray-500">
                Followed by <span className="font-medium text-gray-700">{mutualFriends[0].fullName}</span>
                {mutualFriends.length > 1 && ` + ${mutualFriends.length - 1} more`}
              </p>
            </div>
          )}

          {/* Action Buttons - Instagram Style */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleFollow}
              className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-colors ${
                isFollowing
                  ? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  : 'bg-primary text-white hover:bg-primary/90'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
            <button
              onClick={handleShareProfile}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold text-sm py-2 rounded-lg transition-colors"
            >
              Share profile
            </button>
          </div>
        </div>

        {/* Tab - Instagram Style */}
        <div className="border-t border-gray-200">
          <div className="flex justify-center py-3">
            <button className="text-gray-900 relative">
              <Grid3X3 className="w-6 h-6" />
              <div className="absolute -bottom-3 left-0 right-0 h-[1px] bg-gray-900" />
            </button>
          </div>
        </div>

        {/* Posts Grid - Instagram Style */}
        {reviews.length > 0 ? (
          <div className="grid grid-cols-3 gap-[1px] bg-gray-100">
            {reviews.map((review: Review) => {
              // Only show user-uploaded content (photos or video thumbnails), not Google restaurant images
              const thumbnailUrl = review.photos?.[0] || review.videos?.[0]?.thumbnailUrl;
              const hasMultipleMedia = ((review.photos?.length || 0) + (review.videos?.length || 0)) > 1;
              const hasVideo = (review.videos?.length || 0) > 0 && !review.photos?.[0];
              
              return (
                <Link
                  key={review.id}
                  href={`/profile/${profileId}/feed?startId=${review.id}`}
                  className="relative aspect-square bg-gray-200 overflow-hidden group"
                >
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={review.restaurant?.name || 'Review'}
                      className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                    />
                  ) : (
                    (() => {
                      const emoji = getRestaurantIcon(review.restaurant?.name);
                      const gradient = getSubtleGradient(review.id, review.restaurant?.name);
                      return (
                        <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center p-1.5`}>
                          {/* Restaurant name - at top */}
                          <p className="text-[10px] font-bold text-gray-600 text-center leading-tight line-clamp-1 mb-1 px-0.5">
                            {review.restaurant?.name || 'Restaurant'}
                          </p>
                          
                          {/* Rating ring with icon */}
                          <MiniRatingRing rating={review.rating} emoji={emoji} />
                          
                          {/* Rating number */}
                          <p className="text-[10px] font-bold text-gray-600 mt-0.5">{review.rating.toFixed(1)}</p>
                        </div>
                      );
                    })()
                  )}
                  
                  {/* Video Indicator */}
                  {hasVideo && (
                    <div className="absolute top-2 right-2">
                      <Play className="w-5 h-5 text-white drop-shadow-lg fill-white" />
                    </div>
                  )}
                  
                  {/* Multiple Media Indicator */}
                  {hasMultipleMedia && !hasVideo && (
                    <div className="absolute top-2 right-2">
                      <svg className="w-5 h-5 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M4 6h2v2H4V6zm0 5h2v2H4v-2zm0 5h2v2H4v-2zm16-10h-2V4h2v2zm-4 0H8V4h8v2zm4 5h-2v-2h2v2zm0 5h-2v-2h2v2zM8 20h8v-2H8v2z"/>
                      </svg>
                    </div>
                  )}

                  {/* Hover Overlay with Stats */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <div className="flex items-center gap-1 text-white font-semibold">
                      <Heart className="w-5 h-5 fill-white" />
                      <span>{review.likesCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-1 text-white font-semibold">
                      <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                      </svg>
                      <span>{review.commentsCount || 0}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-12">
            <div className="text-center">
              <div className="w-16 h-16 border-2 border-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-gray-900">No Posts Yet</p>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
