'use client';

import { Home, Map, MessageCircle, Heart, User } from 'lucide-react';
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
      name: 'Map',
      href: '/map',
      icon: Map,
    },
    {
      name: 'Chat',
      href: '/chat',
      icon: MessageCircle,
      isCenter: true,
    },
    {
      name: 'Wishlist',
      href: '/wishlist',
      icon: Heart,
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
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 z-50">
      <div className="flex items-center justify-around h-full px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full transition-colors relative",
                item.isCenter && "flex-initial"
              )}
            >
              {item.isCenter ? (
                // Center button with special styling
                <div className="absolute -top-5 flex items-center justify-center w-14 h-14 rounded-full bg-primary shadow-lg hover:bg-primary-600 transition-colors">
                  <Icon className="w-6 h-6 text-white" strokeWidth={2} />
                </div>
              ) : (
                <>
                  <Icon
                    className={cn(
                      "w-6 h-6 transition-colors",
                      active ? "text-primary" : "text-gray-500"
                    )}
                    strokeWidth={active ? 2.5 : 2}
                  />
                  <span
                    className={cn(
                      "text-xs mt-1 transition-colors",
                      active ? "text-primary font-semibold" : "text-gray-500"
                    )}
                  >
                    {item.name}
                  </span>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

