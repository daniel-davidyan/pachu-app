'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Search, MapPin, User, Star, Loader2, UserPlus, UserCheck } from 'lucide-react';
import { formatAddress } from '@/lib/address-utils';

type SearchTab = 'places' | 'users';

interface VisitedUser {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
}

interface PlaceResult {
  googlePlaceId: string;
  name: string;
  address: string;
  rating: number;
  photoUrl?: string;
  visitedByFollowing?: VisitedUser[];
  distance?: number; // meters
}

interface MutualFriend {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
}

interface UserResult {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  mutualFriends?: MutualFriend[];
  isFollowing?: boolean;
}

export default function SearchPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SearchTab>('places');
  const [searchQuery, setSearchQuery] = useState('');
  const [placesResults, setPlacesResults] = useState<PlaceResult[]>([]);
  const [usersResults, setUsersResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [trendingPlaces, setTrendingPlaces] = useState<PlaceResult[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserResult[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [loadingSuggested, setLoadingSuggested] = useState(false);
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set());

  // Search for places
  useEffect(() => {
    if (!searchQuery.trim() || activeTab !== 'places') {
      setPlacesResults([]);
      return;
    }

    const searchPlaces = async () => {
      setSearching(true);
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        }).catch(() => ({ coords: { latitude: 32.0853, longitude: 34.7818 } } as GeolocationPosition));

        const response = await fetch(
          `/api/restaurants/search?query=${encodeURIComponent(searchQuery)}&latitude=${position.coords.latitude}&longitude=${position.coords.longitude}`
        );
        const data = await response.json();
        setPlacesResults(data.restaurants || []);
      } catch (error) {
        console.error('Search error:', error);
        setPlacesResults([]);
      } finally {
        setSearching(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(searchPlaces, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, activeTab]);

  // Search for users
  useEffect(() => {
    if (!searchQuery.trim() || activeTab !== 'users') {
      setUsersResults([]);
      return;
    }

    const searchUsers = async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/users/search?query=${encodeURIComponent(searchQuery)}`);
        const data = await response.json();
        setUsersResults(data.users || []);
      } catch (error) {
        console.error('User search error:', error);
        setUsersResults([]);
      } finally {
        setSearching(false);
      }
    };

    const timeoutId = setTimeout(searchUsers, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, activeTab]);

  const loadTrendingPlaces = useCallback(async () => {
    setLoadingTrending(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      }).catch(() => ({ coords: { latitude: 32.0853, longitude: 34.7818 } } as GeolocationPosition));

      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      const response = await fetch(
        `/api/restaurants/nearby?latitude=${userLat}&longitude=${userLng}&radius=2000`
      );
      const data = await response.json();
      
      // Calculate distance and sort by closest
      const placesWithDistance = (data.restaurants || []).map((r: any) => {
        const lat = r.latitude || 0;
        const lng = r.longitude || 0;
        // Haversine distance in meters
        const R = 6371000;
        const dLat = (lat - userLat) * Math.PI / 180;
        const dLng = (lng - userLng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(userLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        return {
          googlePlaceId: r.googlePlaceId || r.id,
          name: r.name,
          address: r.address,
          rating: r.rating,
          photoUrl: r.photoUrl,
          visitedByFollowing: r.visitedByFollowing || [],
          distance: Math.round(distance), // meters
        };
      });
      
      // Sort by distance (closest first) and take top 5
      const nearbyPlaces = placesWithDistance
        .sort((a: any, b: any) => a.distance - b.distance)
        .slice(0, 5);
      
      setTrendingPlaces(nearbyPlaces);
    } catch (error) {
      console.error('Error loading nearby places:', error);
      setTrendingPlaces([]);
    } finally {
      setLoadingTrending(false);
    }
  }, []);

  const loadSuggestedUsers = useCallback(async () => {
    setLoadingSuggested(true);
    try {
      // Use search API with empty query to get some users
      const response = await fetch(`/api/users/search?query=`);
      const data = await response.json();
      setSuggestedUsers((data.users || []).slice(0, 5));
    } catch (error) {
      console.error('Error loading suggested users:', error);
      setSuggestedUsers([]);
    } finally {
      setLoadingSuggested(false);
    }
  }, []);

  // Load trending places near user
  useEffect(() => {
    if (activeTab === 'places' && !searchQuery) {
      loadTrendingPlaces();
    }
  }, [activeTab, searchQuery, loadTrendingPlaces]);

  // Load suggested users
  useEffect(() => {
    if (activeTab === 'users' && !searchQuery) {
      loadSuggestedUsers();
    }
  }, [activeTab, searchQuery, loadSuggestedUsers]);

  const handlePlaceClick = (place: PlaceResult) => {
    router.push(`/restaurant/${place.googlePlaceId}`);
  };

  const handleUserClick = (user: UserResult) => {
    router.push(`/profile/${user.id}`);
  };

  const handleFollow = async (userId: string, currentlyFollowing: boolean, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation to profile
    
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

      // Update the user in the results
      setUsersResults(prev => prev.map(user => 
        user.id === userId ? { ...user, isFollowing: !currentlyFollowing } : user
      ));
      setSuggestedUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, isFollowing: !currentlyFollowing } : user
      ));
    } catch (error) {
      console.error('Error updating follow status:', error);
    }
  };

  return (
    <MainLayout showTopBar={false}>
      <div className="container mx-auto px-4 py-3">
        {/* Search Header */}
        <div className="mb-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={activeTab === 'places' ? 'Search restaurants, cafes...' : 'Search users...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-4 bg-white rounded-2xl border-2 border-gray-100 focus:border-primary focus:outline-none text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-all"
            />
          </div>
        </div>

        {/* Tab Selector - Minimal Design with Sliding Underline */}
        <div className="relative border-b border-gray-100 mb-4">
          {/* Text Buttons */}
          <div className="relative w-full h-10 flex items-center">
            <button
              onClick={() => setActiveTab('places')}
              className="absolute transition-colors"
              style={{ left: '25%', transform: 'translateX(-50%)' }}
            >
              <span 
                className={`text-base font-medium transition-all duration-300 ${
                  activeTab === 'places' ? 'text-[#C5459C]' : 'text-black'
                }`}
              >
                Places
              </span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className="absolute transition-colors"
              style={{ left: '75%', transform: 'translateX(-50%)' }}
            >
              <span 
                className={`text-base font-medium transition-all duration-300 ${
                  activeTab === 'users' ? 'text-[#C5459C]' : 'text-black'
                }`}
              >
                Users
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
                marginLeft: activeTab === 'places' ? '0%' : '50%',
                width: '50%'
              }}
            />
          </div>
        </div>

        {/* Search Results */}
        <div className="space-y-4">
          {activeTab === 'places' ? (
            <>
              {/* Places Results */}
              {searchQuery ? (
                <>
                  {searching ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Searching...</p>
                    </div>
                  ) : placesResults.length > 0 ? (
                    <div className="space-y-2.5">
                      {placesResults.map((place, index) => (
                        <button
                          key={place.googlePlaceId || index}
                          onClick={() => handlePlaceClick(place)}
                          className="w-full bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center gap-3 hover:border-primary/30 hover:shadow-md transition-all text-left"
                        >
                          <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                            {place.photoUrl ? (
                              <img src={place.photoUrl} alt={place.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <h3 className="font-semibold text-sm text-gray-900 truncate">{place.name}</h3>
                            <p className="text-xs text-gray-500 truncate">{formatAddress(place.address)}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {place.rating > 0 && (
                                <div className="bg-white border border-gray-200 rounded-full px-2 py-0.5 shadow-sm">
                                  <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-green-400 to-green-500 animate-pulse" />
                                    <span className="text-xs font-bold text-gray-900">{Math.round((place.rating / 5) * 100)}%</span>
                                    <span className="text-[9px] text-gray-500">match</span>
                                  </div>
                                </div>
                              )}
                              {place.visitedByFollowing && place.visitedByFollowing.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <div className="flex -space-x-1.5">
                                    {place.visitedByFollowing.slice(0, 3).map((user, idx) => (
                                      <div 
                                        key={user.id} 
                                        className="w-5 h-5 rounded-full border-2 border-white bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-[10px] font-bold"
                                        style={{ zIndex: 3 - idx }}
                                      >
                                        {user.avatarUrl ? (
                                          <img src={user.avatarUrl} alt={user.username} className="w-full h-full rounded-full object-cover" />
                                        ) : (
                                          <span>{user.fullName.charAt(0).toUpperCase()}</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <span className="text-[10px] text-gray-600 ml-0.5">
                                    {place.visitedByFollowing.length === 1 
                                      ? `${place.visitedByFollowing[0].fullName} experienced`
                                      : place.visitedByFollowing.length === 2
                                        ? `${place.visitedByFollowing[0].fullName} & ${place.visitedByFollowing[1].fullName} experienced`
                                        : `${place.visitedByFollowing[0].fullName} & ${place.visitedByFollowing.length - 1} others experienced`
                                    }
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Search className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm">No places found</p>
                      <p className="text-xs mt-1">Try a different search term</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Places Near You Section */}
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 mb-2.5 flex items-center gap-1.5">
                      <span className="text-base">📍</span>
                      Places Near You
                    </h2>
                    {loadingTrending ? (
                      <div className="text-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Finding places near you...</p>
                      </div>
                    ) : trendingPlaces.length > 0 ? (
                      <div className="space-y-2.5">
                        {trendingPlaces.map((place) => (
                          <button
                            key={place.googlePlaceId}
                            onClick={() => handlePlaceClick(place)}
                            className="w-full bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center gap-3 hover:border-primary/30 hover:shadow-md transition-all text-left"
                          >
                            <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                              {place.photoUrl ? (
                                <img src={place.photoUrl} alt={place.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10">
                                  <MapPin className="w-5 h-5 text-primary" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <h3 className="font-semibold text-sm text-gray-900 truncate">{place.name}</h3>
                              <p className="text-xs text-gray-500 truncate">{formatAddress(place.address)}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {place.distance !== undefined && (
                                  <div className="bg-white border border-gray-200 rounded-full px-2 py-0.5 shadow-sm">
                                    <div className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3 text-primary" />
                                      <span className="text-xs font-bold text-gray-900">
                                        {place.distance < 1000 
                                          ? `${place.distance}m` 
                                          : `${(place.distance / 1000).toFixed(1)}km`}
                                      </span>
                                    </div>
                                  </div>
                                )}
                                {place.rating > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                    <span className="text-xs text-gray-700">{place.rating.toFixed(1)}</span>
                                  </div>
                                )}
                                {place.visitedByFollowing && place.visitedByFollowing.length > 0 && (
                                  <div className="flex items-center gap-1">
                                    <div className="flex -space-x-1.5">
                                      {place.visitedByFollowing.slice(0, 3).map((user, idx) => (
                                        <div 
                                          key={user.id} 
                                          className="w-5 h-5 rounded-full border-2 border-white bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-[10px] font-bold"
                                          style={{ zIndex: 3 - idx }}
                                        >
                                          {user.avatarUrl ? (
                                            <img src={user.avatarUrl} alt={user.username} className="w-full h-full rounded-full object-cover" />
                                          ) : (
                                            <span>{user.fullName.charAt(0).toUpperCase()}</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                    <span className="text-[10px] text-gray-600 ml-0.5">
                                      {place.visitedByFollowing.length === 1 
                                        ? `${place.visitedByFollowing[0].fullName} experienced`
                                        : place.visitedByFollowing.length === 2
                                          ? `${place.visitedByFollowing[0].fullName} & ${place.visitedByFollowing[1].fullName} experienced`
                                          : `${place.visitedByFollowing[0].fullName} & ${place.visitedByFollowing.length - 1} others experienced`
                                      }
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <MapPin className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm">No places found nearby</p>
                        <p className="text-xs mt-1">Try searching for restaurants</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              {/* Users Results */}
              {searchQuery ? (
                <>
                  {searching ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Searching...</p>
                    </div>
                  ) : usersResults.length > 0 ? (
                    <div className="space-y-2.5">
                      {usersResults.map((user) => (
                        <div
                          key={user.id}
                          className="w-full bg-white rounded-xl p-3 shadow-sm border border-gray-100 hover:border-primary/30 hover:shadow-md transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleUserClick(user)}
                              className="flex items-center gap-3 flex-1 text-left"
                            >
                              <div className="w-11 h-11 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                {user.avatar_url ? (
                                  <img src={user.avatar_url} alt={user.username} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  <span>{(user.full_name || user.username).charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm text-gray-900 truncate">{user.full_name || user.username}</h3>
                                <p className="text-xs text-gray-500 truncate">@{user.username}</p>
                                {user.mutualFriends && user.mutualFriends.length > 0 && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <div className="flex -space-x-1.5">
                                      {user.mutualFriends.slice(0, 3).map((friend, idx) => (
                                        <div 
                                          key={friend.id} 
                                          className="w-4 h-4 rounded-full border border-white bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-[8px] font-bold"
                                          style={{ zIndex: 3 - idx }}
                                        >
                                          {friend.avatarUrl ? (
                                            <img src={friend.avatarUrl} alt={friend.username} className="w-full h-full rounded-full object-cover" />
                                          ) : (
                                            <span>{friend.fullName.charAt(0).toUpperCase()}</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                    <span className="text-[10px] text-gray-600">
                                      {user.mutualFriends.length === 1
                                        ? `${user.mutualFriends[0].fullName.split(' ')[0]} follows`
                                        : `${user.mutualFriends.length} mutual friends`
                                      }
                                    </span>
                                  </div>
                                )}
                              </div>
                            </button>
                            <button
                              onClick={(e) => handleFollow(user.id, user.isFollowing || false, e)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
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
                    <div className="text-center py-8 text-gray-500">
                      <User className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm">No users found</p>
                      <p className="text-xs mt-1">Try a different search term</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Suggested Users Section */}
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 mb-2.5 flex items-center gap-1.5">
                      <span className="text-base">👥</span>
                      Suggested Users
                    </h2>
                    {loadingSuggested ? (
                      <div className="text-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Loading suggested users...</p>
                      </div>
                    ) : suggestedUsers.length > 0 ? (
                      <div className="space-y-2.5">
                        {suggestedUsers.map((user) => (
                          <div
                            key={user.id}
                            className="w-full bg-white rounded-xl p-3 shadow-sm border border-gray-100 hover:border-primary/30 hover:shadow-md transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleUserClick(user)}
                                className="flex items-center gap-3 flex-1 text-left"
                              >
                                <div className="w-11 h-11 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                  {user.avatar_url ? (
                                    <img src={user.avatar_url} alt={user.username} className="w-full h-full rounded-full object-cover" />
                                  ) : (
                                    <span>{(user.full_name || user.username).charAt(0).toUpperCase()}</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-sm text-gray-900 truncate">{user.full_name || user.username}</h3>
                                  <p className="text-xs text-gray-500 truncate">@{user.username}</p>
                                  {user.mutualFriends && user.mutualFriends.length > 0 && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <div className="flex -space-x-1.5">
                                        {user.mutualFriends.slice(0, 3).map((friend, idx) => (
                                          <div 
                                            key={friend.id} 
                                            className="w-4 h-4 rounded-full border border-white bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-[8px] font-bold"
                                            style={{ zIndex: 3 - idx }}
                                          >
                                            {friend.avatarUrl ? (
                                              <img src={friend.avatarUrl} alt={friend.username} className="w-full h-full rounded-full object-cover" />
                                            ) : (
                                              <span>{friend.fullName.charAt(0).toUpperCase()}</span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                      <span className="text-[10px] text-gray-600">
                                        {user.mutualFriends.length === 1
                                          ? `${user.mutualFriends[0].fullName.split(' ')[0]} follows`
                                          : `${user.mutualFriends.length} mutual friends`
                                        }
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </button>
                              <button
                                onClick={(e) => handleFollow(user.id, user.isFollowing || false, e)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
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
                      <div className="text-center py-8 text-gray-500">
                        <User className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm">No suggested users found</p>
                        <p className="text-xs mt-1">Try searching for users</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

