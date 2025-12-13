'use client';

import { useEffect } from 'react';

// Current app version - increment this to force cache clear
const APP_VERSION = 'v10';
const VERSION_KEY = 'pachu_app_version';

export function PWACacheClearer() {
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Check if running as PWA (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;

    if (!isStandalone) return;

    // Check stored version
    const storedVersion = localStorage.getItem(VERSION_KEY);

    if (storedVersion !== APP_VERSION) {
      console.log('🔄 PWA version mismatch, clearing caches...');
      
      // Clear all localStorage (except auth)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('pachu_chat')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Clear caches
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            caches.delete(name);
          });
        });
      }

      // Update version
      localStorage.setItem(VERSION_KEY, APP_VERSION);

      // Force reload after 500ms
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }, []);

  return null;
}

