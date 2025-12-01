'use client';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Simplified - just render children
  // Auth redirects handled by middleware.ts
  return <>{children}</>;
}

