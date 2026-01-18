'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
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
  expandedHeight?: string; // Height when keyboard is open
  skipBodyLock?: boolean;
}

export function BottomSheet({ isOpen, onClose, children, footer, title, zIndex = 9998, height = '50vh', expandedHeight = '80vh' }: BottomSheetProps) {
  const mounted = useIsMounted();
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [keyboardGap, setKeyboardGap] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const initialWindowHeightRef = useRef<number>(0);

  // Lock body scroll and store position
  useEffect(() => {
    if (isOpen) {
      scrollPositionRef.current = window.scrollY;
      initialWindowHeightRef.current = window.innerHeight;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.body.style.top = `-${scrollPositionRef.current}px`;
      document.body.style.left = '0';
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.height = '100%';
    } else {
      const scrollY = scrollPositionRef.current;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      window.scrollTo(0, scrollY);
    }
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
    };
  }, [isOpen]);

  // Track visual viewport for keyboard - this gives us the actual visible area
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const vv = window.visualViewport;
    if (!vv) return;

    const updateViewport = () => {
      // Calculate keyboard gap (space between visual viewport and actual screen bottom)
      // Only consider it a keyboard if gap > 150px (actual keyboards are ~250-350px)
      const gap = initialWindowHeightRef.current > 0 
        ? initialWindowHeightRef.current - vv.height 
        : 0;
      
      // Only set gap if it's a real keyboard (> 150px)
      const newGap = gap > 150 ? gap : 0;
      setKeyboardGap(newGap);
      setViewportHeight(vv.height);
    };

    vv.addEventListener('resize', updateViewport);
    vv.addEventListener('scroll', updateViewport);
    
    return () => {
      vv.removeEventListener('resize', updateViewport);
      vv.removeEventListener('scroll', updateViewport);
      // Reset state on cleanup
      setKeyboardGap(0);
      setViewportHeight(null);
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
  const isKeyboardOpen = keyboardGap > 150; // Keyboard is open if gap > 150px (actual keyboards are ~250-350px)
  
  // Use different height based on whether keyboard is open
  const currentHeight = isKeyboardOpen ? expandedHeight : height;
  
  // Calculate the max height based on visual viewport (shrinks when keyboard opens)
  const maxHeightValue = viewportHeight !== null 
    ? `${Math.min(viewportHeight * 0.9, viewportHeight - 40)}px`
    : (isKeyboardOpen ? '90dvh' : '85dvh');

  const content = (
    <>
      {/* Backdrop - covers the full visual viewport */}
      <div
        className="fixed bg-black/50 transition-opacity duration-300"
        onClick={onClose}
        style={{ 
          opacity: isOpen ? 1 : 0, 
          zIndex,
          top: 0,
          left: 0,
          right: 0,
          // Use visual viewport height if available
          height: viewportHeight !== null ? `${viewportHeight}px` : '100dvh',
        }}
      />

      {/* White background to fill gap between sheet and keyboard */}
      {keyboardGap > 0 && (
        <div
          className="fixed left-0 right-0 bg-white"
          style={{
            bottom: 0,
            height: `${keyboardGap}px`,
            zIndex: zIndex + 1,
          }}
        />
      )}

      {/* Bottom Sheet - positioned above the keyboard */}
      <div
        ref={sheetRef}
        className="fixed left-0 right-0 bg-white rounded-t-3xl flex flex-col"
        style={{
          // Position above the keyboard gap
          bottom: keyboardGap,
          // Calculate top position based on visual viewport and keyboard state
          top: viewportHeight !== null 
            ? `${Math.max(viewportHeight * (isKeyboardOpen ? 0.1 : 0.5), 50)}px` 
            : 'auto',
          height: viewportHeight !== null ? 'auto' : currentHeight,
          maxHeight: maxHeightValue,
          transform: `translateY(${dragOffset}px)`,
          boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)',
          zIndex: zIndex + 2,
          transition: 'top 0.2s ease-out, height 0.2s ease-out, max-height 0.2s ease-out, bottom 0.15s ease-out',
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
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {children}
        </div>

        {/* Fixed Footer - at bottom, with safe area when keyboard closed */}
        {footer && (
          <div 
            className="flex-shrink-0 px-4 bg-white border-t border-gray-100"
            style={{ 
              paddingBottom: isKeyboardOpen 
                ? '2px'  // Very close to keyboard
                : 'max(12px, env(safe-area-inset-bottom, 12px))', // Safe area for iPhone home indicator
              paddingTop: '6px' 
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
