'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { useUser } from '@/hooks/use-user';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useRef } from 'react';
import { Calendar, Camera, X, Heart, MapPin, Loader2, Trash2, MoreVertical, Grid3X3, EyeOff, Bookmark, Play, Share2 } from 'lucide-react';
import { CompactRating } from '@/components/ui/modern-rating';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { PostCard, PostCardData } from '@/components/post/post-card';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WriteReviewModal } from '@/components/review/write-review-modal';
import { useToast } from '@/components/ui/toast';
import { formatAddress } from '@/lib/address-utils';

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

type ProfileTab = 'published' | 'unpublished' | 'saved';

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
  const [activeTab, setActiveTab] = useState<ProfileTab>('published');
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();


  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchStats();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      if (activeTab === 'published' || activeTab === 'unpublished') {
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
      // Build URL with published filter based on active tab
      let url = `/api/reviews?userId=${user.id}`;
      if (activeTab === 'published') {
        url += '&published=true';
      } else if (activeTab === 'unpublished') {
        url += '&published=false';
      }
      
      const response = await fetch(url);
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

  const handleShareProfile = async () => {
    const profileUrl = `${window.location.origin}/profile/${user?.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile?.full_name || profile?.username}'s Profile`,
          text: `Check out ${profile?.full_name || profile?.username}'s food experiences on Pachu!`,
          url: profileUrl,
        });
      } catch (err) {
        // User cancelled or error
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(profileUrl);
      showToast('Profile link copied to clipboard!', 'success');
    }
  };

  return (
    <MainLayout showBottomNav={!showEditModal && !sheetOpen}>
      <div className="pb-24 bg-gray-50 min-h-screen">
        {/* Compact Profile Header */}
        <div className="bg-white px-4 py-5">
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
            </div>

          {/* Bio - Full Width Below */}
          {profile.bio && (
            <p className="text-xs text-gray-600 mt-3 leading-relaxed">{profile.bio}</p>
          )}

          {/* Instagram-Style Action Buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => router.push('/profile/edit')}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold text-sm py-2 px-4 rounded-lg transition-colors"
            >
              Edit profile
            </button>
            <button
              onClick={handleShareProfile}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold text-sm py-2 px-4 rounded-lg transition-colors"
            >
              Share profile
            </button>
          </div>
        </div>

        {/* Instagram-Style Tab Selector */}
        <div className="sticky top-0 z-10 bg-white border-t border-gray-200">
          <div className="grid grid-cols-3">
            {/* Published Tab */}
            <button
              onClick={() => setActiveTab('published')}
              className={`flex flex-col items-center justify-center py-3 transition-all duration-200 relative ${
                activeTab === 'published' ? 'text-gray-900' : 'text-gray-400'
              }`}
            >
              <Grid3X3 className="w-6 h-6" strokeWidth={activeTab === 'published' ? 2 : 1.5} />
              {activeTab === 'published' && (
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gray-900" />
              )}
            </button>

            {/* Unpublished Tab */}
            <button
              onClick={() => setActiveTab('unpublished')}
              className={`flex flex-col items-center justify-center py-3 transition-all duration-200 relative ${
                activeTab === 'unpublished' ? 'text-gray-900' : 'text-gray-400'
              }`}
            >
              <EyeOff className="w-6 h-6" strokeWidth={activeTab === 'unpublished' ? 2 : 1.5} />
              {activeTab === 'unpublished' && (
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gray-900" />
              )}
            </button>

            {/* Saved/Wishlist Tab */}
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex flex-col items-center justify-center py-3 transition-all duration-200 relative ${
                activeTab === 'saved' ? 'text-gray-900' : 'text-gray-400'
              }`}
            >
              <Bookmark className="w-6 h-6" strokeWidth={activeTab === 'saved' ? 2 : 1.5} />
              {activeTab === 'saved' && (
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gray-900" />
              )}
            </button>
          </div>
        </div>

        {/* Tab Content - Instagram-Style Grid */}
        <div>
          {loadingTab ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading...</p>
            </div>
          ) : activeTab === 'published' || activeTab === 'unpublished' ? (
            // Reviews Grid - Instagram Style
            reviews.length > 0 ? (
              <div className="grid grid-cols-3 gap-[1px] bg-gray-100">
                {reviews.map((review) => {
                  const thumbnailUrl = review.review_photos?.[0]?.photo_url || review.restaurants?.image_url;
                  const hasMultiplePhotos = (review.review_photos?.length || 0) > 1;
                  
                  return (
                    <Link
                      key={review.id}
                      href={`/profile/feed?tab=${activeTab}&startId=${review.id}`}
                      className="relative aspect-square bg-gray-200 overflow-hidden group"
                    >
                      {thumbnailUrl ? (
                        <img
                          src={thumbnailUrl}
                          alt={review.restaurants?.name || 'Review'}
                          className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                          <span className="text-2xl">🍽️</span>
                        </div>
                      )}
                      
                      {/* Multiple Photos Indicator */}
                      {hasMultiplePhotos && (
                        <div className="absolute top-2 right-2">
                          <svg className="w-5 h-5 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M4 6h2v2H4V6zm0 5h2v2H4v-2zm0 5h2v2H4v-2zm16-10h-2V4h2v2zm-4 0H8V4h8v2zm4 5h-2v-2h2v2zm0 5h-2v-2h2v2zM8 20h8v-2H8v2z"/>
                          </svg>
                        </div>
                      )}

                      {/* Hover Overlay with Stats */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                        <div className="flex items-center gap-1 text-white font-semibold">
                          <Heart className="w-5 h-5 fill-white" />
                          <span>{review.likesCount || 0}</span>
                        </div>
                        <div className="flex items-center gap-1 text-white font-semibold">
                          <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                          </svg>
                          <span>{review.commentsCount || 0}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              // Empty state
              <div className="px-4 py-8">
                <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl border-2 border-dashed border-primary/30 p-10 text-center">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <span className="text-3xl">
                      {activeTab === 'unpublished' ? '📝' : '✨'}
                    </span>
                  </div>
                  <p className="text-gray-900 font-bold text-lg">
                    {activeTab === 'unpublished' 
                      ? 'No saved experiences yet'
                      : 'No published experiences yet'}
                  </p>
                  <p className="text-sm text-gray-600 mt-2 mb-4 max-w-sm mx-auto">
                    {activeTab === 'unpublished'
                      ? 'Save your dining experiences privately to help us learn your preferences and provide better recommendations'
                      : 'Start sharing your restaurant experiences with the community!'}
                  </p>
                  {activeTab === 'published' && (
                    <Link 
                      href="/map" 
                      className="inline-block bg-primary text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
                    >
                      ✍️ Write Your First Review
                    </Link>
                  )}
                </div>
              </div>
            )
          ) : (
            // Saved/Wishlist Grid - Instagram Style
            wishlist.length > 0 ? (
              <div className="grid grid-cols-3 gap-[1px] bg-gray-100">
                {wishlist.map((item) => (
                  <Link
                    key={item.id}
                    href={`/restaurant/${item.restaurants?.google_place_id || item.restaurants?.id}`}
                    className="relative aspect-square bg-gray-200 overflow-hidden group"
                  >
                    {item.restaurants?.image_url ? (
                      <img
                        src={item.restaurants.image_url}
                        alt={item.restaurants.name}
                        className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                        <span className="text-2xl">🍽️</span>
                      </div>
                    )}
                    
                    {/* Restaurant Name Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-2">
                      <p className="text-white text-xs font-medium line-clamp-2 leading-tight">
                        {item.restaurants?.name || 'Restaurant'}
                      </p>
                    </div>

                    {/* Bookmark Icon */}
                    <div className="absolute top-2 right-2">
                      <Bookmark className="w-5 h-5 text-white fill-white drop-shadow-lg" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8">
                <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl border-2 border-dashed border-red-200 p-10 text-center">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <Bookmark className="w-8 h-8 text-gray-400" />
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
              </div>
            )
          )}
        </div>
      </div>

      {/* Edit Review Modal */}
      {editingReview && (
        <WriteReviewModal
          key={`edit-review-${editingReview.id}-${showEditModal}`}
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
