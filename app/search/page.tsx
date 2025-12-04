'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Search, MapPin, User, Star } from 'lucide-react';

type SearchTab = 'places' | 'users';

export default function SearchPage() {
  const [activeTab, setActiveTab] = useState<SearchTab>('places');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-4">
        {/* Search Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Discover</h1>
          
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={activeTab === 'places' ? 'Search restaurants, cafes...' : 'Search users...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-14 pl-12 pr-4 bg-white rounded-2xl border-2 border-gray-100 focus:border-primary focus:outline-none text-gray-900 placeholder-gray-400 shadow-sm transition-all"
            />
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('places')}
            className={`flex items-center gap-2 px-5 py-3 rounded-full font-medium transition-all ${
              activeTab === 'places'
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <MapPin className="w-4 h-4" />
            Places
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-5 py-3 rounded-full font-medium transition-all ${
              activeTab === 'users'
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <User className="w-4 h-4" />
            Users
          </button>
        </div>

        {/* Search Results */}
        <div className="space-y-4">
          {activeTab === 'places' ? (
            <>
              {/* Places Results */}
              {searchQuery ? (
                <div className="text-center py-12 text-gray-500">
                  <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Search for restaurants and places</p>
                  <p className="text-sm mt-1">Results will appear here</p>
                </div>
              ) : (
                <>
                  {/* Popular/Trending Section */}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-3">🔥 Trending Near You</h2>
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
                          <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center">
                            <MapPin className="w-6 h-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">Restaurant Name {i}</h3>
                            <p className="text-sm text-gray-500">Italian • $$$ • 0.5km away</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm font-medium">4.{5 + i}</span>
                              <span className="text-sm text-gray-400">(120 reviews)</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Categories Section */}
                  <div className="mt-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-3">🍽️ Categories</h2>
                    <div className="grid grid-cols-2 gap-3">
                      {['Italian', 'Asian', 'Fast Food', 'Cafe', 'Fine Dining', 'Bars'].map((category) => (
                        <button
                          key={category}
                          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:border-primary/30 hover:shadow-md transition-all"
                        >
                          <span className="text-2xl mb-2 block">
                            {category === 'Italian' && '🍝'}
                            {category === 'Asian' && '🍜'}
                            {category === 'Fast Food' && '🍔'}
                            {category === 'Cafe' && '☕'}
                            {category === 'Fine Dining' && '🥂'}
                            {category === 'Bars' && '🍺'}
                          </span>
                          <span className="font-medium text-gray-900">{category}</span>
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
                <div className="text-center py-12 text-gray-500">
                  <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Search for users</p>
                  <p className="text-sm mt-1">Find friends and foodies</p>
                </div>
              ) : (
                <>
                  {/* Suggested Users Section */}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-3">👥 Suggested Users</h2>
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
                          <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center text-white font-bold text-lg">
                            U{i}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">User Name {i}</h3>
                            <p className="text-sm text-gray-500">@username{i} • {20 + i * 5} reviews</p>
                          </div>
                          <button className="px-4 py-2 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 transition-colors">
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

