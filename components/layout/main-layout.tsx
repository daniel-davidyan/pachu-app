'use client';

import { TopBar } from './top-bar';
import { BottomNav } from './bottom-nav';

interface MainLayoutProps {
  children: React.ReactNode;
  showBottomNav?: boolean;
  showTopBar?: boolean;
}

export function MainLayout({ children, showBottomNav = true, showTopBar = true }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100">
      {showTopBar && <TopBar />}
      <main 
        className="pb-20"
        style={{
          paddingTop: showTopBar ? 'calc(3.5rem + env(safe-area-inset-top))' : 'env(safe-area-inset-top)',
        }}
      >
        {children}
      </main>
      <BottomNav show={showBottomNav} />
    </div>
  );
}

