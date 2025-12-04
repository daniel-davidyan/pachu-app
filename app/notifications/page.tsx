'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { Bell } from 'lucide-react';

export default function NotificationsPage() {
  return (
    <MainLayout>
      <div className="pb-24 min-h-screen">
        <div className="px-4 pt-2 pb-4">
          <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
        </div>

        <div className="px-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-900 font-medium">No notifications yet</p>
            <p className="text-sm text-gray-500 mt-1">You'll see likes and follows here</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

