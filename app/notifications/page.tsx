'use client';

import { useEffect, useState, useCallback } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { useUser } from '@/hooks/use-user';
import { useRouter } from 'next/navigation';
import { Bell, Heart, MessageCircle, UserPlus, AtSign, Loader2, Check, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface NotificationActor {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
}

interface Notification {
  id: string;
  type: 'like' | 'follow' | 'comment' | 'review' | 'mention';
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
  referenceId: string | null;
  actor: NotificationActor | null;
}

export default function NotificationsPage() {
  const { user } = useUser();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/notifications?limit=50');
      const data = await response.json();
      
      if (data.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: [notificationId] }),
      });
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;

    setMarkingAllRead(true);
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: unreadIds }),
      });
      
      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    // Navigate to the relevant page
    if (notification.link) {
      router.push(notification.link);
    } else if (notification.type === 'follow' && notification.actor) {
      router.push(`/profile/${notification.actor.id}`);
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'like':
        return <Heart className="w-5 h-5 text-red-500 fill-red-500" />;
      case 'comment':
        return <MessageCircle className="w-5 h-5 text-blue-500" />;
      case 'follow':
        return <UserPlus className="w-5 h-5 text-purple-500" />;
      case 'mention':
        return <AtSign className="w-5 h-5 text-green-500" />;
      case 'review':
        return <Bell className="w-5 h-5 text-orange-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getNotificationIconBg = (type: Notification['type']) => {
    switch (type) {
      case 'like':
        return 'bg-red-50';
      case 'comment':
        return 'bg-blue-50';
      case 'follow':
        return 'bg-purple-50';
      case 'mention':
        return 'bg-green-50';
      case 'review':
        return 'bg-orange-50';
      default:
        return 'bg-gray-50';
    }
  };

  const formatNotificationMessage = (notification: Notification) => {
    const actorName = notification.actor?.fullName || notification.actor?.username || 'Someone';
    
    switch (notification.type) {
      case 'like':
        return <><span className="font-semibold">{actorName}</span> liked your review</>;
      case 'comment':
        return <><span className="font-semibold">{actorName}</span> commented on your review</>;
      case 'follow':
        return <><span className="font-semibold">{actorName}</span> started following you</>;
      case 'mention':
        return <><span className="font-semibold">{actorName}</span> mentioned you in a comment</>;
      case 'review':
        return notification.message || 'New activity on your review';
      default:
        return notification.message || notification.title;
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="pb-24 min-h-screen bg-gray-50">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
          <div className="px-4 py-3 flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={markingAllRead}
                className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 disabled:opacity-50"
              >
                {markingAllRead ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCheck className="w-4 h-4" />
                )}
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        {notifications.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`w-full px-4 py-4 flex items-start gap-3 hover:bg-gray-50 transition-colors text-left ${
                  !notification.read ? 'bg-blue-50/50' : 'bg-white'
                }`}
              >
                {/* Avatar or Icon */}
                <div className="flex-shrink-0 relative">
                  {notification.actor?.avatarUrl ? (
                    <img
                      src={notification.actor.avatarUrl}
                      alt={notification.actor.fullName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : notification.actor ? (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                      <span className="text-lg font-bold text-white">
                        {notification.actor.fullName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  ) : (
                    <div className={`w-12 h-12 rounded-full ${getNotificationIconBg(notification.type)} flex items-center justify-center`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                  )}
                  
                  {/* Type indicator badge */}
                  {notification.actor && (
                    <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full ${getNotificationIconBg(notification.type)} border-2 border-white flex items-center justify-center`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    {formatNotificationMessage(notification)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                </div>

                {/* Unread indicator */}
                {!notification.read && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="px-4 py-16">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-900 font-medium">No notifications yet</p>
              <p className="text-sm text-gray-500 mt-1">
                When someone likes, comments, or mentions you, you&apos;ll see it here
              </p>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
