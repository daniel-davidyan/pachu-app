'use client';

import { useEffect, useCallback, useRef } from 'react';

/**
 * Hook that triggers a callback when the page becomes visible again.
 * Useful for refreshing data when user returns to the app.
 * 
 * Features:
 * - Debounces rapid visibility changes (e.g., quickly switching tabs)
 * - Only triggers after a minimum time has passed since last refresh
 * - Supports optional immediate refresh on mount
 * 
 * @param onVisible - Callback to run when page becomes visible
 * @param options - Configuration options
 * @param options.minInterval - Minimum time (ms) between refreshes (default: 30000ms = 30s)
 * @param options.enabled - Whether the hook is active (default: true)
 * @param options.refreshOnMount - Whether to trigger refresh on mount (default: false)
 */
export function useVisibilityRefresh(
  onVisible: () => void,
  options: {
    minInterval?: number;
    enabled?: boolean;
    refreshOnMount?: boolean;
  } = {}
) {
  const {
    minInterval = 30000, // 30 seconds default
    enabled = true,
    refreshOnMount = false,
  } = options;

  const lastRefreshRef = useRef<number>(Date.now());
  const onVisibleRef = useRef(onVisible);

  // Keep callback ref updated
  useEffect(() => {
    onVisibleRef.current = onVisible;
  }, [onVisible]);

  // Handle visibility change
  const handleVisibilityChange = useCallback(() => {
    if (!enabled) return;
    
    if (document.visibilityState === 'visible') {
      const now = Date.now();
      const timeSinceLastRefresh = now - lastRefreshRef.current;
      
      // Only refresh if enough time has passed
      if (timeSinceLastRefresh >= minInterval) {
        lastRefreshRef.current = now;
        onVisibleRef.current();
      }
    }
  }, [enabled, minInterval]);

  // Set up visibility change listener
  useEffect(() => {
    if (!enabled) return;
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Optional: refresh on mount
    if (refreshOnMount) {
      onVisibleRef.current();
      lastRefreshRef.current = Date.now();
    }
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, handleVisibilityChange, refreshOnMount]);

  // Return a manual refresh function
  const refresh = useCallback(() => {
    lastRefreshRef.current = Date.now();
    onVisibleRef.current();
  }, []);

  return { refresh };
}

/**
 * Hook that refreshes SWR data when page becomes visible.
 * Specifically designed for use with SWR's mutate function.
 * 
 * @param mutate - SWR mutate function
 * @param options - Configuration options (same as useVisibilityRefresh)
 */
export function useSwrVisibilityRefresh(
  mutate: () => void,
  options: {
    minInterval?: number;
    enabled?: boolean;
  } = {}
) {
  return useVisibilityRefresh(mutate, {
    ...options,
    refreshOnMount: false, // SWR handles initial fetch
  });
}
