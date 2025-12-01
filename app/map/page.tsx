'use client';

import { MainLayout } from '@/components/layout/main-layout';


export default function MapPage() {
  

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        {/* Category Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button className="px-4 py-2 bg-primary text-white rounded-full font-medium whitespace-nowrap">
            Restaurants
          </button>
          <button className="px-4 py-2 bg-gray-200 text-gray-400 rounded-full font-medium whitespace-nowrap cursor-not-allowed" disabled>
            Hotels (Coming Soon)
          </button>
          <button className="px-4 py-2 bg-gray-200 text-gray-400 rounded-full font-medium whitespace-nowrap cursor-not-allowed" disabled>
            Movies (Coming Soon)
          </button>
          <button className="px-4 py-2 bg-gray-200 text-gray-400 rounded-full font-medium whitespace-nowrap cursor-not-allowed" disabled>
            Books (Coming Soon)
          </button>
          <button className="px-4 py-2 bg-gray-200 text-gray-400 rounded-full font-medium whitespace-nowrap cursor-not-allowed" disabled>
            Professionals (Coming Soon)
          </button>
        </div>

        {/* Map Content */}
        <div className="bg-white rounded-lg shadow h-[calc(100vh-220px)] flex items-center justify-center text-gray-500">
          <div className="text-center">
            <p>Map view coming soon...</p>
            <p className="text-sm mt-2">This is where you'll see restaurants on a map</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

