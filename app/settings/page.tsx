'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { useUser } from '@/hooks/use-user';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { user } = useUser();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1>

        <div className="bg-white rounded-lg shadow divide-y">
          {/* Account Info */}
          <div className="p-4">
            <h2 className="font-semibold text-gray-800 mb-3">Account</h2>
            <div className="space-y-2 text-sm">
              <p className="text-gray-600">
                <span className="font-medium">Email:</span> {user?.email || 'Not available'}
              </p>
            </div>
          </div>

          {/* Language Selection - Coming Soon */}
          <div className="p-4">
            <h2 className="font-semibold text-gray-800 mb-3">Language</h2>
            <p className="text-gray-500 text-sm">Language switching coming soon...</p>
          </div>

          {/* Logout */}
          <div className="p-4">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
            >
              Log Out
            </button>
          </div>

          {/* Other Settings */}
          <div className="p-4">
            <p className="text-gray-500 text-sm">More settings coming soon...</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

