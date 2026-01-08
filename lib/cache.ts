/**
 * Server-side in-memory cache for API responses
 * Provides fast caching with automatic TTL expiration
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ServerCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxEntries = 500;

  /**
   * Get cached data if not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cache entry with TTL
   */
  set<T>(key: string, data: T, ttlMs: number = 60000): void {
    // Cleanup old entries if we're at capacity
    if (this.cache.size >= this.maxEntries) {
      this.cleanup();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  /**
   * Delete specific cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Delete expired entries and oldest entries if still over capacity
   */
  private cleanup(): void {
    const now = Date.now();
    const entries: [string, CacheEntry<any>][] = [];

    // Remove expired entries and collect remaining
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      } else {
        entries.push([key, entry]);
      }
    }

    // If still over capacity, remove oldest entries
    if (entries.length >= this.maxEntries) {
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, Math.floor(this.maxEntries * 0.2));
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  /**
   * Generate cache key from parameters
   */
  static makeKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(k => `${k}=${params[k]}`)
      .join('&');
    return `${prefix}:${sortedParams}`;
  }
}

// Singleton instances for different cache purposes
export const feedCache = new ServerCache();
export const restaurantCache = new ServerCache();
export const profileCache = new ServerCache();

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
  FEED: 2 * 60 * 1000,        // 2 minutes for feed data
  RESTAURANT: 5 * 60 * 1000,  // 5 minutes for restaurant details
  PROFILE: 3 * 60 * 1000,     // 3 minutes for profiles
  MATCH_SCORE: 10 * 60 * 1000, // 10 minutes for match scores
} as const;

export { ServerCache };
