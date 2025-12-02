'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { UtensilsCrossed, Hotel, Briefcase } from 'lucide-react';

export default function FeedPage() {
  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        {/* Category Icons */}
        <div className="flex gap-3 mb-6 justify-center">
          {/* Restaurants - Active */}
          <button 
            style={{ backgroundColor: '#C5459C' }}
            className="flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg transition-all"
            aria-label="Restaurants"
          >
            <UtensilsCrossed className="w-6 h-6 text-white" strokeWidth={2.5} />
          </button>

          {/* Hotels - Disabled */}
          <button 
            disabled
            className="flex items-center justify-center w-14 h-14 bg-gray-200 rounded-2xl shadow-sm opacity-50 cursor-not-allowed"
            aria-label="Hotels (Coming Soon)"
          >
            <Hotel className="w-6 h-6 text-gray-400" strokeWidth={2} />
          </button>

          {/* Business - Disabled */}
          <button 
            disabled
            className="flex items-center justify-center w-14 h-14 bg-gray-200 rounded-2xl shadow-sm opacity-50 cursor-not-allowed"
            aria-label="Business (Coming Soon)"
          >
            <Briefcase className="w-6 h-6 text-gray-400" strokeWidth={2} />
          </button>
        </div>

        {/* Feed Content */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            <p>Feed view coming soon...</p>
            <p className="text-sm mt-2">This is where you'll see your friends' reviews</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

