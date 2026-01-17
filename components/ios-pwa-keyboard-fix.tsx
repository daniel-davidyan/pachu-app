'use client';

import { useEffect } from 'react';

/**
 * iOS PWA Keyboard Fix
 * 
 * Handles two iOS-specific issues:
 * 1. Keyboard sometimes not appearing on input focus in PWA mode
 * 2. Viewport shifting when keyboard opens (screen "escaping" boundaries)
 * 
 * The viewport fix uses the visualViewport API to prevent iOS from
 * scrolling the page when the keyboard opens.
 */
export function IOSPWAKeyboardFix() {
  useEffect(() => {
    // Only run on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as { standalone?: boolean }).standalone === true;

    if (!isIOS) return;

    // Track active element to detect when input loses focus unexpectedly
    let pendingFocus: HTMLElement | null = null;
    let initialScrollY = 0;

    // =========================================
    // FIX 1: Ensure inputs receive focus
    // =========================================
    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        pendingFocus = target;
        // Save scroll position before keyboard opens
        initialScrollY = window.scrollY;
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
              (target as HTMLInputElement | HTMLTextAreaElement).click();
            }
          }, 50);
          
          setTimeout(() => {
            if (document.activeElement !== target) {
              (target as HTMLInputElement | HTMLTextAreaElement).focus();
            }
          }, 100);
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

    // =========================================
    // FIX 2: Prevent viewport shift on keyboard open
    // =========================================
    
    // When an input gets focus, iOS automatically scrolls the page
    // to bring the input into view. We want to prevent this.
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Lock scroll position
        initialScrollY = window.scrollY;
        
        // Prevent iOS from scrolling the page
        setTimeout(() => {
          window.scrollTo(0, initialScrollY);
        }, 0);
        
        // Also handle the case where iOS delays the scroll
        setTimeout(() => {
          window.scrollTo(0, initialScrollY);
        }, 100);
        
        setTimeout(() => {
          window.scrollTo(0, initialScrollY);
        }, 300);
      }
    };

    // Use visualViewport API if available for more precise control
    const visualViewport = window.visualViewport;
    
    const handleViewportResize = () => {
      if (visualViewport && document.activeElement) {
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
          // When keyboard opens, visualViewport.height decreases
          // Keep the page at the same scroll position
          window.scrollTo(0, initialScrollY);
          
          // Also ensure the body doesn't shift
          document.body.style.height = `${visualViewport.height}px`;
        }
      }
    };

    const handleViewportScroll = () => {
      if (visualViewport && document.activeElement) {
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
          // Prevent the visual viewport from scrolling
          // This keeps the page content stable
        }
      }
    };

    // Reset body height when keyboard closes
    const handleBlur = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Reset body height
        document.body.style.height = '';
        // Restore scroll position
        setTimeout(() => {
          window.scrollTo(0, initialScrollY);
        }, 100);
      }
    };

    // Add listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('focusout', handleFocusOut, { passive: true });
    document.addEventListener('focusin', handleFocusIn, { passive: true });
    document.addEventListener('blur', handleBlur, { capture: true, passive: true });
    
    if (visualViewport) {
      visualViewport.addEventListener('resize', handleViewportResize);
      visualViewport.addEventListener('scroll', handleViewportScroll);
    }

    // Cleanup
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('blur', handleBlur);
      
      if (visualViewport) {
        visualViewport.removeEventListener('resize', handleViewportResize);
        visualViewport.removeEventListener('scroll', handleViewportScroll);
      }
      
      // Reset body height on cleanup
      document.body.style.height = '';
    };
  }, []);

  return null;
}
