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
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 z-50 shadow-lg">
      <div className="flex items-center justify-between h-full px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center transition-colors relative",
                item.isCenter ? "flex-initial px-2" : "flex-1"
              )}
            >
              {item.isCenter ? (
                // Center button with special styling
                <div 
                  style={{ backgroundColor: '#C5459C' }}
                  className="flex items-center justify-center w-14 h-14 rounded-2xl shadow-xl hover:opacity-90 transition-all -mt-8 border-4 border-white"
                >
                  <Icon className="w-7 h-7 text-white" strokeWidth={2.5} />
                </div>
              ) : (
                <>
                  <Icon
                    className={cn(
                      "w-6 h-6 transition-colors mb-1",
                      active ? "text-primary" : "text-gray-500"
                    )}
                    strokeWidth={active ? 2.5 : 2}
                  />
                  <span
                    className={cn(
                      "text-[10px] transition-colors",
                      active ? "text-primary font-semibold" : "text-gray-500 font-medium"
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

