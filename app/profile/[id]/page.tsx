'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { ArrowLeft, UserPlus, UserCheck, Loader2, Heart, Grid3X3, Play } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';

interface Review {
  id: string;
  rating: number;
  title?: string;
  content: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  photos: string[];
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

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({ followersCount: 0, followingCount: 0, reviewsCount: 0, averageRating: 0 });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [mutualFriends, setMutualFriends] = useState<MutualFriend[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const profileId = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    if (profileId) {
      fetchProfile();
    }
  }, [profileId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/profile/${profileId}`);
      const data = await response.json();

      if (data.profile) {
        setProfile(data.profile);
        setStats(data.stats);
        setReviews(data.reviews || []);
        setMutualFriends(data.mutualFriends || []);
        setIsFollowing(data.isFollowing || false);
        setIsOwnProfile(data.isOwnProfile || false);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    try {
      const action = isFollowing ? 'unfollow' : 'follow';
      const response = await fetch('/api/users/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profileId, action }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsFollowing(!isFollowing);
        setStats({
          ...stats,
          followersCount: isFollowing ? stats.followersCount - 1 : stats.followersCount + 1,
        });
        showToast(isFollowing ? 'Unfollowed' : 'Following', 'success');
      } else {
        showToast(`Failed to ${action}`, 'error');
      }
    } catch (error) {
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
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </MainLayout>
    );
  }

  if (!profile) {
    return (
      <MainLayout>
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
    <MainLayout>
      <div className="pb-24 bg-white min-h-screen">
        {/* Header - Instagram Style */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
          <div className="flex items-center px-4 h-14">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 flex items-center justify-center -ml-2"
            >
              <ArrowLeft className="w-6 h-6 text-gray-900" />
            </button>
            <h1 className="flex-1 text-center font-semibold text-gray-900 pr-10">
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
                <p className="text-lg font-semibold text-gray-900">{stats.reviewsCount}</p>
                <p className="text-xs text-gray-500">posts</p>
              </div>
              <button
                onClick={() => router.push(`/profile/${profileId}/connections?tab=followers`)}
                className="text-center"
              >
                <p className="text-lg font-semibold text-gray-900">{stats.followersCount}</p>
                <p className="text-xs text-gray-500">followers</p>
              </button>
              <button
                onClick={() => router.push(`/profile/${profileId}/connections?tab=following`)}
                className="text-center"
              >
                <p className="text-lg font-semibold text-gray-900">{stats.followingCount}</p>
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
                {mutualFriends.slice(0, 3).map((friend) => (
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
            {reviews.map((review) => {
              const thumbnailUrl = review.photos?.[0] || review.restaurant?.imageUrl;
              const hasMultiplePhotos = (review.photos?.length || 0) > 1;
              
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
                    <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <span className="text-2xl">🍽️</span>
                    </div>
                  )}
                  
                  {/* Multiple Photos Indicator */}
                  {hasMultiplePhotos && (
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
