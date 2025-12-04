'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { useUser } from '@/hooks/use-user';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { User, Calendar, Edit, Heart, Users, Star, Camera, ChevronRight, Award, Settings } from 'lucide-react';
import Link from 'next/link';

interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

interface Stats {
  reviews: number;
  friends: number;
  wishlist: number;
}

interface Review {
  id: string;
  rating: number;
  content: string;
  created_at: string;
  restaurants: {
    id: string;
    name: string;
    address: string;
    image_url?: string;
  };
  review_photos: Array<{ photo_url: string }>;
}

export default function ProfilePage() {
  const { user } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({ reviews: 0, friends: 0, wishlist: 0 });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchStats();
      fetchReviews();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      if (!user?.id) return;

      // Get review count
      const { count: reviewsCount } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Get friends count (following)
      const { count: friendsCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id);

      // Get wishlist count
      const { count: wishlistCount } = await supabase
        .from('wishlist')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setStats({
        reviews: reviewsCount || 0,
        friends: friendsCount || 0,
        wishlist: wishlistCount || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchReviews = async () => {
    if (!user?.id) return;
    
    setLoadingReviews(true);
    try {
      const response = await fetch(`/api/reviews?userId=${user.id}`);
      const data = await response.json();
      setReviews(data.reviews || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (!profile) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-gray-500 mb-4">Profile not found</p>
            <Link href="/feed" className="text-primary font-medium">Go to Feed</Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="pb-24 bg-gradient-to-b from-white to-gray-50 min-h-screen">
        {/* Header */}
        <div className="px-4 pt-2 pb-4">
          <h1 className="text-xl font-bold text-gray-900">Profile</h1>
        </div>

        {/* Profile Card */}
        <div className="px-4">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Cover + Avatar */}
            <div className="relative">
              <div className="h-24 bg-gradient-to-r from-primary/80 via-primary to-primary/80" />
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                <div className="relative">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name || profile.username}
                      className="w-24 h-24 rounded-full border-4 border-white shadow-lg object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                      <span className="text-3xl font-bold text-white">
                        {(profile.full_name || profile.username).charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <button className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center border border-gray-100 hover:bg-gray-50 transition-colors">
                    <Camera className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="pt-14 pb-5 px-5 text-center">
              <h2 className="text-xl font-bold text-gray-900">
                {profile.full_name || profile.username}
              </h2>
              <p className="text-sm text-gray-500">@{profile.username}</p>
              
              {profile.bio ? (
                <p className="text-sm text-gray-600 mt-3 leading-relaxed">{profile.bio}</p>
              ) : (
                <button className="text-sm text-primary font-medium mt-3 hover:underline">
                  + Add bio
                </button>
              )}

              <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mt-3">
                <Calendar className="w-3.5 h-3.5" />
                <span>Joined {formatDate(profile.created_at)}</span>
              </div>

              {/* Stats Row */}
              <div className="flex justify-center gap-8 mt-5 pt-5 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{stats.reviews}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Reviews</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{stats.friends}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Following</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{stats.wishlist}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Saved</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <button className="flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all active:scale-[0.98]">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Star className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">My Reviews</p>
                <p className="text-xs text-gray-500">{stats.reviews} places</p>
              </div>
            </button>
            <button className="flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all active:scale-[0.98]">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <Heart className="w-5 h-5 text-red-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">Wishlist</p>
                <p className="text-xs text-gray-500">{stats.wishlist} saved</p>
              </div>
            </button>
          </div>
        </div>

        {/* My Reviews Section */}
        <div className="px-4 mt-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">My Reviews</h2>
          
          {loadingReviews ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : reviews.length > 0 ? (
            <div className="space-y-3">
              {reviews.map((review) => (
                <div key={review.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Restaurant Header */}
                  <div className="p-4 flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-xl overflow-hidden flex-shrink-0">
                      {review.restaurants.image_url ? (
                        <img src={review.restaurants.image_url} alt={review.restaurants.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">🍽️</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{review.restaurants.name}</h3>
                      <p className="text-xs text-gray-500 truncate">{review.restaurants.address}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold text-sm">{review.rating}</span>
                    </div>
                  </div>

                  {/* Review Photos */}
                  {review.review_photos && review.review_photos.length > 0 && (
                    <div className="px-4 pb-2">
                      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                        {review.review_photos.map((photo, index) => (
                          <img
                            key={index}
                            src={photo.photo_url}
                            alt=""
                            className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Review Text */}
                  {review.content && (
                    <div className="px-4 pb-4">
                      <p className="text-sm text-gray-700">{review.content}</p>
                    </div>
                  )}

                  {/* Date */}
                  <div className="px-4 pb-4">
                    <p className="text-xs text-gray-400">
                      {new Date(review.created_at).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
              <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No reviews yet</p>
              <p className="text-sm text-gray-400 mt-1">Start sharing your restaurant experiences!</p>
            </div>
          )}
        </div>

        {/* Menu Items */}
        <div className="px-4 mt-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
            <Link href="/profile/edit" className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Edit className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-900">Edit Profile</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
            
            <Link href="/search" className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center">
                  <Users className="w-4 h-4 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-gray-900">Find Friends</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>

            <Link href="/settings" className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Settings className="w-4 h-4 text-gray-600" />
                </div>
                <span className="text-sm font-medium text-gray-900">Settings</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
          </div>
        </div>

        {/* Achievement Banner */}
        <div className="px-4 mt-4">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Start your journey!</p>
                <p className="text-xs text-gray-600 mt-0.5">Write your first review to unlock badges</p>
              </div>
              <ChevronRight className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
