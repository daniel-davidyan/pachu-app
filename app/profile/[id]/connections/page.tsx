'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { UserPlus, UserCheck, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

type ConnectionTab = 'followers' | 'following';

interface User {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  isFollowing: boolean;
}

export default function UserConnectionsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = Array.isArray(params.id) ? params.id[0] : params.id;
  const initialTab = (searchParams.get('tab') as ConnectionTab) || 'followers';
  
  const [activeTab, setActiveTab] = useState<ConnectionTab>(initialTab);
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profileId) {
      fetchConnections();
    }
  }, [profileId]);

  const fetchConnections = async () => {
    setLoading(true);
    try {
      // Fetch both followers and following for the specified user
      const [followersRes, followingRes] = await Promise.all([
        fetch(`/api/users/followers?userId=${profileId}`),
        fetch(`/api/users/following?userId=${profileId}`)
      ]);

      const followersData = await followersRes.json();
      const followingData = await followingRes.json();

      setFollowers(followersData.followers || []);
      setFollowing(followingData.following || []);
    } catch (error) {
      console.error('Error fetching connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId: string, currentlyFollowing: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const response = await fetch('/api/users/follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          action: currentlyFollowing ? 'unfollow' : 'follow',
        }),
      });

      if (response.ok) {
        // Update the user in both lists
        const updateUser = (user: User) => 
          user.id === userId ? { ...user, isFollowing: !currentlyFollowing } : user;
        
        setFollowers(prev => prev.map(updateUser));
        setFollowing(prev => prev.map(updateUser));
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  const handleTabChange = (tab: ConnectionTab) => {
    setActiveTab(tab);
    router.push(`/profile/${profileId}/connections?tab=${tab}`);
  };

  const currentUsers = activeTab === 'followers' ? followers : following;

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            
            <h1 className="font-bold text-lg text-gray-900">Connections</h1>
            
            <div className="w-10" />
          </div>

          {/* Tab Selector */}
          <div className="relative">
            {/* Text Buttons */}
            <div className="relative w-full h-12 flex items-center">
              <button
                onClick={() => handleTabChange('followers')}
                className="absolute transition-colors"
                style={{ left: '25%', transform: 'translateX(-50%)' }}
              >
                <span 
                  className={`text-base font-medium transition-all duration-300 ${
                    activeTab === 'followers' ? 'text-[#C5459C]' : 'text-black'
                  }`}
                >
                  Followers
                </span>
              </button>
              <button
                onClick={() => handleTabChange('following')}
                className="absolute transition-colors"
                style={{ left: '75%', transform: 'translateX(-50%)' }}
              >
                <span 
                  className={`text-base font-medium transition-all duration-300 ${
                    activeTab === 'following' ? 'text-[#C5459C]' : 'text-black'
                  }`}
                >
                  Following
                </span>
              </button>
            </div>
            
            {/* Animated Underline */}
            <div className="relative w-full">
              <div 
                className="h-0.5 rounded-full transition-all duration-300 ease-out"
                style={{
                  backgroundColor: '#C5459C',
                  boxShadow: '0 0 8px rgba(197, 69, 156, 0.4)',
                  marginLeft: activeTab === 'followers' ? '0%' : '50%',
                  width: '50%'
                }}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : currentUsers.length > 0 ? (
            <div className="space-y-2.5">
              {currentUsers.map((user) => (
                <div
                  key={user.id}
                  className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-100"
                >
                  <button
                    onClick={() => router.push(`/profile/${user.id}`)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.full_name || user.username}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg font-bold text-white">
                          {(user.full_name || user.username).charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-gray-900 truncate">
                        {user.full_name || user.username}
                      </h3>
                      <p className="text-xs text-gray-500 truncate">@{user.username}</p>
                      {user.bio && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-1">{user.bio}</p>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={(e) => handleFollow(user.id, user.isFollowing, e)}
                    className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 flex-shrink-0 ${
                      user.isFollowing
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-primary text-white hover:bg-primary/90'
                    }`}
                  >
                    {user.isFollowing ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Follow</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">
                {activeTab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
              </p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

