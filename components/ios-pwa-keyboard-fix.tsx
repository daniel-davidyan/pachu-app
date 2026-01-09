'use client';

import { useEffect } from 'react';

/**
 * iOS PWA Keyboard Fix
 * 
 * In iOS PWA (standalone) mode, the virtual keyboard sometimes doesn't appear
 * when tapping on input fields. This component adds event listeners to help
 * ensure inputs receive proper focus.
 */
export function IOSPWAKeyboardFix() {
  useEffect(() => {
    // Only run on iOS in standalone mode
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;

    if (!isIOS || !isStandalone) return;

    // Helper to ensure input gets focus
    const handleTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      
      // Check if the target is an input or textarea
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Small delay to ensure iOS processes the touch event
        setTimeout(() => {
          (target as HTMLInputElement | HTMLTextAreaElement).focus();
        }, 10);
      }
    };

    // Add listener for touch end events
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Cleanup
    return () => {
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return null;
}
