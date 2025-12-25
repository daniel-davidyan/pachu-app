'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export function BottomSheet({ isOpen, onClose, children, title }: BottomSheetProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Prevent touch move on the body to stop background scrolling
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.style.overflow = 'unset';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    };
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const content = contentRef.current;
    if (content) {
      setScrollTop(content.scrollTop);
    }
    setIsDragging(true);
    setStartY(e.touches[0].clientY);
    setCurrentY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const content = contentRef.current;
    const newY = e.touches[0].clientY;
    const deltaY = newY - startY;
    
    // Only allow drag to close if:
    // 1. Dragging down (deltaY > 0)
    // 2. Content is scrolled to top (scrollTop === 0)
    if (content && content.scrollTop === 0 && deltaY > 0) {
      // Prevent default to stop background scrolling
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
    const content = contentRef.current;
    if (content) {
      setScrollTop(content.scrollTop);
    }
    setIsDragging(true);
    setStartY(e.clientY);
    setCurrentY(e.clientY);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const content = contentRef.current;
    const deltaY = e.clientY - startY;
    
    // Only allow drag to close if dragging down and content is at top
    if (content && content.scrollTop === 0 && deltaY > 0) {
      setCurrentY(e.clientY);
    } else if (content && content.scrollTop > 0) {
      setIsDragging(false);
    }
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const deltaY = currentY - startY;
    if (deltaY > 100) {
      onClose();
    }
    setCurrentY(0);
    setStartY(0);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, currentY, startY]);

  if (!isOpen) return null;

  const dragOffset = isDragging && currentY > startY ? currentY - startY : 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
        onClick={onClose}
        style={{ opacity: isOpen ? 1 : 0 }}
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 flex flex-col transition-transform duration-300 ease-out"
        style={{
          height: '70vh',
          maxHeight: '70vh',
          transform: `translateY(${dragOffset}px)`,
          boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)',
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
}

