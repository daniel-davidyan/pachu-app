'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { 
  ArrowLeft, Star, MapPin, Users, Calendar, UserPlus, UserCheck, 
  Loader2, Settings, Share2 
} from 'lucide-react';
import { CompactRating } from '@/components/ui/modern-rating';
import { formatDistanceToNow, format } from 'date-fns';
import Link from 'next/link';

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
      } else {
        console.error('Failed to follow/unfollow:', data);
        const errorMsg = data.details ? `${data.error}: ${data.details}` : data.error;
        alert(`Failed to ${action}: ${errorMsg}\n\nPlease check the console for more details.`);
      }
    } catch (error) {
      console.error('Error in handleFollow:', error);
      alert('Failed to update follow status');
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
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            
            <h1 className="font-bold text-lg text-gray-900">Profile</h1>
            
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <Share2 className="w-5 h-5 text-gray-700" />
              </button>
              {isOwnProfile && (
                <Link href="/settings">
                  <button className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-gray-700" />
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Profile Info */}
        <div className="bg-white px-4 py-6 border-b border-gray-200">
          <div className="flex items-start gap-4 mb-4">
            {/* Avatar */}
            <div className="relative">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.fullName}
                  className="w-20 h-20 rounded-full object-cover border-4 border-gray-100"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center text-white font-bold text-2xl border-4 border-gray-100">
                  {profile.fullName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Name and Bio */}
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">{profile.fullName}</h2>
              <p className="text-gray-500 text-sm mb-2">@{profile.username}</p>
              {profile.bio && (
                <p className="text-gray-600 text-sm leading-relaxed">{profile.bio}</p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1 text-center py-3 bg-gray-50 rounded-xl">
              <p className="text-2xl font-bold text-gray-900">{stats.reviewsCount}</p>
              <p className="text-xs text-gray-500">Reviews</p>
            </div>
            <div className="flex-1 text-center py-3 bg-gray-50 rounded-xl">
              <p className="text-2xl font-bold text-gray-900">{stats.followersCount}</p>
              <p className="text-xs text-gray-500">Followers</p>
            </div>
            <div className="flex-1 text-center py-3 bg-gray-50 rounded-xl">
              <p className="text-2xl font-bold text-gray-900">{stats.followingCount}</p>
              <p className="text-xs text-gray-500">Following</p>
            </div>
          </div>

          {/* Average Rating */}
          {stats.reviewsCount > 0 && (
            <div className="flex items-center justify-center gap-2 mb-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl">
              <CompactRating rating={stats.averageRating} showEmoji={false} />
              <span className="font-bold text-sm text-gray-600">
                avg rating
              </span>
            </div>
          )}

          {/* Follow Button */}
          {!isOwnProfile && (
            <button
              onClick={handleFollow}
              className={`w-full py-3 rounded-xl font-bold text-base transition-all shadow-md hover:shadow-lg ${
                isFollowing
                  ? 'bg-white border-2 border-gray-300 text-gray-800 hover:bg-gray-50 active:scale-95'
                  : 'bg-gradient-to-r from-primary to-pink-600 text-white hover:from-primary/90 hover:to-pink-600/90 active:scale-95'
              }`}
            >
              {isFollowing ? (
                <>
                  <UserCheck className="w-5 h-5 inline-block mr-2 -mt-0.5" />
                  Following
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 inline-block mr-2 -mt-0.5" />
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
            <div className="mt-4 bg-primary/5 rounded-xl p-3">
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
            Reviews ({reviews.length})
          </h2>

          {reviews.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No reviews yet</p>
              <p className="text-sm text-gray-400 mt-1">
                {isOwnProfile ? 'Start reviewing restaurants!' : 'This user hasn\'t reviewed any restaurants yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <Link key={review.id} href={`/review/${review.id}`}>
                  <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                    {/* Restaurant Info */}
                    {review.restaurant && (
                      <div className="flex items-center gap-3 p-3 border-b border-gray-100">
                        {review.restaurant.imageUrl ? (
                          <img
                            src={review.restaurant.imageUrl}
                            alt={review.restaurant.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                            <span className="text-2xl">🍽️</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">
                            {review.restaurant.name}
                          </p>
                          {review.restaurant.address && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              <p className="text-xs text-gray-500 truncate">
                                {review.restaurant.address}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5">
                          <CompactRating rating={review.rating} showEmoji={true} />
                        </div>
                      </div>
                    )}

                    {/* Review Photos */}
                    {review.photos && review.photos.length > 0 && (
                      <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                        {review.photos.slice(0, 3).map((photo, index) => (
                          <img
                            key={index}
                            src={photo}
                            alt={`Review photo ${index + 1}`}
                            className="w-32 h-32 object-cover flex-shrink-0"
                          />
                        ))}
                        {review.photos.length > 3 && (
                          <div className="w-32 h-32 bg-gray-900/80 flex items-center justify-center text-white font-bold">
                            +{review.photos.length - 3}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Review Content */}
                    <div className="p-3">
                      {review.title && (
                        <h3 className="font-semibold text-gray-900 mb-1">{review.title}</h3>
                      )}
                      {review.content && (
                        <p className="text-sm text-gray-600 leading-relaxed line-clamp-3 mb-2">
                          {review.content}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

