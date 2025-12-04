'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { useUser } from '@/hooks/use-user';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { User, Globe, Bell, Shield, HelpCircle, LogOut, ChevronRight, Moon, Mail } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useUser();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  const settingsGroups = [
    {
      title: 'Account',
      items: [
        {
          icon: User,
          iconBg: 'bg-blue-100',
          iconColor: 'text-blue-600',
          label: 'Profile',
          value: user?.email?.split('@')[0] || 'User',
          href: '/profile',
        },
        {
          icon: Mail,
          iconBg: 'bg-green-100',
          iconColor: 'text-green-600',
          label: 'Email',
          value: user?.email || 'Not set',
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: Globe,
          iconBg: 'bg-purple-100',
          iconColor: 'text-purple-600',
          label: 'Language',
          value: 'English',
          badge: 'Soon',
        },
        {
          icon: Moon,
          iconBg: 'bg-indigo-100',
          iconColor: 'text-indigo-600',
          label: 'Dark Mode',
          value: 'Off',
          badge: 'Soon',
        },
        {
          icon: Bell,
          iconBg: 'bg-orange-100',
          iconColor: 'text-orange-600',
          label: 'Notifications',
          value: 'On',
          badge: 'Soon',
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: HelpCircle,
          iconBg: 'bg-cyan-100',
          iconColor: 'text-cyan-600',
          label: 'Help Center',
        },
        {
          icon: Shield,
          iconBg: 'bg-gray-100',
          iconColor: 'text-gray-600',
          label: 'Privacy Policy',
        },
      ],
    },
  ];

  return (
    <MainLayout>
      <div className="pb-24 min-h-screen">
        {/* Header */}
        <div className="px-4 pt-2 pb-4">
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        </div>

        {/* Settings Groups */}
        <div className="px-4 space-y-6">
          {settingsGroups.map((group) => (
            <div key={group.title}>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                {group.title}
              </h2>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
                {group.items.map((item, index) => {
                  const Icon = item.icon;
                  const isClickable = !!item.href;
                  return (
                    <div
                      key={index}
                      onClick={() => isClickable && router.push(item.href!)}
                      className={`w-full flex items-center gap-3 p-4 transition-colors text-left ${
                        isClickable ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl ${item.iconBg} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${item.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{item.label}</p>
                        {item.value && (
                          <p className="text-xs text-gray-500 truncate">{item.value}</p>
                        )}
                      </div>
                      {item.badge && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-medium">
                          {item.badge}
                        </span>
                      )}
                      {isClickable && (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Logout Button */}
          <div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:bg-red-50 hover:border-red-200 transition-all"
            >
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-sm font-medium text-red-600">Log Out</span>
            </button>
          </div>

          {/* App Version */}
          <div className="text-center py-4">
            <p className="text-xs text-gray-400">Pachu v1.0.0</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

