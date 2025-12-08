'use client';

import { TopBar } from './top-bar';
import { BottomNav } from './bottom-nav';

interface MainLayoutProps {
  children: React.ReactNode;
  showBottomNav?: boolean;
}

export function MainLayout({ children, showBottomNav = true }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100">
      <TopBar />
      <main className="pt-14 pb-20">
        {children}
      </main>
      <BottomNav show={showBottomNav} />
    </div>
  );
}

