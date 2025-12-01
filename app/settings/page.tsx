'use client';

import { MainLayout } from '@/components/layout/main-layout';

import { useRouter, usePathname } from 'next/navigation';

export default function SettingsPage() {
  
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: string) => {
    // Remove current locale and add new one
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPathname);
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1>

        <div className="bg-white rounded-lg shadow divide-y">
          {/* Language Selection */}
          <div className="p-4">
            <h2 className="font-semibold text-gray-800 mb-3">Language</h2>
            <div className="space-y-2">
              <button
                onClick={() => switchLocale('en')}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  locale === 'en'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                English
              </button>
              <button
                onClick={() => switchLocale('he')}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  locale === 'he'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                עברית (Hebrew)
              </button>
            </div>
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

