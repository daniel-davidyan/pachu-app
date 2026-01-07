'use client';

import { X, Heart, MessageCircle, UserPlus } from 'lucide-react';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow';
  user: {
    name: string;
    avatarUrl?: string;
  };
  content?: string;
  restaurantName?: string;
  time: string;
}

interface NotificationsPaneProps {
  isOpen: boolean;
  onClose: () => void;
}

// Static mock notifications for design preview
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'like',
    user: { name: 'Sarah Cohen' },
    restaurantName: 'Miznon',
    time: '2m ago',
  },
  {
    id: '2',
    type: 'comment',
    user: { name: 'Dan Levi' },
    content: 'Looks amazing! Need to try this place 🔥',
    restaurantName: 'Opa',
    time: '15m ago',
  },
  {
    id: '3',
    type: 'follow',
    user: { name: 'Maya Ben-Ari' },
    time: '1h ago',
  },
  {
    id: '4',
    type: 'like',
    user: { name: 'Yoni Shapira' },
    restaurantName: 'Port Said',
    time: '2h ago',
  },
  {
    id: '5',
    type: 'comment',
    user: { name: 'Noa Goldberg' },
    content: 'This is my favorite spot too!',
    restaurantName: 'Santa Katarina',
    time: '3h ago',
  },
  {
    id: '6',
    type: 'follow',
    user: { name: 'Amit Katz' },
    time: '5h ago',
  },
];

export function NotificationsPane({ isOpen, onClose }: NotificationsPaneProps) {
  if (!isOpen) return null;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-red-500" fill="currentColor" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-blue-500" fill="currentColor" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-primary" />;
    }
  };

  const getNotificationText = (notification: Notification) => {
    switch (notification.type) {
      case 'like':
        return (
          <>
            <span className="font-semibold text-white">{notification.user.name}</span>
            <span className="text-white/70"> liked your review of </span>
            <span className="font-semibold text-white">{notification.restaurantName}</span>
          </>
        );
      case 'comment':
        return (
          <>
            <span className="font-semibold text-white">{notification.user.name}</span>
            <span className="text-white/70"> commented on your review</span>
          </>
        );
      case 'follow':
        return (
          <>
            <span className="font-semibold text-white">{notification.user.name}</span>
            <span className="text-white/70"> started following you</span>
          </>
        );
    }
  };

  return (
    <>
      {/* Semi-transparent backdrop - clicking outside closes the pane */}
      <div
        className="fixed inset-0 z-[90]"
        onClick={onClose}
      />

      {/* Notifications Pane - Opens from top */}
      <div
        className="fixed top-0 left-0 right-0 z-[95] h-[80vh] bg-black/95 backdrop-blur-xl border-b border-white/10 rounded-b-[28px] shadow-2xl flex flex-col animate-slide-down"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
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
          {mockNotifications.map((notification) => (
            <div
              key={notification.id}
              className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5"
            >
              {/* User Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/50 to-primary flex items-center justify-center">
                  <span className="text-white text-sm font-bold">
                    {notification.user.name.charAt(0)}
                  </span>
                </div>
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
                {notification.type === 'comment' && notification.content && (
                  <p className="text-xs text-white/50 mt-1 truncate">
                    &ldquo;{notification.content}&rdquo;
                  </p>
                )}
                <p className="text-[10px] text-white/40 mt-1">{notification.time}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10">
          <p className="text-center text-xs text-white/40">
            Coming soon: real-time notifications
          </p>
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
