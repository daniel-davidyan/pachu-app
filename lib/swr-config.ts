import { SWRConfiguration } from 'swr';

/**
 * Global SWR configuration for optimal performance
 * Configured for TikTok-like instant navigation experience
 */
export const swrConfig: SWRConfiguration = {
  // Don't refetch when window regains focus (prevents unnecessary requests)
  revalidateOnFocus: false,
  
  // Don't refetch when network reconnects (data is still fresh)
  revalidateOnReconnect: false,
  
  // Dedupe requests within 60 seconds
  dedupingInterval: 60000,
  
  // Keep showing stale data while revalidating
  revalidateIfStale: true,
  
  // Error retry configuration
  errorRetryCount: 2,
  errorRetryInterval: 3000,
  
  // Keep previous data when key changes (smoother transitions)
  keepPreviousData: true,
  
  // Global fetcher
  fetcher: async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
      const error = new Error('An error occurred while fetching the data.');
      throw error;
    }
    return res.json();
  },
};

/**
 * Cache key generators for consistent caching
 */
export const cacheKeys = {
  feed: (tab: string, page: number, lat: number, lng: number, radius: number) => 
    `/api/feed/reviews?tab=${tab}&page=${page}&latitude=${lat}&longitude=${lng}&radius=${radius}`,
  
  restaurant: (id: string) => `/api/restaurants/${id}`,
  
  profile: (id: string) => `/api/profile/${id}`,
  
  comments: (reviewId: string) => `/api/reviews/${reviewId}/comments`,
};

/**
 * Prefetch data into SWR cache
 * Use this to prefetch restaurant/profile data when user hovers or scrolls
 */
export async function prefetchData(key: string): Promise<void> {
  try {
    // Import mutate dynamically to avoid SSR issues
    const { mutate } = await import('swr');
    
    const response = await fetch(key);
    if (response.ok) {
      const data = await response.json();
      // Populate SWR cache without triggering revalidation
      mutate(key, data, { revalidate: false });
    }
  } catch (error) {
    // Silent fail - prefetch is optional
    console.debug('[Prefetch] Failed:', key);
  }
}

/**
 * Pre-populate SWR cache with data we already have
 * Use this when navigating from feed to detail page
 */
export async function populateCache(key: string, data: any): Promise<void> {
  try {
    const { mutate } = await import('swr');
    mutate(key, data, { revalidate: false });
  } catch (error) {
    console.debug('[Cache] Failed to populate:', key);
  }
}
