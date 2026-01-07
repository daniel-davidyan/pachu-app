'use client';

import { SlidersHorizontal, Bell } from 'lucide-react';

interface FeedHeaderProps {
  activeTab: 'following' | 'foryou';
  onTabChange: (tab: 'following' | 'foryou') => void;
  onOpenFilters: () => void;
  onOpenNotifications: () => void;
  hasActiveFilters?: boolean;
  notificationCount?: number;
}

export function FeedHeader({ 
  activeTab, 
  onTabChange, 
  onOpenFilters,
  onOpenNotifications,
  hasActiveFilters = false,
  notificationCount = 0,
}: FeedHeaderProps) {
  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
      style={{
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        paddingBottom: '12px',
      }}
    >
      {/* Filter Button */}
      <button
        onClick={onOpenFilters}
        className="relative w-10 h-10 flex items-center justify-center transition-transform active:scale-95"
      >
        <SlidersHorizontal className="w-6 h-6 text-white drop-shadow-lg" />
        {hasActiveFilters && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full" />
        )}
      </button>

      {/* Tabs */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => onTabChange('following')}
          className={`text-base font-semibold transition-all ${
            activeTab === 'following'
              ? 'text-white'
              : 'text-white/60'
          }`}
        >
          Following
          {activeTab === 'following' && (
            <div className="mt-1 h-0.5 bg-white rounded-full mx-auto w-full" />
          )}
        </button>
        <button
          onClick={() => onTabChange('foryou')}
          className={`text-base font-semibold transition-all ${
            activeTab === 'foryou'
              ? 'text-white'
              : 'text-white/60'
          }`}
        >
          For You
          {activeTab === 'foryou' && (
            <div className="mt-1 h-0.5 bg-white rounded-full mx-auto w-full" />
          )}
        </button>
      </div>

      {/* Notifications Button */}
      <button
        onClick={onOpenNotifications}
        className="relative w-10 h-10 flex items-center justify-center transition-transform active:scale-95"
      >
        <Bell className="w-6 h-6 text-white drop-shadow-lg" />
        {notificationCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-primary rounded-full flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          </span>
        )}
      </button>
    </div>
  );
}
