'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, Heart, MessageCircle, UserPlus, Loader2, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface NotificationActor {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
}

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
  referenceId?: string;
  actor: NotificationActor | null;
}

interface NotificationsPaneProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificationsRead?: () => void;
}

export function NotificationsPane({ isOpen, onClose, onNotificationsRead }: NotificationsPaneProps) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMarkedAsRead, setHasMarkedAsRead] = useState(false);
  const startY = useRef(0);

  // Fetch notifications when pane opens
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications?limit=50');
      const data = await response.json();
      
      if (data.notifications) {
        setNotifications(data.notifications);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark all as read (TikTok/Instagram style - auto when opened)
  const markAllAsRead = useCallback(async () => {
    if (hasMarkedAsRead) return;
    
    try {
      const response = await fetch('/api/notifications/read', {
        method: 'PATCH',
      });
      
      if (response.ok) {
        setHasMarkedAsRead(true);
        // Update local state to reflect read status
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        // Notify parent to update badge count
        onNotificationsRead?.();
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  }, [hasMarkedAsRead, onNotificationsRead]);

  // Fetch and mark as read when pane opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      // Small delay before marking as read (feels more natural)
      const timer = setTimeout(() => {
        markAllAsRead();
      }, 500);
      return () => clearTimeout(timer);
    } else {
      // Reset state when closed
      setHasMarkedAsRead(false);
    }
  }, [isOpen, fetchNotifications, markAllAsRead]);

  // Handle notification click - navigate to source
  const handleNotificationClick = useCallback((notification: Notification) => {
    // Close the pane first
    onClose();
    
    // Navigate based on notification type
    if (notification.type === 'follow' && notification.actor) {
      // For follows, go to the follower's profile
      router.push(`/profile/${notification.actor.id}`);
    } else if (notification.link) {
      // For likes/comments, use the link (points to review)
      router.push(notification.link);
    } else if (notification.referenceId) {
      // Fallback to reference ID
      router.push(`/review/${notification.referenceId}`);
    }
  }, [onClose, router]);

  // Drag handlers for closing
  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaY = e.touches[0].clientY - startY.current;
    // Only allow upward drag (negative values)
    if (deltaY < 0) {
      setDragOffset(deltaY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    // Close if dragged up more than 100px
    if (dragOffset < -100) {
      onClose();
    }
    setDragOffset(0);
  };

  if (!isOpen) return null;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-red-500" fill="currentColor" />;
      case 'comment':
      case 'mention':
        return <MessageCircle className="w-4 h-4 text-blue-500" fill="currentColor" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-primary" />;
      default:
        return <Bell className="w-4 h-4 text-white/70" />;
    }
  };

  const getNotificationText = (notification: Notification) => {
    const actorName = notification.actor?.fullName || notification.actor?.username || 'Someone';
    
    switch (notification.type) {
      case 'like':
        return (
          <>
            <span className="font-semibold text-white">{actorName}</span>
            <span className="text-white/70"> liked your review</span>
          </>
        );
      case 'comment':
        return (
          <>
            <span className="font-semibold text-white">{actorName}</span>
            <span className="text-white/70"> commented on your review</span>
          </>
        );
      case 'mention':
        return (
          <>
            <span className="font-semibold text-white">{actorName}</span>
            <span className="text-white/70"> mentioned you in a comment</span>
          </>
        );
      case 'follow':
        return (
          <>
            <span className="font-semibold text-white">{actorName}</span>
            <span className="text-white/70"> started following you</span>
          </>
        );
      default:
        return <span className="text-white/70">{notification.message}</span>;
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: false });
    } catch {
      return '';
    }
  };

  return (
    <>
      {/* Semi-transparent backdrop - clicking outside closes the pane */}
      <div
        className="fixed inset-0 z-[90]"
        onClick={onClose}
      />

      {/* Notifications Pane - Opens from top, doesn't hide bottom nav */}
      <div
        className="fixed top-0 left-0 right-0 z-[95] bg-black/95 backdrop-blur-xl border-b border-white/10 rounded-b-[28px] shadow-2xl flex flex-col animate-slide-down"
        style={{
          height: 'calc(80vh - 70px)', // Leave room for bottom nav
          paddingTop: 'env(safe-area-inset-top)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10 flex-shrink-0">
          <h2 className="text-lg font-bold text-white">Notifications</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-white/50 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-8">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
                <Bell className="w-8 h-8 text-white/30" />
              </div>
              <p className="text-white/70 font-medium text-center">No notifications yet</p>
              <p className="text-white/40 text-sm text-center mt-1">
                When someone likes, comments, or follows you, you'll see it here
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5 ${
                  !notification.read ? 'bg-white/5' : ''
                }`}
              >
                {/* User Avatar */}
                <div className="relative flex-shrink-0">
                  {notification.actor?.avatarUrl ? (
                    <img
                      src={notification.actor.avatarUrl}
                      alt={notification.actor.fullName || ''}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/50 to-primary flex items-center justify-center">
                      <span className="text-white text-sm font-bold">
                        {(notification.actor?.fullName || notification.actor?.username || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  {/* Notification Type Icon */}
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-black flex items-center justify-center border border-white/20">
                    {getNotificationIcon(notification.type)}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-tight">
                    {getNotificationText(notification)}
                  </p>
                  <p className="text-[10px] text-white/40 mt-1">{formatTime(notification.createdAt)}</p>
                </div>

                {/* Unread indicator */}
                {!notification.read && (
                  <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Bottom drag indicator */}
        <div className="py-3 flex justify-center">
          <div className="w-10 h-1 bg-white/30 rounded-full" />
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-down {
          from {
            transform: translateY(-100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
