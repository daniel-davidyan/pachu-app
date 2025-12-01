'use client';

import { useEffect } from 'react';
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

  useEffect(() => {
    if (loading) return;

    // Remove locale prefix for path checking
    const cleanPath = pathname.replace(/^\/(en|he)/, '');
    const isPublicPath = publicPaths.some(path => cleanPath.startsWith(path));

    if (!user && !isPublicPath) {
      // Not logged in and trying to access protected route
      router.push('/auth/login');
    } else if (user && (cleanPath === '/auth/login' || cleanPath === '/auth/signup')) {
      // Already logged in and trying to access auth pages
      router.push('/feed');
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

