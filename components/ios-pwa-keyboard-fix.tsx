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
    // Only run on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as { standalone?: boolean }).standalone === true;

    if (!isIOS) return;

    // Track active element to detect when input loses focus unexpectedly
    let pendingFocus: HTMLElement | null = null;

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        pendingFocus = target;
      } else {
        pendingFocus = null;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        if (isStandalone) {
          // Multiple attempts with increasing delays for stubborn cases
          setTimeout(() => {
            if (document.activeElement !== target) {
              (target as HTMLInputElement | HTMLTextAreaElement).focus();
            }
          }, 0);
          
          setTimeout(() => {
            if (document.activeElement !== target) {
              (target as HTMLInputElement | HTMLTextAreaElement).focus();
            }
          }, 50);
        } else {
          setTimeout(() => {
            (target as HTMLInputElement | HTMLTextAreaElement).focus();
          }, 10);
        }
      }
      
      pendingFocus = null;
    };

    const handleFocusOut = () => {
      if (isStandalone && pendingFocus) {
        const target = pendingFocus;
        setTimeout(() => {
          if (document.activeElement !== target && 
              (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
            (target as HTMLInputElement | HTMLTextAreaElement).focus();
          }
        }, 50);
      }
    };

    // Add listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('focusout', handleFocusOut, { passive: true });

    // Cleanup
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return null;
}
