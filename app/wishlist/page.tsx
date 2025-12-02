'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { UtensilsCrossed, Hotel, Briefcase } from 'lucide-react';

export default function WishlistPage() {
  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        {/* Category Icons */}
        <div className="flex gap-4 mb-6 justify-center items-center">
          {/* Restaurants - Active */}
          <div className="flex flex-col items-center">
            <button 
              style={{ backgroundColor: '#C5459C' }}
              className="flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg transition-all"
              aria-label="Restaurants"
            >
              <UtensilsCrossed className="w-6 h-6 text-white" strokeWidth={2.5} />
            </button>
          </div>

          {/* Hotels - Disabled */}
          <div className="flex flex-col items-center">
            <button 
              disabled
              className="flex items-center justify-center w-14 h-14 bg-gray-200 rounded-2xl shadow-sm opacity-50 cursor-not-allowed"
              aria-label="Hotels (Coming Soon)"
            >
              <Hotel className="w-6 h-6 text-gray-400" strokeWidth={2} />
            </button>
            <span className="text-[10px] text-gray-400 mt-1.5 font-medium">Coming Soon</span>
          </div>

          {/* Business - Disabled */}
          <div className="flex flex-col items-center">
            <button 
              disabled
              className="flex items-center justify-center w-14 h-14 bg-gray-200 rounded-2xl shadow-sm opacity-50 cursor-not-allowed"
              aria-label="Business (Coming Soon)"
            >
              <Briefcase className="w-6 h-6 text-gray-400" strokeWidth={2} />
            </button>
            <span className="text-[10px] text-gray-400 mt-1.5 font-medium">Coming Soon</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
          <p>Wishlist coming soon...</p>
          <p className="text-sm mt-2">Save restaurants you want to visit</p>
        </div>
      </div>
    </MainLayout>
  );
}

