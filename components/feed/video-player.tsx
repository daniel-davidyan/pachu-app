'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  isVisible: boolean;
  className?: string;
}

export function VideoPlayer({ src, poster, isVisible, className = '' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [progress, setProgress] = useState(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle visibility changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isVisible) {
      // Auto-play when visible (with sound)
      video.muted = false;
      video.play().catch(() => {
        // Auto-play was prevented, try muted first then unmute
        video.muted = true;
        video.play().then(() => {
          // Unmute after play starts
          video.muted = false;
        }).catch(() => {
          // Autoplay completely blocked
        });
      });
    } else {
      // Pause when not visible
      video.pause();
    }
  }, [isVisible]);

  // Sync playing state with video events
  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);

  // Update progress
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, []);

  // Auto-hide controls
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().then(() => {
        setIsPlaying(true);
      }).catch(console.error);
    }
    showControlsTemporarily();
  }, [isPlaying, showControlsTemporarily]);

  const handleVideoClick = useCallback(() => {
    togglePlay();
  }, [togglePlay]);

  const handleVideoEnded = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      video.play().catch(console.error);
    }
  }, []);

  return (
    <div 
      className={`relative ${className}`}
      onClick={handleVideoClick}
      onTouchStart={showControlsTemporarily}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        loop
        playsInline
        preload="auto"
        onEnded={handleVideoEnded}
        onPlay={handlePlay}
        onPause={handlePause}
        className="w-full h-full object-cover"
      />

      {/* Play/Pause Indicator (centered, fades quickly) */}
      {showControls && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            {isPlaying ? (
              <Pause className="w-8 h-8 text-white" fill="white" />
            ) : (
              <Play className="w-8 h-8 text-white ml-1" fill="white" />
            )}
          </div>
        </div>
      )}

      {/* Progress Bar - fixed at the bottom, above navigation */}
      <div 
        className="fixed left-0 right-0 h-[2px] bg-white/30 z-40"
        style={{ bottom: 'calc(56px + env(safe-area-inset-bottom))' }}
      >
        <div 
          className="h-full bg-white transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Paused overlay */}
      {!isPlaying && !showControls && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="w-20 h-20 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-10 h-10 text-white ml-1" fill="white" />
          </div>
        </div>
      )}
    </div>
  );
}
