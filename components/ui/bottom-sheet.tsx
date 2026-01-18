'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Client-side mount detection
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
  footer?: React.ReactNode;
  title?: string;
  zIndex?: number;
  height?: string;
  expandedHeight?: string;
  skipBodyLock?: boolean;
}

export function BottomSheet({ isOpen, onClose, children, footer, title, zIndex = 9998, height = '75vh', expandedHeight = '85vh' }: BottomSheetProps) {
  const mounted = useIsMounted();
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [visualViewportHeight, setVisualViewportHeight] = useState(0);
  const [initialWindowHeight, setInitialWindowHeight] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  // Initialize heights on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      queueMicrotask(() => {
        setInitialWindowHeight(window.innerHeight);
        setVisualViewportHeight(window.visualViewport?.height || window.innerHeight);
      });
    }
  }, []);

  // Track visual viewport for keyboard detection - Instagram-like behavior
  useLayoutEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    
    // Capture initial window height when sheet opens
    const initialHeight = window.innerHeight;
    queueMicrotask(() => {
      setInitialWindowHeight(initialHeight);
      setVisualViewportHeight(window.visualViewport?.height || initialHeight);
    });

    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      // Directly use visual viewport height for smooth resizing
      setVisualViewportHeight(vv.height);
    };

    // Handle both resize and scroll events for iOS PWA compatibility
    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    
    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
    };
  }, [isOpen]);

  // Lock body scroll
  useEffect(() => {
    if (!isOpen) return;

    scrollPositionRef.current = window.scrollY;
    
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollPositionRef.current}px`;
    document.body.style.width = '100%';
    
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      window.scrollTo(0, scrollPositionRef.current);
    };
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
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
    
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      setIsDragging(false);
      return;
    }
    
    const content = contentRef.current;
    const newY = e.touches[0].clientY;
    const deltaY = newY - startY;
    
    if (content && content.scrollTop === 0 && deltaY > 0) {
      e.preventDefault();
      setCurrentY(newY);
    } else if (content && content.scrollTop > 0) {
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
  
  // Calculate keyboard gap from the difference between initial window height and current visual viewport
  const keyboardGap = Math.max(0, initialWindowHeight - visualViewportHeight);
  const isKeyboardOpen = keyboardGap > 150;
  
  // Instagram-like behavior: sheet shrinks to fit within visual viewport
  // Calculate maximum available height (visual viewport minus some top margin)
  const topMargin = 60; // Leave some space at the top
  const maxAvailableHeight = visualViewportHeight - topMargin;

  const content = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity duration-300"
        onClick={onClose}
        style={{ 
          opacity: isOpen ? 1 : 0, 
          zIndex,
          // On iOS, backdrop should only cover visible area
          height: visualViewportHeight > 0 ? `${visualViewportHeight}px` : '100%',
        }}
      />

      {/* Bottom Sheet - Instagram-like behavior: stays at bottom, shrinks with keyboard */}
      <div
        ref={sheetRef}
        className="fixed left-0 right-0 bg-white rounded-t-3xl flex flex-col"
        style={{
          // Always positioned at the bottom of the visual viewport
          bottom: isKeyboardOpen ? keyboardGap : 0,
          // Height shrinks to fit within visual viewport when keyboard is open
          height: isKeyboardOpen 
            ? `${Math.min(maxAvailableHeight, visualViewportHeight * 0.85)}px`
            : height,
          maxHeight: isKeyboardOpen 
            ? `${maxAvailableHeight}px` 
            : '90dvh',
          transform: `translateY(${dragOffset}px)`,
          boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)',
          zIndex: zIndex + 2,
          // Smooth transition for Instagram-like feel
          transition: isDragging ? 'none' : 'height 0.25s ease-out, max-height 0.25s ease-out, bottom 0.25s ease-out',
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

        {/* Scrollable Content */}
        <div 
          ref={contentRef}
          className="flex-1 overflow-y-auto px-4"
          style={{ 
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            minHeight: 0,
          }}
        >
          {children}
        </div>

        {/* Fixed Footer - stays at bottom of sheet, above keyboard */}
        {footer && (
          <div 
            className="flex-shrink-0 px-4 bg-white border-t border-gray-100"
            style={{ 
              paddingBottom: isKeyboardOpen 
                ? '8px'
                : 'max(16px, env(safe-area-inset-bottom, 16px))',
              paddingTop: '12px' 
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </>
  );

  return createPortal(content, document.body);
}
