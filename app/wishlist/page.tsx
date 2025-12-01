'use client';

import { MainLayout } from '@/components/layout/main-layout';


export default function WishlistPage() {
  

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">AI Recommender</h1>

        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
          <p>Wishlist coming soon...</p>
          <p className="text-sm mt-2">Save restaurants you want to visit</p>
        </div>
      </div>
    </MainLayout>
  );
}

