'use client';

import { useEffect, useState } from 'react';

// Current app version - increment this to force cache clear
const APP_VERSION = 'v11';
const VERSION_KEY = 'pachu_app_version';

export function PWACacheClearer() {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Detect browser
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

    // Check if running as PWA (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;

    // Check stored version
    const storedVersion = localStorage.getItem(VERSION_KEY);

    // CHROME FIX: Force clear on Chrome if version doesn't match
    if (isChrome && storedVersion !== APP_VERSION) {
      setStatus('🔧 Chrome: Clearing all caches...');
      
      // Nuclear option: Clear EVERYTHING
      try {
        localStorage.clear();
        sessionStorage.clear();
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
          });
        }
        localStorage.setItem(VERSION_KEY, APP_VERSION);
        setTimeout(() => window.location.reload(), 1000);
      } catch (e) {
        // Ignore errors
      }
      return;
    }

    // Show status for debugging
    setStatus(`Mode: ${isStandalone ? 'PWA' : 'Browser'} | Stored: ${storedVersion || 'none'} | Current: ${APP_VERSION}`);

    if (!isStandalone) {
      // Even in browser mode, if version mismatch, clear caches
      if (storedVersion && storedVersion !== APP_VERSION) {
        setStatus('🔄 Clearing browser cache...');
        
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

        // Force reload
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        localStorage.setItem(VERSION_KEY, APP_VERSION);
      }
      return;
    }

    // PWA Mode - clear if version mismatch
    if (storedVersion !== APP_VERSION) {
      setStatus('🔄 PWA cache clearing...');
      
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
    } else {
      setTimeout(() => setStatus(null), 3000);
    }
  }, []);

  if (!status) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-pink-500 text-white text-xs px-4 py-2 z-[9999] text-center">
      {status}
    </div>
  );
}

