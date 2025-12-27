'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { 
  ArrowLeft, Star, MapPin, Calendar, UserPlus, UserCheck, 
  Loader2, Settings, Share2, Edit2, Heart 
} from 'lucide-react';
import { CompactRating } from '@/components/ui/modern-rating';
import { formatDistanceToNow, format } from 'date-fns';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import { PostCard, PostCardData } from '@/components/post/post-card';

interface Review {
  id: string;
  rating: number;
  title?: string;
  content: string;
  createdAt: string;
  likesCount: number;
  photos: string[];
  restaurant: {
    id: string;
    name: string;
    address?: string;
    imageUrl?: string;
    averageRating: number;
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

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({ followersCount: 0, followingCount: 0, reviewsCount: 0, averageRating: 0 });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [mutualFriends, setMutualFriends] = useState<MutualFriend[]>([]);
  const [favoriteCuisines, setFavoriteCuisines] = useState<string[]>([]);
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
        setFavoriteCuisines(data.favoriteCuisines || []);
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: profileId,
          action,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsFollowing(!isFollowing);
        setStats({
          ...stats,
          followersCount: isFollowing ? stats.followersCount - 1 : stats.followersCount + 1,
        });
        showToast(
          isFollowing ? 'Unfollowed successfully' : 'Now following',
          'success'
        );
      } else {
        console.error('Failed to follow/unfollow:', data);
        const errorMsg = data.details ? `${data.error}: ${data.details}` : data.error;
        showToast(`Failed to ${action}: ${errorMsg}`, 'error');
      }
    } catch (error) {
      console.error('Error in handleFollow:', error);
      showToast('Failed to update follow status', 'error');
    }
  };

  const handleShare = async () => {
    if (navigator.share && profile) {
      try {
        await navigator.share({
          title: profile.fullName,
          text: `Check out ${profile.fullName}'s profile on Pachu!`,
          url: window.location.href,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
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

  const memberSince = format(new Date(profile.createdAt), 'MMMM yyyy');

  return (
    <MainLayout>
      <div className="pb-24 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            
            <h1 className="font-bold text-lg text-gray-900">Profile</h1>
            
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <Share2 className="w-5 h-5 text-gray-700" />
              </button>
              {isOwnProfile && (
                <Link href="/settings">
                  <button className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                    <Settings className="w-5 h-5 text-gray-700" />
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Compact Profile Header */}
        <div className="bg-white px-4 py-5">
          <div className="flex gap-5">
            {/* Avatar - Left Side */}
            <div className="relative flex-shrink-0">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.fullName}
                  className="w-32 h-32 rounded-full object-cover"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                  <span className="text-4xl font-bold text-white">
                    {profile.fullName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Info - Right Side */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              {/* Name and Username - Left Aligned */}
              <div className="text-left mb-3">
                <h2 className="text-lg font-bold text-gray-900">
                  {profile.fullName}
                </h2>
                <p className="text-sm text-gray-500">@{profile.username}</p>
              </div>

              {/* Stats Row - Aligned to Left */}
              <div className="flex gap-5 items-center">
                <div className="text-left">
                  <p className="text-base font-bold text-gray-900 leading-none">{stats.reviewsCount}</p>
                  <p className="text-xs text-gray-600 mt-1">experiences</p>
                </div>
                <button
                  onClick={() => router.push(`/profile/${profileId}/connections?tab=followers`)}
                  className="text-left hover:opacity-70 transition-opacity"
                >
                  <p className="text-base font-bold text-gray-900 leading-none">{stats.followersCount}</p>
                  <p className="text-xs text-gray-600 mt-1">followers</p>
                </button>
                <button
                  onClick={() => router.push(`/profile/${profileId}/connections?tab=following`)}
                  className="text-left hover:opacity-70 transition-opacity"
                >
                  <p className="text-base font-bold text-gray-900 leading-none">{stats.followingCount}</p>
                  <p className="text-xs text-gray-600 mt-1">following</p>
                </button>
              </div>
            </div>

            {/* Follow/Edit Button - Top Right */}
            {isOwnProfile ? (
              <button
                onClick={() => router.push('/profile/edit')}
                className="w-7 h-7 flex-shrink-0 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors self-start"
              >
                <Edit2 className="w-3.5 h-3.5 text-gray-600" />
              </button>
            ) : null}
          </div>

          {/* Bio - Full Width Below */}
          {profile.bio && (
            <p className="text-xs text-gray-600 mt-3 leading-relaxed">{profile.bio}</p>
          )}

          {/* Follow Button - Full Width if not own profile */}
          {!isOwnProfile && (
            <button
              onClick={handleFollow}
              className={`w-full mt-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                isFollowing
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-gradient-to-r from-primary to-pink-600 text-white hover:from-primary/90 hover:to-pink-600/90'
              }`}
            >
              {isFollowing ? (
                <>
                  <UserCheck className="w-4 h-4 inline-block mr-2 -mt-0.5" />
                  Following
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 inline-block mr-2 -mt-0.5" />
                  Follow
                </>
              )}
            </button>
          )}

          {/* Member Since */}
          <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>Member since {memberSince}</span>
          </div>

          {/* Mutual Friends */}
          {mutualFriends.length > 0 && (
            <div className="mt-3 bg-primary/5 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {mutualFriends.slice(0, 3).map((friend) => (
                    friend.avatarUrl ? (
                      <img
                        key={friend.id}
                        src={friend.avatarUrl}
                        alt={friend.fullName}
                        className="w-6 h-6 rounded-full border-2 border-white object-cover"
                      />
                    ) : (
                      <div
                        key={friend.id}
                        className="w-6 h-6 rounded-full border-2 border-white bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center"
                      >
                        <span className="text-[10px] font-bold text-white">
                          {friend.fullName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )
                  ))}
                </div>
                <p className="text-xs text-gray-700">
                  Followed by{' '}
                  <span className="font-semibold">{mutualFriends[0].fullName}</span>
                  {mutualFriends.length > 1 && (
                    <> and {mutualFriends.length - 1} other{mutualFriends.length > 2 ? 's' : ''} you follow</>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Favorite Cuisines */}
          {favoriteCuisines.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">FAVORITE CUISINES</p>
              <div className="flex flex-wrap gap-2">
                {favoriteCuisines.map((cuisine, index) => (
                  <span 
                    key={index}
                    className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-full"
                  >
                    {cuisine}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Reviews Section */}
        <div className="px-4 py-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {isOwnProfile ? 'My Experiences' : 'Experiences'} ({reviews.length})
          </h2>

          {reviews.length === 0 ? (
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl border-2 border-dashed border-primary/30 p-10 text-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <span className="text-3xl">✨</span>
              </div>
              <p className="text-gray-900 font-bold text-lg">No experiences yet</p>
              <p className="text-sm text-gray-600 mt-2">
                {isOwnProfile ? 'Start sharing your restaurant experiences!' : 'This user hasn\'t shared any experiences yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => {
                const postData: PostCardData = {
                  id: review.id,
                  rating: review.rating,
                  content: review.content,
                  createdAt: review.createdAt,
                  likesCount: review.likesCount || 0,
                  commentsCount: 0,
                  isLiked: false,
                  user: {
                    id: profile.id,
                    username: profile.username,
                    fullName: profile.fullName,
                    avatarUrl: profile.avatarUrl,
                  },
                  photos: review.photos || [],
                  restaurant: review.restaurant ? {
                    id: review.restaurant.id,
                    name: review.restaurant.name,
                    address: review.restaurant.address || '',
                    imageUrl: review.restaurant.imageUrl,
                    googlePlaceId: undefined,
                  } : {
                    id: '',
                    name: 'Restaurant',
                    address: '',
                    imageUrl: undefined,
                    googlePlaceId: undefined,
                  },
                };

                return (
                  <PostCard
                    key={review.id}
                    post={postData}
                    showRestaurantInfo={true}
                    onUpdate={() => {
                      fetchProfile();
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

