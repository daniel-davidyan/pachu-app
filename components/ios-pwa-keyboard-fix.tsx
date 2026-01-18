'use client';

import { useEffect } from 'react';

/**
 * iOS PWA Keyboard Fix
 * 
 * Ensures keyboard opens properly in iOS PWA mode.
 * Minimal intervention - only helps inputs receive focus in PWA.
 */
export function IOSPWAKeyboardFix() {
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!isIOS) return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as { standalone?: boolean }).standalone === true;

    if (!isStandalone) return;

    // In PWA mode, ensure inputs can receive focus
    const handleTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Small delay to ensure focus works in PWA
        setTimeout(() => {
          if (document.activeElement !== target) {
            (target as HTMLInputElement | HTMLTextAreaElement).focus();
          }
        }, 10);
      }
    };

    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return null;
}
