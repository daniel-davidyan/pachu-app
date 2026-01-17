'use client';

import { useEffect } from 'react';

/**
 * iOS PWA Keyboard Fix
 * 
 * Ensures inputs receive focus properly in iOS PWA mode
 * and prevents unwanted page scrolling when keyboard opens.
 */
export function IOSPWAKeyboardFix() {
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as { standalone?: boolean }).standalone === true;

    if (!isIOS) return;

    let pendingFocus: HTMLElement | null = null;
    let lastScrollY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        pendingFocus = target;
        lastScrollY = window.scrollY;
      } else {
        pendingFocus = null;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Check if input is inside a fixed container (like bottom sheet)
        const isInFixedContainer = target.closest('.fixed') !== null;
        
        if (isStandalone) {
          setTimeout(() => {
            if (document.activeElement !== target) {
              (target as HTMLInputElement | HTMLTextAreaElement).focus();
            }
            // Restore scroll if we're in a fixed container
            if (isInFixedContainer && Math.abs(window.scrollY - lastScrollY) > 10) {
              window.scrollTo(0, lastScrollY);
            }
          }, 0);
          
          setTimeout(() => {
            if (document.activeElement !== target) {
              (target as HTMLInputElement | HTMLTextAreaElement).focus();
            }
            if (isInFixedContainer && Math.abs(window.scrollY - lastScrollY) > 10) {
              window.scrollTo(0, lastScrollY);
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

    // Prevent page scroll when focusing on inputs in fixed containers
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        const isInFixedContainer = target.closest('.fixed') !== null;
        if (isInFixedContainer) {
          lastScrollY = window.scrollY;
          // Restore scroll position after a delay (after iOS tries to scroll)
          setTimeout(() => {
            if (Math.abs(window.scrollY - lastScrollY) > 10) {
              window.scrollTo(0, lastScrollY);
            }
          }, 100);
          setTimeout(() => {
            if (Math.abs(window.scrollY - lastScrollY) > 10) {
              window.scrollTo(0, lastScrollY);
            }
          }, 300);
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('focusout', handleFocusOut, { passive: true });
    document.addEventListener('focusin', handleFocusIn, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, []);

  return null;
}
