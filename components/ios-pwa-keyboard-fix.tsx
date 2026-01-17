'use client';

import { useEffect } from 'react';

/**
 * iOS PWA Keyboard Fix
 * 
 * Ensures inputs receive focus properly in iOS PWA mode and
 * prevents the page from scrolling when keyboard opens.
 */
export function IOSPWAKeyboardFix() {
  useEffect(() => {
    // Only run on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as { standalone?: boolean }).standalone === true;

    if (!isIOS) return;

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

    // Prevent page scroll when focusing inputs in fixed containers
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Check if input is inside a fixed/absolute positioned container
        const fixedParent = target.closest('[style*="position: fixed"], [style*="position:fixed"], .fixed');
        if (fixedParent) {
          // Aggressively prevent scroll
          const preventScroll = () => {
            window.scrollTo(0, 0);
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
          };
          
          preventScroll();
          
          // Call multiple times as iOS might scroll after focus
          setTimeout(preventScroll, 0);
          setTimeout(preventScroll, 50);
          setTimeout(preventScroll, 100);
          setTimeout(preventScroll, 200);
          setTimeout(preventScroll, 300);
        }
      }
    };

    // Visual viewport handler - prevent scroll when keyboard opens
    const vv = window.visualViewport;

    const handleViewportResize = () => {
      // When visual viewport changes (keyboard opens/closes), prevent scroll
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    if (vv) {
      vv.addEventListener('resize', handleViewportResize);
    }

    // Add listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('focusout', handleFocusOut, { passive: true });
    document.addEventListener('focusin', handleFocusIn, { passive: true });

    // Cleanup
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('focusin', handleFocusIn);
      if (vv) {
        vv.removeEventListener('resize', handleViewportResize);
      }
    };
  }, []);

  return null;
}
