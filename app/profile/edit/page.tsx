'use client';

import { useUser } from '@/hooks/use-user';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Check, X } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { validateUsername, sanitizeUsername } from '@/lib/username-validation';

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
  const [originalUsername, setOriginalUsername] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createClient();

  // Username validation state
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

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

  // Debounced username check
  const checkUsernameAvailability = useCallback(async (usernameToCheck: string) => {
    if (!usernameToCheck || usernameToCheck.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    // If username hasn't changed from original, it's valid
    if (usernameToCheck.toLowerCase() === originalUsername.toLowerCase()) {
      setUsernameError(null);
      setUsernameAvailable(true);
      return;
    }

    // First validate locally
    const validation = validateUsername(usernameToCheck);
    if (!validation.isValid) {
      setUsernameError(validation.error || 'Invalid username');
      setUsernameAvailable(false);
      return;
    }

    setCheckingUsername(true);
    try {
      const response = await fetch(
        `/api/users/check-username?username=${encodeURIComponent(usernameToCheck)}&currentUserId=${user?.id}`
      );
      const data = await response.json();
      
      if (data.valid && data.available) {
        setUsernameError(null);
        setUsernameAvailable(true);
      } else {
        setUsernameError(data.error || 'Username not available');
        setUsernameAvailable(false);
      }
    } catch (err) {
      console.error('Error checking username:', err);
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  }, [originalUsername, user?.id]);

  // Debounce username check
  useEffect(() => {
    const trimmed = username.trim();
    
    if (!trimmed) {
      setUsernameError(null);
      setUsernameAvailable(null);
      return;
    }

    // If username hasn't changed from original, it's valid
    if (trimmed.toLowerCase() === originalUsername.toLowerCase()) {
      setUsernameError(null);
      setUsernameAvailable(true);
      return;
    }

    // Quick local validation first
    const validation = validateUsername(trimmed);
    if (!validation.isValid) {
      setUsernameError(validation.error || 'Invalid username');
      setUsernameAvailable(false);
      return;
    }

    // Clear previous error and set checking
    setUsernameError(null);
    setUsernameAvailable(null);
    
    const timeoutId = setTimeout(() => {
      checkUsernameAvailability(trimmed);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username, originalUsername, checkUsernameAvailability]);

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
      setOriginalUsername(data.username || '');
      setBio(data.bio || '');
    } catch (error) {
      console.error('Error fetching profile:', error);
      showToast('Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Auto-sanitize as user types (lowercase, no spaces)
    const sanitized = value.toLowerCase().replace(/\s/g, '_');
    setUsername(sanitized);
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

    // Validate username
    const validation = validateUsername(username);
    if (!validation.isValid) {
      showToast(validation.error || 'Invalid username', 'error');
      return;
    }

    if (usernameAvailable === false) {
      showToast('Please choose a different username', 'error');
      return;
    }

    setSaving(true);
    try {
      const sanitizedUsername = validation.sanitized || sanitizeUsername(username);
      
      const response = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim() || null,
          username: sanitizedUsername,
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

  const isFormValid = username.trim() && usernameAvailable !== false;

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
            disabled={saving || !isFormValid}
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
            <div className="relative flex items-center">
              <input
                type="text"
                value={username}
                onChange={handleUsernameChange}
                className={`w-full text-base bg-transparent outline-none placeholder:text-gray-400 pr-8 ${
                  usernameError ? 'text-red-600' : 'text-gray-900'
                }`}
                placeholder="Username"
                required
                disabled={saving}
                autoComplete="off"
                autoCapitalize="off"
              />
              {/* Status indicator */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2">
                {checkingUsername && (
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                )}
                {!checkingUsername && usernameAvailable === true && (
                  <Check className="w-4 h-4 text-green-500" />
                )}
                {!checkingUsername && usernameAvailable === false && (
                  <X className="w-4 h-4 text-red-500" />
                )}
              </div>
            </div>
            {/* Validation hint */}
            {usernameError && (
              <p className="text-xs text-red-500 mt-1">{usernameError}</p>
            )}
            {username && !usernameError && username !== originalUsername && (
              <p className="text-xs text-gray-400 mt-1">
                Letters, numbers, underscores, and periods only
              </p>
            )}
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
