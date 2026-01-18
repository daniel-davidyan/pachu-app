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
  expandedHeight?: string;
  skipBodyLock?: boolean;
}

export function BottomSheet({ isOpen, onClose, children, footer, title, zIndex = 9998, height = '50vh', expandedHeight = '80vh' }: BottomSheetProps) {
  const mounted = useIsMounted();
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [keyboardGap, setKeyboardGap] = useState(0);
  const [windowHeight, setWindowHeight] = useState(() => 
    typeof window !== 'undefined' ? window.innerHeight : 800
  );
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const initialHeightRef = useRef<number>(0);

  // Track visual viewport for keyboard detection
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    
    // Capture initial window height when sheet opens
    const initialHeight = window.innerHeight;
    initialHeightRef.current = initialHeight;
    // Use queueMicrotask to avoid sync setState in effect
    queueMicrotask(() => {
      setWindowHeight(initialHeight);
      setKeyboardGap(0);
    });

    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      const currentVVHeight = vv.height;
      const baseHeight = initialHeightRef.current || window.innerHeight;
      
      // If visual viewport is significantly smaller than window, keyboard is open
      const gap = baseHeight - currentVVHeight;
      
      if (gap > 150) {
        setKeyboardGap(gap);
      } else {
        setKeyboardGap(0);
      }
    };

    vv.addEventListener('resize', handleResize);
    
    return () => {
      vv.removeEventListener('resize', handleResize);
      queueMicrotask(() => setKeyboardGap(0));
    };
  }, [isOpen]);

  // Lock body scroll - simplified approach
  useEffect(() => {
    if (!isOpen) return;

    scrollPositionRef.current = window.scrollY;
    
    // Simple overflow hidden - don't mess with position
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
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
  const isKeyboardOpen = keyboardGap > 150;
  const currentHeight = isKeyboardOpen ? expandedHeight : height;
  const visualViewportHeight = windowHeight - keyboardGap;

  const content = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity duration-300"
        onClick={onClose}
        style={{ 
          opacity: isOpen ? 1 : 0, 
          zIndex,
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

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="fixed left-0 right-0 bg-white rounded-t-3xl flex flex-col"
        style={{
          bottom: keyboardGap,
          height: currentHeight,
          maxHeight: isKeyboardOpen ? `${visualViewportHeight - 40}px` : '85dvh',
          transform: `translateY(${dragOffset}px)`,
          boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)',
          zIndex: zIndex + 2,
          transition: isDragging ? 'none' : 'height 0.2s ease-out, max-height 0.2s ease-out, bottom 0.15s ease-out',
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

        {/* Fixed Footer - positioned at bottom with safe area */}
        {footer && (
          <div 
            className="flex-shrink-0 px-4 bg-white border-t border-gray-100"
            style={{ 
              paddingBottom: isKeyboardOpen 
                ? '6px'
                : 'max(16px, env(safe-area-inset-bottom, 16px))',
              paddingTop: '10px' 
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
