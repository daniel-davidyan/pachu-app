'use client';

import dynamic from 'next/dynamic';
import { MainLayout } from '@/components/layout/main-layout';
import { UtensilsCrossed, Hotel, Briefcase } from 'lucide-react';

// Dynamically import Mapbox with no SSR to avoid build issues
const Mapbox = dynamic(() => import('@/components/map/mapbox').then(mod => mod.Mapbox), {
  ssr: false,
  loading: () => (
    <div className="bg-white rounded-lg shadow h-full flex items-center justify-center text-gray-500">
      <div className="text-center">
        <p>Loading map...</p>
      </div>
    </div>
  )
});

export default function MapPage() {
  // You'll need to add NEXT_PUBLIC_MAPBOX_TOKEN to your .env.local file
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        {/* Category Icons */}
        <div className="flex gap-4 mb-6 justify-center items-start">
          {/* Restaurants - Active */}
          <div className="flex flex-col items-center">
            <button 
              style={{ backgroundColor: '#C5459C' }}
              className="flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg transition-all"
              aria-label="Restaurants"
            >
              <UtensilsCrossed className="w-6 h-6 text-white" strokeWidth={2.5} />
            </button>
            <div className="h-4"></div>
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

        {/* Map Content */}
        <div className="h-[calc(100vh-220px)]">
          {mapboxToken ? (
            <Mapbox 
              accessToken={mapboxToken}
              initialViewState={{
                longitude: -122.4,
                latitude: 37.8,
                zoom: 12
              }}
            />
          ) : (
            <div className="bg-white rounded-lg shadow h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="font-semibold">Mapbox token not found</p>
                <p className="text-sm mt-2">Please add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env.local file</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

