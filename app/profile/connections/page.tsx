'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { UserPlus, UserCheck, Loader2, Users, ArrowLeft } from 'lucide-react';

type ConnectionTab = 'followers' | 'following';

interface User {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  isFollowing: boolean;
}

export default function ConnectionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as ConnectionTab) || 'followers';
  
  const [activeTab, setActiveTab] = useState<ConnectionTab>(initialTab);
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    setLoading(true);
    try {
      // Fetch both followers and following
      const [followersRes, followingRes] = await Promise.all([
        fetch('/api/users/followers'),
        fetch('/api/users/following')
      ]);

      const followersData = await followersRes.json();
      const followingData = await followingRes.json();

      setFollowers(followersData.followers || []);
      setFollowing(followingData.following || []);

      // Create set of users we're following
      const followingIds = new Set<string>(
        (followingData.following || []).map((u: User) => u.id)
      );
      setFollowingUsers(followingIds);
    } catch (error) {
      console.error('Error fetching connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId: string, currentlyFollowing: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const action = currentlyFollowing ? 'unfollow' : 'follow';
      const response = await fetch('/api/users/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      });

      if (!response.ok) {
        throw new Error('Failed to update follow status');
      }

      // Update local state
      const newFollowingUsers = new Set(followingUsers);
      if (currentlyFollowing) {
        newFollowingUsers.delete(userId);
      } else {
        newFollowingUsers.add(userId);
      }
      setFollowingUsers(newFollowingUsers);

      // Update the users in both lists
      setFollowers(prev => prev.map(user => 
        user.id === userId ? { ...user, isFollowing: !currentlyFollowing } : user
      ));
      setFollowing(prev => prev.map(user => 
        user.id === userId ? { ...user, isFollowing: !currentlyFollowing } : user
      ));
    } catch (error) {
      console.error('Error updating follow status:', error);
    }
  };

  const handleUserClick = (userId: string) => {
    router.push(`/profile/${userId}`);
  };

  const currentUsers = activeTab === 'followers' ? followers : following;

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50 pb-24">
        {/* Header with Back Button */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
          <div className="px-4 py-3 flex items-center">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
          </div>

          {/* Tab Selector - Minimal Design with Sliding Underline */}
          <div className="relative border-b border-gray-100">
            {/* Text Buttons */}
            <div className="relative w-full h-10 flex items-center">
              <button
                onClick={() => setActiveTab('followers')}
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
                onClick={() => setActiveTab('following')}
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
            
            {/* Animated Underline - Below Text */}
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

        {/* Users List */}
        <div className="px-4 py-4">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm text-gray-500">Loading...</p>
            </div>
          ) : currentUsers.length > 0 ? (
            <div className="space-y-2.5">
              {currentUsers.map((user) => (
                <div
                  key={user.id}
                  className="bg-white rounded-xl p-3.5 shadow-sm border border-gray-100 hover:border-primary/30 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleUserClick(user.id)}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0">
                        {user.avatar_url ? (
                          <img 
                            src={user.avatar_url} 
                            alt={user.username} 
                            className="w-full h-full rounded-full object-cover" 
                          />
                        ) : (
                          <span>{(user.full_name || user.username).charAt(0).toUpperCase()}</span>
                        )}
                      </div>
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
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">
                No {activeTab} yet
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {activeTab === 'followers' 
                  ? 'People who follow you will appear here' 
                  : 'Start following people to see them here'}
              </p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
