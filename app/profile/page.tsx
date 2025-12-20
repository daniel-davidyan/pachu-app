'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { useUser } from '@/hooks/use-user';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useRef } from 'react';
import { Calendar, Camera, X, Check, Edit2, Heart, MapPin, Loader2, Trash2, MoreVertical } from 'lucide-react';
import { CompactRating } from '@/components/ui/modern-rating';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { PostCard, PostCardData } from '@/components/post/post-card';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WriteReviewModal } from '@/components/review/write-review-modal';
import { useToast } from '@/components/ui/toast';

interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

interface Stats {
  experiences: number;
  followers: number;
  following: number;
}

interface Review {
  id: string;
  rating: number;
  content: string;
  created_at: string;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  user: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  restaurants: {
    id: string;
    name: string;
    address: string;
    image_url?: string;
    google_place_id?: string;
  };
  review_photos: Array<{ photo_url: string }>;
}

interface WishlistItem {
  id: string;
  created_at: string;
  restaurants: {
    id: string;
    google_place_id: string;
    name: string;
    address: string;
    image_url?: string;
  };
}

type ProfileTab = 'experiences' | 'wishlist';

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useUser();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({ experiences: 0, followers: 0, following: 0 });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTab, setLoadingTab] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('experiences');
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Edit mode states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    username: '',
    bio: ''
  });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchStats();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      if (activeTab === 'experiences') {
        fetchReviews();
      } else {
        fetchWishlist();
      }
    }
  }, [user, activeTab]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      setProfile(data);
      setEditForm({
        full_name: data.full_name || '',
        username: data.username || '',
        bio: data.bio || ''
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      if (!user?.id) return;

      console.log('Fetching stats for user:', user.id);

      // Get experiences (reviews) count
      const { count: experiencesCount } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      console.log('Experiences count:', experiencesCount);

      // Get followers count - people who follow this user
      let followersCount = 0;
      try {
        // Try standard column name first
        const { count: count1, error: error1 } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', user.id);
        
        if (!error1 && count1 !== null) {
          followersCount = count1;
        } else {
          // Try legacy column name
          const { count: count2 } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('followed_id', user.id);
          followersCount = count2 || 0;
        }
      } catch (err) {
        console.error('Error fetching followers:', err);
      }

      // Get following count - people this user follows
      let followingCount = 0;
      try {
        const { count, error } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', user.id);
        
        if (!error && count !== null) {
          followingCount = count;
        }
      } catch (err) {
        console.error('Error fetching following:', err);
      }

      console.log('Final stats:', { 
        experiences: experiencesCount || 0, 
        followers: followersCount, 
        following: followingCount 
      });

      setStats({
        experiences: experiencesCount || 0,
        followers: followersCount,
        following: followingCount,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchReviews = async () => {
    if (!user?.id) return;
    
    setLoadingTab(true);
    try {
      const response = await fetch(`/api/reviews?userId=${user.id}`);
      const data = await response.json();
      
      if (data.error) {
        console.error('API error:', data.error);
        setReviews([]);
      } else {
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setReviews([]);
    } finally {
      setLoadingTab(false);
    }
  };

  const fetchWishlist = async () => {
    if (!user?.id) return;
    
    setLoadingTab(true);
    try {
      const response = await fetch('/api/wishlist');
      const data = await response.json();
      
      if (data.error) {
        console.error('API error:', data.error);
        setWishlist([]);
      } else {
        setWishlist(data.wishlist || []);
      }
    } catch (error) {
      console.error('Error fetching wishlist:', error);
      setWishlist([]);
    } finally {
      setLoadingTab(false);
    }
  };

  const handleRemoveFromWishlist = async (restaurantId: string) => {
    try {
      const response = await fetch(`/api/wishlist?restaurantId=${restaurantId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setWishlist(prev => prev.filter(item => item.restaurants.id !== restaurantId));
        fetchStats(); // Refresh stats
      }
    } catch (error) {
      console.error('Error removing from wishlist:', error);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    setReviewToDelete(reviewId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteReview = async () => {
    if (!reviewToDelete) return;

    try {
      const response = await fetch(`/api/reviews?reviewId=${reviewToDelete}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setReviews(prev => prev.filter(review => review.id !== reviewToDelete));
        fetchStats(); // Refresh stats
        showToast('Experience deleted successfully', 'success');
      } else {
        showToast('Failed to delete experience', 'error');
      }
    } catch (error) {
      console.error('Error deleting review:', error);
      showToast('Failed to delete experience', 'error');
    } finally {
      setReviewToDelete(null);
    }
  };

  const handleEditReview = (post: PostCardData) => {
    const review = reviews.find(r => r.id === post.id);
    if (review) {
      setEditingReview(review);
      setShowEditModal(true);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const response = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || 'Failed to update profile', 'error');
        return;
      }

      setProfile(data.profile);
      setIsEditingProfile(false);
      showToast('Profile updated successfully', 'success');
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast('Failed to update profile', 'error');
    } finally {
      setSavingProfile(false);
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

  if (!profile) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-gray-500 mb-4">Profile not found</p>
            <Link href="/feed" className="text-primary font-medium">Go to Feed</Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showBottomNav={!showEditModal}>
      <div className="pb-24 bg-gray-50 min-h-screen">
        {/* Compact Profile Header */}
        <div className="bg-white px-4 py-5">
          {isEditingProfile ? (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">Edit Profile</h3>
                <p className="text-xs text-gray-500 mt-1">Update your personal information</p>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  placeholder="Your full name"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm bg-gray-50 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  placeholder="username"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm bg-gray-50 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Bio
                </label>
                <textarea
                  placeholder="Tell us about yourself..."
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  rows={3}
                  maxLength={160}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm bg-gray-50 focus:bg-white resize-none transition-all"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{editForm.bio.length}/160</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setIsEditingProfile(false);
                    setEditForm({
                      full_name: profile.full_name || '',
                      username: profile.username || '',
                      bio: profile.bio || ''
                    });
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-5">
              {/* Avatar - Left Side */}
              <div className="relative flex-shrink-0">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name || profile.username}
                    className="w-32 h-32 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                    <span className="text-4xl font-bold text-white">
                      {(profile.full_name || profile.username).charAt(0).toUpperCase()}
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
                  className="absolute bottom-1 right-1 w-9 h-9 bg-black rounded-full shadow-lg flex items-center justify-center border-2 border-white hover:bg-gray-900 transition-colors disabled:opacity-50"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4 text-white" />
                  )}
                </button>
              </div>

              {/* Info - Right Side */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                {/* Name and Username - Left Aligned */}
                <div className="text-left mb-3">
                  <h2 className="text-lg font-bold text-gray-900">
                    {profile.full_name || profile.username}
                  </h2>
                  <p className="text-sm text-gray-500">@{profile.username}</p>
                </div>

                {/* Stats Row - Aligned to Left */}
                <div className="flex gap-5 items-center">
                  <div className="text-left">
                    <p className="text-base font-bold text-gray-900 leading-none">{stats.experiences}</p>
                    <p className="text-xs text-gray-600 mt-1">experiences</p>
                  </div>
                  <button
                    onClick={() => router.push('/profile/connections?tab=followers')}
                    className="text-left hover:opacity-70 transition-opacity"
                  >
                    <p className="text-base font-bold text-gray-900 leading-none">{stats.followers}</p>
                    <p className="text-xs text-gray-600 mt-1">followers</p>
                  </button>
                  <button
                    onClick={() => router.push('/profile/connections?tab=following')}
                    className="text-left hover:opacity-70 transition-opacity"
                  >
                    <p className="text-base font-bold text-gray-900 leading-none">{stats.following}</p>
                    <p className="text-xs text-gray-600 mt-1">following</p>
                  </button>
                </div>
              </div>

              {/* Edit Button - Top Right */}
              <button
                onClick={() => setIsEditingProfile(true)}
                className="w-7 h-7 flex-shrink-0 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors self-start"
              >
                <Edit2 className="w-3.5 h-3.5 text-gray-600" />
              </button>
            </div>
          )}

          {/* Bio - Full Width Below */}
          {!isEditingProfile && (
            profile.bio ? (
              <p className="text-xs text-gray-600 mt-3 leading-relaxed">{profile.bio}</p>
            ) : (
              <button 
                onClick={() => setIsEditingProfile(true)}
                className="text-xs text-primary font-medium mt-2 hover:underline"
              >
                + Add bio
              </button>
            )
          )}
        </div>

        {/* Tab Selector */}
        <div className="sticky top-0 z-10 bg-white">
          <div className="relative">
            {/* Text Buttons */}
            <div className="relative w-full h-12 flex items-center">
              <button
                onClick={() => setActiveTab('experiences')}
                className="absolute transition-colors"
                style={{ left: '25%', transform: 'translateX(-50%)' }}
              >
                <span 
                  className={`text-base font-medium transition-all duration-300 ${
                    activeTab === 'experiences' ? 'text-[#C5459C]' : 'text-black'
                  }`}
                >
                  My Experiences
                </span>
              </button>
              <button
                onClick={() => setActiveTab('wishlist')}
                className="absolute transition-colors"
                style={{ left: '75%', transform: 'translateX(-50%)' }}
              >
                <span 
                  className={`text-base font-medium transition-all duration-300 ${
                    activeTab === 'wishlist' ? 'text-[#C5459C]' : 'text-black'
                  }`}
                >
                  My Wishlist
                </span>
              </button>
            </div>
            
            {/* Animated Underline */}
            <div className="relative w-full">
              <div 
                className="h-0.5 rounded-full transition-all duration-300 ease-out"
                style={{
                  backgroundColor: '#C5459C',
                  boxShadow: '0 0 8px rgba(197, 69, 156, 0.4)',
                  marginLeft: activeTab === 'experiences' ? '0%' : '50%',
                  width: '50%'
                }}
              />
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-4 py-4">
          {loadingTab ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading...</p>
            </div>
          ) : activeTab === 'experiences' ? (
            // My Experiences
            reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map((review) => {
                  const postData: PostCardData = {
                    id: review.id,
                    rating: review.rating,
                    content: review.content,
                    createdAt: review.created_at,
                    likesCount: review.likesCount || 0,
                    commentsCount: review.commentsCount || 0,
                    isLiked: review.isLiked || false,
                    user: review.user || {
                      id: user?.id || '',
                      username: profile?.username || '',
                      fullName: profile?.full_name || '',
                      avatarUrl: profile?.avatar_url || undefined,
                    },
                    photos: review.review_photos?.map(p => p.photo_url) || [],
                    restaurant: {
                      id: review.restaurants?.id || '',
                      name: review.restaurants?.name || 'Restaurant',
                      address: review.restaurants?.address || '',
                      imageUrl: review.restaurants?.image_url,
                      googlePlaceId: review.restaurants?.google_place_id,
                    },
                  };

                  return (
                    <PostCard
                      key={review.id}
                      post={postData}
                      showRestaurantInfo={true}
                      onEdit={handleEditReview}
                      onDelete={handleDeleteReview}
                      onUpdate={() => {
                        fetchReviews();
                        fetchStats();
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl border-2 border-dashed border-primary/30 p-10 text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <span className="text-3xl">✨</span>
                </div>
                <p className="text-gray-900 font-bold text-lg">No experiences yet</p>
                <p className="text-sm text-gray-600 mt-2 mb-4">Start sharing your restaurant experiences!</p>
                <Link 
                  href="/map" 
                  className="inline-block bg-primary text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
                >
                  ✍️ Write Your First Review
                </Link>
              </div>
            )
          ) : (
            // My Wishlist
            wishlist.length > 0 ? (
              <div className="space-y-3">
                {wishlist.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <Link
                      href={`/restaurant/${item.restaurants?.google_place_id || item.restaurants?.id}`}
                      className="block p-4 flex items-center gap-3"
                    >
                      <div className="w-16 h-16 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl overflow-hidden flex-shrink-0">
                        {item.restaurants?.image_url ? (
                          <img src={item.restaurants.image_url} alt={item.restaurants.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">🍽️</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 truncate">
                          {item.restaurants?.name || 'Restaurant'}
                        </h3>
                        <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {item.restaurants?.address || 'Address not available'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Added {formatDate(item.created_at)}
                        </p>
                      </div>
                    </Link>
                    <div className="px-4 pb-4">
                      <button
                        onClick={() => handleRemoveFromWishlist(item.restaurants.id)}
                        className="w-full bg-red-50 text-red-600 py-2 rounded-lg font-medium text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                      >
                        <Heart className="w-4 h-4 fill-current" />
                        Remove from Wishlist
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl border-2 border-dashed border-red-200 p-10 text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Heart className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-gray-900 font-bold text-lg">Your wishlist is empty</p>
                <p className="text-sm text-gray-600 mt-2 mb-4">Save restaurants you want to try!</p>
                <Link 
                  href="/map" 
                  className="inline-block bg-primary text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
                >
                  Explore Restaurants
                </Link>
              </div>
            )
          )}
        </div>
      </div>

      {/* Edit Review Modal */}
      {editingReview && (
        <WriteReviewModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingReview(null);
          }}
          restaurant={{
            googlePlaceId: editingReview.restaurants?.google_place_id || editingReview.restaurants?.id || '',
            name: editingReview.restaurants?.name || '',
            address: editingReview.restaurants?.address || '',
            latitude: 0,
            longitude: 0,
            photoUrl: editingReview.restaurants?.image_url,
          }}
          existingReview={{
            id: editingReview.id,
            rating: editingReview.rating,
            content: editingReview.content || '',
            photos: editingReview.review_photos?.map(p => p.photo_url) || [],
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setEditingReview(null);
            fetchReviews();
            fetchStats();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setReviewToDelete(null);
        }}
        onConfirm={confirmDeleteReview}
        title="Delete this experience?"
        message="This will permanently remove your review and photos."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />
    </MainLayout>
  );
}
