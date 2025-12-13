'use client';

import { Image, Search, Map, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  show?: boolean;
}

export function BottomNav({ show = true }: BottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      name: 'Map',
      href: '/map',
      icon: Map,
    },
    {
      name: 'Feed',
      href: '/feed',
      icon: Image,
    },
    {
      name: 'Search',
      href: '/search',
      icon: Search,
    },
    {
      name: 'Profile',
      href: '/profile',
      icon: User,
    },
  ];

  const isActive = (href: string) => {
    return pathname.startsWith(href);
  };

  return (
    <nav 
      className={cn(
        "bottom-nav-container fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-in-out",
        show ? "translate-y-0 opacity-100" : "translate-y-24 opacity-0"
      )}
      style={{
        bottom: 'calc(0rem + env(safe-area-inset-bottom))',
      }}
    >
      <div className="bg-white rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.4),0_16px_48px_rgba(0,0,0,0.3)] border-2 border-gray-300 px-2">
        <div className="flex items-center justify-center gap-1 h-12">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center py-2 px-4 rounded-full transition-all duration-200",
                  active 
                    ? "bg-primary/10" 
                    : "hover:bg-gray-100 active:scale-95"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 transition-all duration-200",
                    active ? "text-[#C5459C]" : "text-gray-400"
                  )}
                  strokeWidth={active ? 2.5 : 1.5}
                />
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

