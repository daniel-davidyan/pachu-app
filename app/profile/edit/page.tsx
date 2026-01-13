'use client';

import { useUser } from '@/hooks/use-user';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
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
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  // Auto-resize bio textarea
  useEffect(() => {
    if (bioRef.current) {
      bioRef.current.style.height = 'auto';
      bioRef.current.style.height = bioRef.current.scrollHeight + 'px';
    }
  }, [bio]);

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
      showToast('Profile photo updated', 'success');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      showToast('Failed to upload photo', 'error');
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

      showToast('Profile saved', 'success');
      router.push('/profile');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      showToast('Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
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
    <div className="min-h-screen bg-white">
      {/* Header - Instagram Style */}
      <div 
        className="sticky top-0 z-10 bg-white border-b border-gray-200"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between px-4 h-14">
          <button
            onClick={() => router.back()}
            disabled={saving}
            className="w-10 h-10 flex items-center justify-center -ml-2"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <h1 className="text-base font-semibold text-gray-900">Edit profile</h1>
          <button
            onClick={handleSave}
            disabled={saving || !username.trim()}
            className="text-primary font-semibold text-sm disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Done'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4">
        {/* Avatar Section */}
        <div className="flex flex-col items-center py-6">
          <div className="relative">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || profile.username}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-2xl font-semibold text-gray-500">
                  {(fullName || username).charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            {uploadingAvatar && (
              <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </div>
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
            className="mt-3 text-primary font-semibold text-sm"
          >
            Edit picture
          </button>
        </div>

        {/* Form Fields - Instagram Style */}
        <div className="space-y-0">
          {/* Name */}
          <div className="py-3 border-b border-gray-200">
            <label className="block text-xs text-gray-500 mb-1">Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full text-base text-gray-900 bg-transparent outline-none placeholder:text-gray-400"
              placeholder="Name"
              disabled={saving}
            />
          </div>

          {/* Username */}
          <div className="py-3 border-b border-gray-200">
            <label className="block text-xs text-gray-500 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full text-base text-gray-900 bg-transparent outline-none placeholder:text-gray-400"
              placeholder="Username"
              required
              disabled={saving}
            />
          </div>

          {/* Bio */}
          <div className="py-3 border-b border-gray-200">
            <label className="block text-xs text-gray-500 mb-1">Bio</label>
            <textarea
              ref={bioRef}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full text-base text-gray-900 bg-transparent outline-none placeholder:text-gray-400 resize-none"
              placeholder="Bio"
              rows={1}
              maxLength={150}
              disabled={saving}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
