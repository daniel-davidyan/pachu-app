'use client';

import { useState, useRef, useCallback } from 'react';
import { VideoPlayer } from './video-player';

interface MediaItem {
  id: string;
  type: 'photo' | 'video';
  url: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
}

interface MediaCarouselProps {
  media: MediaItem[];
  isVisible: boolean;
  className?: string;
}

export function MediaCarousel({ media, isVisible, className = '' }: MediaCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevMediaRef = useRef<MediaItem[]>(media);

  const minSwipeDistance = 50;

  // Reset index when media changes (using ref to avoid direct setState in effect)
  if (prevMediaRef.current !== media) {
    prevMediaRef.current = media;
    if (currentIndex !== 0) {
      setCurrentIndex(0);
    }
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || touchStart === null) return;
    
    const currentTouch = e.targetTouches[0].clientX;
    setTouchEnd(currentTouch);
    
    // Calculate drag offset for visual feedback
    const diff = currentTouch - touchStart;
    
    // Limit drag at edges
    if ((currentIndex === 0 && diff > 0) || 
        (currentIndex === media.length - 1 && diff < 0)) {
      setDragOffset(diff * 0.3); // Reduced effect at edges
    } else {
      setDragOffset(diff);
    }
  }, [isDragging, touchStart, currentIndex, media.length]);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentIndex < media.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }

    setIsDragging(false);
    setDragOffset(0);
    setTouchStart(null);
    setTouchEnd(null);
  }, [touchStart, touchEnd, currentIndex, media.length]);

  // Go to specific index
  const goToIndex = useCallback((index: number) => {
    if (index >= 0 && index < media.length) {
      setCurrentIndex(index);
    }
  }, [media.length]);

  if (media.length === 0) {
    return (
      <div className={`bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center ${className}`}>
        <div className="text-center">
          <span className="text-8xl block mb-4">🍽️</span>
          <p className="text-white/40 text-sm">No photos yet</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Media Items Container */}
      <div 
        className="flex h-full transition-transform duration-300 ease-out"
        style={{
          transform: `translateX(calc(-${currentIndex * 100}% + ${dragOffset}px))`,
          transitionDuration: isDragging ? '0ms' : '300ms',
        }}
      >
        {media.map((item, index) => (
          <div
            key={item.id}
            className="flex-shrink-0 w-full h-full"
          >
            {item.type === 'video' ? (
              <VideoPlayer
                src={item.url}
                poster={item.thumbnailUrl}
                isVisible={isVisible && currentIndex === index}
                className="w-full h-full"
              />
            ) : (
              <div className="w-full h-full bg-black flex items-center justify-center">
                <img
                  src={item.url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading={index <= currentIndex + 1 ? 'eager' : 'lazy'}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Dots Indicator - positioned above the bottom content */}
      {media.length > 1 && (
        <div 
          className="absolute left-0 right-0 flex justify-center gap-1.5 z-10"
          style={{ bottom: 'calc(139px + env(safe-area-inset-bottom))' }}
        >
          {media.map((_, index) => (
            <button
              key={index}
              onClick={() => goToIndex(index)}
              className={`rounded-full transition-all duration-200 ${
                index === currentIndex
                  ? 'w-2 h-2 bg-white'
                  : 'w-1.5 h-1.5 bg-white/50'
              }`}
              aria-label={`Go to media ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Edge Indicators (visual hint for more content) */}
      {currentIndex > 0 && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black/20 to-transparent pointer-events-none" />
      )}
      {currentIndex < media.length - 1 && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black/20 to-transparent pointer-events-none" />
      )}
    </div>
  );
}
