'use client';

import { useUser } from '@/hooks/use-user';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Check, Camera, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export default function EditProfilePage() {
  const { user } = useUser();
  const router = useRouter();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      
      setProfile(data);
      setFullName(data.full_name || '');
      setUsername(data.username || '');
      setBio(data.bio || '');
    } catch (error) {
      console.error('Error fetching profile:', error);
      showToast('Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be less than 5MB', 'error');
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      showToast('Profile photo updated successfully', 'success');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      showToast('Failed to upload photo. Please try again.', 'error');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async () => {
    if (!username.trim()) {
      showToast('Username is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim() || null,
          username: username.trim(),
          bio: bio.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || 'Failed to update profile', 'error');
        return;
      }

      showToast('Profile updated successfully', 'success');
      setTimeout(() => {
        router.push('/profile');
      }, 500);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      showToast('Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push('/profile');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Profile not found</p>
          <button 
            onClick={() => router.push('/profile')}
            className="text-primary font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col">
      {/* Header - Enhanced */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-5 py-4 flex-shrink-0 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <button
            onClick={handleCancel}
            disabled={saving}
            className="text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50 font-medium"
          >
            Cancel
          </button>
          <h1 className="text-lg font-bold text-gray-900">Edit Profile</h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-primary hover:text-primary/80 transition-colors disabled:opacity-50 font-semibold"
          >
            {saving ? 'Saving...' : 'Done'}
          </button>
        </div>
      </div>

      {/* Form Content - Scrollable with refined spacing */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-5 py-8 space-y-8">
          
          {/* Avatar Section - Modern & Centered */}
          <div className="flex flex-col items-center">
            <div className="relative group">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || profile.username}
                  className="w-32 h-32 rounded-full object-cover ring-4 ring-gray-100 shadow-lg transition-all group-hover:ring-primary/20"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary via-primary/90 to-primary/70 flex items-center justify-center ring-4 ring-gray-100 shadow-lg">
                  <span className="text-5xl font-bold text-white">
                    {(fullName || username).charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-1 right-1 w-10 h-10 bg-primary rounded-full shadow-xl flex items-center justify-center border-4 border-white hover:bg-primary/90 hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
            <p className="mt-4 text-sm text-gray-500 font-medium">
              {uploadingAvatar ? 'Uploading...' : 'Tap to change photo'}
            </p>
          </div>

          {/* Form Fields - Modern Cards */}
          <div className="space-y-6">
            {/* Full Name Field */}
            <div className="group">
              <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                Full Name
                <span className="text-xs text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-base bg-white placeholder:text-gray-400 hover:border-gray-300 disabled:bg-gray-50 disabled:cursor-not-allowed"
                placeholder="Your full name"
                disabled={saving}
              />
            </div>

            {/* Username Field */}
            <div className="group">
              <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                Username
                <span className="text-xs text-red-500 font-normal">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-base font-medium">
                  @
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-8 pr-4 py-3.5 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-base bg-white placeholder:text-gray-400 hover:border-gray-300 disabled:bg-gray-50 disabled:cursor-not-allowed"
                  placeholder="username"
                  required
                  disabled={saving}
                />
              </div>
            </div>

            {/* Bio Field */}
            <div className="group">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Bio
              </label>
              <div className="relative">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-base bg-white placeholder:text-gray-400 resize-none hover:border-gray-300 disabled:bg-gray-50 disabled:cursor-not-allowed"
                  placeholder="Tell us about yourself..."
                  rows={4}
                  maxLength={160}
                  disabled={saving}
                />
                <div className="flex items-center justify-between mt-2 px-1">
                  <p className="text-xs text-gray-400">
                    Share your foodie journey
                  </p>
                  <p className={`text-xs font-medium ${bio.length > 140 ? 'text-amber-500' : 'text-gray-400'}`}>
                    {bio.length}/160
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <p className="text-sm text-blue-900 leading-relaxed">
              💡 <span className="font-semibold">Tip:</span> A complete profile helps others discover and connect with you!
            </p>
          </div>

          {/* Bottom Spacing */}
          <div className="h-20"></div>
        </div>
      </div>

      {/* Floating Save Button - Mobile Optimized */}
      <div className="fixed bottom-6 left-0 right-0 px-5 pointer-events-none z-20 lg:hidden">
        <div className="max-w-2xl mx-auto pointer-events-auto">
          <button
            onClick={handleSave}
            disabled={saving || !username.trim()}
            className="w-full bg-gradient-to-r from-primary to-primary/90 text-white py-4 rounded-2xl font-bold text-base hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 shadow-xl disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                <span>Save Profile</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

