'use client';

import { useEffect } from 'react';

/**
 * iOS PWA Keyboard Fix
 * 
 * Ensures keyboard opens properly in iOS PWA and Safari.
 * Prevents iOS from scrolling the viewport when keyboard opens.
 */
export function IOSPWAKeyboardFix() {
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!isIOS) return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as { standalone?: boolean }).standalone === true;

    // In PWA mode, ensure inputs can receive focus
    const handleTouchEnd = (e: TouchEvent) => {
      if (!isStandalone) return;
      
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Small delay to ensure focus works
        setTimeout(() => {
          if (document.activeElement !== target) {
            (target as HTMLInputElement | HTMLTextAreaElement).focus();
          }
        }, 10);
      }
    };

    // Keep document scroll at 0 - prevents iOS from shifting the page
    let scrollInterval: ReturnType<typeof setInterval> | null = null;
    
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Aggressively keep scroll at 0 while input is focused
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        
        // Keep checking scroll position during keyboard animation
        scrollInterval = setInterval(() => {
          if (window.scrollY !== 0 || document.documentElement.scrollTop !== 0) {
            window.scrollTo(0, 0);
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
          }
        }, 16);
        
        // Stop after keyboard animation completes
        setTimeout(() => {
          if (scrollInterval) {
            clearInterval(scrollInterval);
            scrollInterval = null;
          }
        }, 500);
      }
    };

    const handleFocusOut = () => {
      if (scrollInterval) {
        clearInterval(scrollInterval);
        scrollInterval = null;
      }
      // Reset scroll position
      window.scrollTo(0, 0);
    };

    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('focusin', handleFocusIn, { passive: true });
    document.addEventListener('focusout', handleFocusOut, { passive: true });

    return () => {
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      if (scrollInterval) {
        clearInterval(scrollInterval);
      }
    };
  }, []);

  return null;
}
