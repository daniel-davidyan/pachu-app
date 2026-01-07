'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  isVisible: boolean;
  className?: string;
}

export function VideoPlayer({ src, poster, isVisible, className = '' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [progress, setProgress] = useState(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle visibility changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isVisible) {
      // Auto-play when visible
      video.play().catch(() => {
        // Auto-play was prevented, user needs to interact
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

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
    showControlsTemporarily();
  }, [isMuted, showControlsTemporarily]);

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
        muted={isMuted}
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

      {/* Mute Button (bottom right) */}
      <button
        onClick={toggleMute}
        className="absolute bottom-20 right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-opacity z-10"
        style={{ opacity: showControls ? 1 : 0.7 }}
      >
        {isMuted ? (
          <VolumeX className="w-5 h-5 text-white" />
        ) : (
          <Volume2 className="w-5 h-5 text-white" />
        )}
      </button>

      {/* Progress Bar (bottom) */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
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
