'use client';

import { useEffect } from 'react';

/**
 * iOS PWA Keyboard Fix
 * 
 * In iOS PWA (standalone) mode, the virtual keyboard sometimes doesn't appear
 * when tapping on input fields. This component adds event listeners to help
 * ensure inputs receive proper focus.
 * 
 * Common causes of keyboard not appearing:
 * 1. Touch events being prevented (e.preventDefault())
 * 2. CSS touch-action or user-select blocking
 * 3. Focus being called too quickly after touch
 */
export function IOSPWAKeyboardFix() {
  useEffect(() => {
    // Only run on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;

    if (!isIOS) return;

    // Track active element to detect when input loses focus unexpectedly
    let pendingFocus: HTMLElement | null = null;

    // Helper to ensure input gets focus - more aggressive in standalone mode
    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      
      // Check if the target is an input or textarea
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        pendingFocus = target;
      } else {
        pendingFocus = null;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      
      // Check if the target is an input or textarea
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // In standalone mode, be more aggressive about focusing
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
              // Also try clicking to trigger iOS keyboard
              (target as HTMLInputElement | HTMLTextAreaElement).click();
            }
          }, 50);
          
          setTimeout(() => {
            if (document.activeElement !== target) {
              (target as HTMLInputElement | HTMLTextAreaElement).focus();
            }
          }, 100);
        } else {
          // In browser mode, single focus call is usually enough
          setTimeout(() => {
            (target as HTMLInputElement | HTMLTextAreaElement).focus();
          }, 10);
        }
      }
      
      pendingFocus = null;
    };

    // Detect if focus was stolen from an input
    const handleFocusOut = (e: FocusEvent) => {
      if (isStandalone && pendingFocus) {
        const target = pendingFocus;
        // Re-focus if focus was unexpectedly lost
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
