'use client';

import { Home, Search, MapPin, User, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  show?: boolean;
  variant?: 'default' | 'feed';
}

export function BottomNav({ show = true, variant = 'default' }: BottomNavProps) {
  const pathname = usePathname();
  const isFeedPage = pathname === '/feed' || variant === 'feed';

  const isActiveHome = pathname === '/feed';
  const isActiveSearch = pathname === '/search';
  const isActiveAgent = pathname === '/agent';
  const isActiveMap = pathname === '/map';
  const isActiveProfile = pathname === '/profile';

  return (
    <nav 
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ease-out",
        show ? "translate-y-0" : "translate-y-full",
        isFeedPage 
          ? "bg-black/80 backdrop-blur-xl border-t border-white/10" 
          : "bg-white/95 backdrop-blur-xl border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]"
      )}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto px-2">
        {/* Home */}
        <Link
          href="/feed"
          className="flex flex-col items-center justify-center flex-1 py-2 group"
        >
          <Home
            className={cn(
              "w-6 h-6 transition-all duration-200",
              isActiveHome 
                ? isFeedPage ? "text-white" : "text-[#C5459C]"
                : isFeedPage ? "text-white/50" : "text-gray-400",
              "group-active:scale-90"
            )}
            strokeWidth={isActiveHome ? 2.5 : 1.5}
            fill={isActiveHome ? 'currentColor' : 'none'}
          />
          <span className={cn(
            "text-[10px] font-medium mt-0.5 transition-colors",
            isActiveHome 
              ? isFeedPage ? "text-white" : "text-[#C5459C]"
              : isFeedPage ? "text-white/50" : "text-gray-400"
          )}>
            Home
          </span>
        </Link>

        {/* Search */}
        <Link
          href="/search"
          className="flex flex-col items-center justify-center flex-1 py-2 group"
        >
          <Search
            className={cn(
              "w-6 h-6 transition-all duration-200",
              isActiveSearch 
                ? isFeedPage ? "text-white" : "text-[#C5459C]"
                : isFeedPage ? "text-white/50" : "text-gray-400",
              "group-active:scale-90"
            )}
            strokeWidth={isActiveSearch ? 2.5 : 1.5}
          />
          <span className={cn(
            "text-[10px] font-medium mt-0.5 transition-colors",
            isActiveSearch 
              ? isFeedPage ? "text-white" : "text-[#C5459C]"
              : isFeedPage ? "text-white/50" : "text-gray-400"
          )}>
            Search
          </span>
        </Link>

        {/* Agent (Center) */}
        <Link
          href="/agent"
          className="flex flex-col items-center justify-center flex-1 py-2 group"
        >
          <Sparkles
            className={cn(
              "w-6 h-6 transition-all duration-200",
              isActiveAgent 
                ? isFeedPage ? "text-white" : "text-[#C5459C]"
                : isFeedPage ? "text-white/50" : "text-gray-400",
              "group-active:scale-90"
            )}
            strokeWidth={isActiveAgent ? 2.5 : 1.5}
            fill={isActiveAgent ? 'currentColor' : 'none'}
          />
          <span className={cn(
            "text-[10px] font-medium mt-0.5 transition-colors",
            isActiveAgent 
              ? isFeedPage ? "text-white" : "text-[#C5459C]"
              : isFeedPage ? "text-white/50" : "text-gray-400"
          )}>
            Pachu
          </span>
        </Link>

        {/* Map */}
        <Link
          href="/map"
          className="flex flex-col items-center justify-center flex-1 py-2 group"
        >
          <MapPin
            className={cn(
              "w-6 h-6 transition-all duration-200",
              isActiveMap 
                ? isFeedPage ? "text-white" : "text-[#C5459C]"
                : isFeedPage ? "text-white/50" : "text-gray-400",
              "group-active:scale-90"
            )}
            strokeWidth={isActiveMap ? 2.5 : 1.5}
          />
          <span className={cn(
            "text-[10px] font-medium mt-0.5 transition-colors",
            isActiveMap 
              ? isFeedPage ? "text-white" : "text-[#C5459C]"
              : isFeedPage ? "text-white/50" : "text-gray-400"
          )}>
            Map
          </span>
        </Link>

        {/* Profile */}
        <Link
          href="/profile"
          className="flex flex-col items-center justify-center flex-1 py-2 group"
        >
          <User
            className={cn(
              "w-6 h-6 transition-all duration-200",
              isActiveProfile 
                ? isFeedPage ? "text-white" : "text-[#C5459C]"
                : isFeedPage ? "text-white/50" : "text-gray-400",
              "group-active:scale-90"
            )}
            strokeWidth={isActiveProfile ? 2.5 : 1.5}
          />
          <span className={cn(
            "text-[10px] font-medium mt-0.5 transition-colors",
            isActiveProfile 
              ? isFeedPage ? "text-white" : "text-[#C5459C]"
              : isFeedPage ? "text-white/50" : "text-gray-400"
          )}>
            Profile
          </span>
        </Link>
      </div>
    </nav>
  );
}
