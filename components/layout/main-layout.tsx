'use client';

import { TopBar } from './top-bar';
import { BottomNav } from './bottom-nav';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <TopBar />
      <main className="pt-14 pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

