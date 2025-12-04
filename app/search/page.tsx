'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Search, MapPin, User, Star, Loader2 } from 'lucide-react';

type SearchTab = 'places' | 'users';

interface PlaceResult {
  googlePlaceId: string;
  name: string;
  address: string;
  rating: number;
  photoUrl?: string;
}

interface UserResult {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
}

export default function SearchPage() {
  const [activeTab, setActiveTab] = useState<SearchTab>('places');
  const [searchQuery, setSearchQuery] = useState('');
  const [placesResults, setPlacesResults] = useState<PlaceResult[]>([]);
  const [usersResults, setUsersResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);

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

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-3">
        {/* Search Header */}
        <div className="mb-4">
          <h1 className="text-lg font-bold text-gray-900 mb-3">Discover</h1>
          
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

        {/* Tab Selector */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('places')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all border-2 ${
              activeTab === 'places'
                ? 'bg-primary/10 text-primary border-primary'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            <MapPin className={`w-3.5 h-3.5 ${activeTab === 'places' ? 'text-primary' : ''}`} />
            Places
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all border-2 ${
              activeTab === 'users'
                ? 'bg-primary/10 text-primary border-primary'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            <User className={`w-3.5 h-3.5 ${activeTab === 'users' ? 'text-primary' : ''}`} />
            Users
          </button>
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
                        <div key={place.googlePlaceId || index} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center gap-3">
                          <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                            {place.photoUrl ? (
                              <img src={place.photoUrl} alt={place.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>
                            )}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm text-gray-900">{place.name}</h3>
                            <p className="text-xs text-gray-500 truncate">{place.address}</p>
                            {place.rating > 0 && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                <span className="text-xs font-medium">{place.rating.toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                        </div>
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
                  {/* Popular/Trending Section */}
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 mb-2.5 flex items-center gap-1.5">
                      <span className="text-base">🔥</span>
                      Trending Near You
                    </h2>
                    <div className="space-y-2.5">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm text-gray-900">Restaurant Name {i}</h3>
                            <p className="text-xs text-gray-500">Italian • $$$ • 0.5km away</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              <span className="text-xs font-medium">4.{5 + i}</span>
                              <span className="text-xs text-gray-400">(120 reviews)</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Categories Section */}
                  <div className="mt-4">
                    <h2 className="text-sm font-semibold text-gray-900 mb-2.5 flex items-center gap-1.5">
                      <span className="text-base">🍽️</span>
                      Categories
                    </h2>
                    <div className="grid grid-cols-2 gap-2.5">
                      {['Italian', 'Asian', 'Fast Food', 'Cafe', 'Fine Dining', 'Bars'].map((category) => (
                        <button
                          key={category}
                          className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-left hover:border-primary/30 hover:shadow-md transition-all"
                        >
                          <span className="text-lg mb-1 block">
                            {category === 'Italian' && '🍝'}
                            {category === 'Asian' && '🍜'}
                            {category === 'Fast Food' && '🍔'}
                            {category === 'Cafe' && '☕'}
                            {category === 'Fine Dining' && '🥂'}
                            {category === 'Bars' && '🍺'}
                          </span>
                          <span className="font-medium text-sm text-gray-900">{category}</span>
                        </button>
                      ))}
                    </div>
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
                        <div key={user.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center gap-3">
                          <div className="w-11 h-11 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt={user.username} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              <span>{(user.full_name || user.username).charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm text-gray-900">{user.full_name || user.username}</h3>
                            <p className="text-xs text-gray-500">@{user.username}</p>
                          </div>
                          <button className="px-3 py-1.5 bg-primary text-white rounded-full text-xs font-medium hover:bg-primary/90 transition-colors">
                            Follow
                          </button>
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
                    <div className="space-y-2.5">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center gap-3">
                          <div className="w-11 h-11 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            U{i}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm text-gray-900">User Name {i}</h3>
                            <p className="text-xs text-gray-500">@username{i} • {20 + i * 5} reviews</p>
                          </div>
                          <button className="px-3 py-1.5 bg-primary text-white rounded-full text-xs font-medium hover:bg-primary/90 transition-colors">
                            Follow
                          </button>
                        </div>
                      ))}
                    </div>
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

