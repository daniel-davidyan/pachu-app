'use client';

import { Bell, Menu } from 'lucide-react';
import Link from 'next/link';

export function TopBar() {
  return (
    <header 
      className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div 
        className="flex items-center justify-between h-14 px-4"
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        {/* Menu - Left side */}
        <Link
          href="/settings"
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Menu"
        >
          <Menu className="w-5 h-5 text-gray-700" />
        </Link>

        {/* Logo - Center */}
        <Link href="/feed" className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          <h1 className="text-3xl text-primary" style={{ fontFamily: 'Pacifico, cursive' }}>Pachu</h1>
          <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-gradient-to-r from-primary/80 to-pink-500/80 text-white rounded shadow-sm translate-y-[-2px]">
            Beta
          </span>
        </Link>

        {/* Notifications - Right side */}
        <Link
          href="/notifications"
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5 text-gray-700" />
          {/* Notification badge - uncomment when you have unread notifications */}
          {/* <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full"></span> */}
        </Link>
      </div>
    </header>
  );
}

