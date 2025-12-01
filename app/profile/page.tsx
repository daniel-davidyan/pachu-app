'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { useUser } from '@/hooks/use-user';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { User, MapPin, Calendar, Edit, Settings, Heart, Users, Star } from 'lucide-react';
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

export default function ProfilePage() {
  const { user } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({ reviews: 0, friends: 0, wishlist: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'reviews' | 'wishlist' | 'friends'>('reviews');
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchStats();
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
      // TODO: Fetch actual stats from database when reviews/friends tables are ready
      setStats({
        reviews: 0,
        friends: 0,
        wishlist: 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-pulse text-gray-400">Loading profile...</div>
        </div>
      </MainLayout>
    );
  }

  if (!profile) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <p className="text-gray-500 mb-4">Profile not found</p>
            <Link href="/feed" className="text-primary hover:text-primary-600">
              Go to Feed
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="pb-6">
        {/* Profile Header */}
        <div className="bg-gradient-to-br from-primary to-primary-700 px-4 pt-4 pb-20">
          <div className="flex justify-end mb-4">
            <Link
              href="/settings"
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <Settings className="w-5 h-5 text-white" />
            </Link>
          </div>
        </div>

        {/* Profile Card */}
        <div className="px-4 -mt-16">
          <div className="bg-white rounded-3xl shadow-xl p-6">
            {/* Avatar and Name */}
            <div className="flex flex-col items-center -mt-16 mb-4">
              <div className="relative">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name || profile.username}
                    className="w-28 h-28 rounded-full border-4 border-white shadow-lg object-cover"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-full border-4 border-white shadow-lg bg-gradient-to-br from-primary-200 to-primary-400 flex items-center justify-center">
                    <User className="w-14 h-14 text-white" />
                  </div>
                )}
                <Link
                  href="/profile/edit"
                  className="absolute bottom-0 right-0 w-9 h-9 bg-primary rounded-full flex items-center justify-center shadow-lg hover:bg-primary-600 transition-colors"
                >
                  <Edit className="w-4 h-4 text-white" />
                </Link>
              </div>

              <h1 className="text-2xl font-bold text-gray-900 mt-4">
                {profile.full_name || profile.username}
              </h1>
              <p className="text-sm text-gray-500">@{profile.username}</p>

              {profile.bio && (
                <p className="text-sm text-gray-600 text-center mt-3 max-w-md">
                  {profile.bio}
                </p>
              )}

              <div className="flex items-center gap-2 text-xs text-gray-500 mt-3">
                <Calendar className="w-4 h-4" />
                <span>Joined {formatDate(profile.created_at)}</span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Star className="w-4 h-4 text-primary" />
                  <span className="text-xl font-bold text-gray-900">{stats.reviews}</span>
                </div>
                <p className="text-xs text-gray-600">Reviews</p>
              </div>

              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-xl font-bold text-gray-900">{stats.friends}</span>
                </div>
                <p className="text-xs text-gray-600">Friends</p>
              </div>

              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Heart className="w-4 h-4 text-primary" />
                  <span className="text-xl font-bold text-gray-900">{stats.wishlist}</span>
                </div>
                <p className="text-xs text-gray-600">Wishlist</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 mt-6">
          <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('reviews')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'reviews'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              My Reviews
            </button>
            <button
              onClick={() => setActiveTab('wishlist')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'wishlist'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Wishlist
            </button>
            <button
              onClick={() => setActiveTab('friends')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'friends'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Friends
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-4 mt-4">
          {activeTab === 'reviews' && (
            <div className="bg-white rounded-2xl shadow p-6 text-center">
              <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No reviews yet</p>
              <p className="text-gray-400 text-xs mt-1">
                Start sharing your restaurant experiences!
              </p>
            </div>
          )}

          {activeTab === 'wishlist' && (
            <div className="bg-white rounded-2xl shadow p-6 text-center">
              <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Your wishlist is empty</p>
              <p className="text-gray-400 text-xs mt-1">
                Save restaurants you want to try!
              </p>
            </div>
          )}

          {activeTab === 'friends' && (
            <div className="bg-white rounded-2xl shadow p-6 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No friends yet</p>
              <p className="text-gray-400 text-xs mt-1">
                Connect with friends to see their reviews!
              </p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
