'use client';

import { Home, Search, Map, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    {
      name: 'Feed',
      href: '/feed',
      icon: Home,
    },
    {
      name: 'Search',
      href: '/search',
      icon: Search,
    },
    {
      name: 'Map',
      href: '/map',
      icon: Map,
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
    <nav className="fixed bottom-4 left-4 right-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-[28px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-white/20">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center py-2 px-4 rounded-2xl transition-all duration-200",
                  active 
                    ? "bg-primary/10" 
                    : "hover:bg-gray-100/80 active:scale-95"
                )}
              >
                <Icon
                  className={cn(
                    "w-6 h-6 transition-all duration-200",
                    active ? "text-primary" : "text-gray-500"
                  )}
                  strokeWidth={active ? 2.5 : 1.8}
                />
                <span
                  className={cn(
                    "text-[10px] mt-1 transition-all duration-200",
                    active 
                      ? "text-primary font-semibold" 
                      : "text-gray-500 font-medium"
                  )}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

