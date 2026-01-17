'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Client-side mount detection using useSyncExternalStore (React 19 compatible)
const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);
}

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  zIndex?: number;
  height?: string;
  skipBodyLock?: boolean;
}

export function BottomSheet({ isOpen, onClose, children, title, zIndex = 9998, height = '70vh', skipBodyLock = false }: BottomSheetProps) {
  const mounted = useIsMounted();
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [viewportState, setViewportState] = useState<{ visual: number | null; initial: number }>({
    visual: null,
    initial: typeof window !== 'undefined' ? window.innerHeight : 800,
  });
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  useEffect(() => {
    // Skip body lock for fixed-position contexts like TikTok feed
    if (skipBodyLock) return;
    
    if (isOpen) {
      // Save the current scroll position
      scrollPositionRef.current = window.scrollY;
      
      // Add class to body
      document.body.classList.add('sheet-open');
      document.body.style.top = `-${scrollPositionRef.current}px`;
    } else {
      // Restore the scroll position
      const scrollY = scrollPositionRef.current;
      
      // Remove class from body
      document.body.classList.remove('sheet-open');
      document.body.style.top = '';
      
      // Restore scroll position
      window.scrollTo(0, scrollY);
    }
    
    return () => {
      // Cleanup on unmount
      if (skipBodyLock) return;
      document.body.classList.remove('sheet-open');
      document.body.style.top = '';
    };
  }, [isOpen, skipBodyLock]);

  // Track visual viewport for keyboard detection
  useEffect(() => {
    if (!isOpen) {
      // Reset viewport state when closed
      queueMicrotask(() => {
        setViewportState(prev => ({ ...prev, visual: null }));
      });
      return;
    }

    const vv = window.visualViewport;
    const initialHeight = window.innerHeight;
    
    // Set initial state
    queueMicrotask(() => {
      setViewportState({
        visual: vv ? vv.height : initialHeight,
        initial: initialHeight,
      });
    });

    if (!vv) return;

    const preventScroll = () => {
      // Aggressively prevent all scrolling when sheet is open
      window.scrollTo(0, 0);
      if (document.documentElement.scrollTop !== 0) {
        document.documentElement.scrollTop = 0;
      }
      if (document.body.scrollTop !== 0) {
        document.body.scrollTop = 0;
      }
    };

    const handleResize = () => {
      // Visual viewport height changes when keyboard opens/closes
      setViewportState(prev => ({ ...prev, visual: vv.height }));
      
      // Prevent iOS from scrolling
      preventScroll();
    };

    const handleVisualViewportScroll = () => {
      // When visual viewport scrolls, it means iOS is trying to scroll to show the input
      // We need to counteract this
      preventScroll();
    };

    preventScroll();

    // Listen to viewport changes
    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleVisualViewportScroll);
    
    // Also listen to window scroll with interval backup
    window.addEventListener('scroll', preventScroll, { passive: false });
    
    // Backup: periodically ensure no scroll happened
    const intervalId = setInterval(preventScroll, 100);

    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleVisualViewportScroll);
      window.removeEventListener('scroll', preventScroll);
      clearInterval(intervalId);
    };
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    // Don't intercept touch events on input elements - this blocks keyboard on iOS PWA
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('input, textarea')) {
      return;
    }
    
    setIsDragging(true);
    setStartY(e.touches[0].clientY);
    setCurrentY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    // Don't prevent default on input elements - this blocks keyboard on iOS PWA
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      setIsDragging(false);
      return;
    }
    
    const content = contentRef.current;
    const newY = e.touches[0].clientY;
    const deltaY = newY - startY;
    
    // Only allow drag to close if:
    // 1. Dragging down (deltaY > 0)
    // 2. Content is scrolled to top (scrollTop === 0)
    if (content && content.scrollTop === 0 && deltaY > 0) {
      // Prevent default to stop background scrolling (but not on inputs)
      e.preventDefault();
      setCurrentY(newY);
    } else if (content && content.scrollTop > 0) {
      // If content is scrolled, don't allow dragging the sheet
      setIsDragging(false);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const deltaY = currentY - startY;
    if (deltaY > 100) {
      onClose();
    }
    setCurrentY(0);
    setStartY(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartY(e.clientY);
    setCurrentY(e.clientY);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    const content = contentRef.current;
    const deltaY = e.clientY - startY;
    
    // Only allow drag to close if dragging down and content is at top
    if (content && content.scrollTop === 0 && deltaY > 0) {
      setCurrentY(e.clientY);
    } else if (content && content.scrollTop > 0) {
      setIsDragging(false);
    }
  }, [isDragging, startY]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const deltaY = currentY - startY;
    if (deltaY > 100) {
      onClose();
    }
    setCurrentY(0);
    setStartY(0);
  }, [isDragging, currentY, startY, onClose]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, currentY, startY, handleMouseMove, handleMouseUp]);

  if (!isOpen || !mounted) return null;

  const dragOffset = isDragging && currentY > startY ? currentY - startY : 0;
  
  // Calculate if keyboard is open based on visual viewport change
  const keyboardOpen = viewportState.visual !== null && viewportState.visual < viewportState.initial - 100;
  
  // When keyboard is open, limit sheet height to visual viewport
  // When closed, use the requested height
  const effectiveMaxHeight = keyboardOpen 
    ? `${viewportState.visual! - 20}px`  // Leave some space at top
    : (height === 'auto' ? '70dvh' : height.replace('vh', 'dvh'));

  const content = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity duration-300"
        onClick={onClose}
        style={{ opacity: isOpen ? 1 : 0, zIndex }}
      />

      {/* Bottom Sheet - always at bottom, height adjusts to visual viewport */}
      <div
        ref={sheetRef}
        className="fixed left-0 right-0 bg-white rounded-t-3xl flex flex-col"
        style={{
          bottom: 0,
          height: height === 'auto' ? 'auto' : height,
          maxHeight: effectiveMaxHeight,
          transform: `translateY(${dragOffset}px)`,
          boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)',
          zIndex: zIndex + 1,
        }}
      >
        {/* Drag Handle */}
        <div
          ref={dragHandleRef}
          className="w-full py-3 px-4 flex flex-col items-center cursor-grab active:cursor-grabbing flex-shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full mb-2" />
          {title && (
            <div className="w-full flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">{title}</h3>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div 
          ref={contentRef}
          className="flex-1 overflow-y-auto px-4 pb-4"
          style={{ 
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {children}
        </div>
      </div>
    </>
  );

  // Use portal to render at document body level - escapes any parent stacking contexts
  return createPortal(content, document.body);
}

