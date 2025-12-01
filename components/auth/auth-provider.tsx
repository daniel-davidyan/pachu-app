'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/hooks/use-user';

interface AuthProviderProps {
  children: React.ReactNode;
}

const publicPaths = ['/auth/login', '/auth/signup', '/auth/forgot-password', '/auth/callback'];

export function AuthProvider({ children }: AuthProviderProps) {
  const { user, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    if (loading || isNavigating) return;

    // Check if current path is public
    const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

    if (!user && !isPublicPath) {
      // Not logged in and trying to access protected route
      setIsNavigating(true);
      router.push('/auth/login');
    } else if (user && (pathname === '/auth/login' || pathname === '/auth/signup')) {
      // Already logged in and trying to access auth pages
      setIsNavigating(true);
      router.push('/feed');
    }
  }, [user, loading, pathname, router, isNavigating]);

  // Show loading only initially
  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #C5459C, #C5459C, #932B74)' }}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

