'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { useUser } from '@/hooks/use-user';
import { usePrefetch } from '@/hooks/use-prefetch';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useRef } from 'react';
import { Calendar, Camera, X, Heart, MapPin, Loader2, Trash2, MoreVertical, Grid3X3, EyeOff, Bookmark, Play, Share2, Plus, FolderPlus, Star } from 'lucide-react';
import { CompactRating } from '@/components/ui/modern-rating';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { PostCard, PostCardData } from '@/components/post/post-card';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WriteReviewModal } from '@/components/review/write-review-modal';
import { useToast } from '@/components/ui/toast';
import { formatAddress } from '@/lib/address-utils';
import { CollectionModal } from '@/components/collections/collection-modal';

// Helper function for grid thumbnail placeholder
const getGridPlaceholderStyle = (restaurantName?: string): { emoji: string; gradient: string } => {
  const name = (restaurantName || '').toLowerCase();
  
  if (name.includes('coffee') || name.includes('cafe') || name.includes('קפה')) {
    return { emoji: '☕', gradient: 'from-amber-100 to-orange-100' };
  }
  if (name.includes('pizza') || name.includes('פיצה')) {
    return { emoji: '🍕', gradient: 'from-red-100 to-orange-100' };
  }
  if (name.includes('sushi') || name.includes('סושי') || name.includes('japanese')) {
    return { emoji: '🍱', gradient: 'from-rose-100 to-pink-100' };
  }
  if (name.includes('burger') || name.includes('המבורגר')) {
    return { emoji: '🍔', gradient: 'from-amber-100 to-yellow-100' };
  }
  if (name.includes('thai') || name.includes('chinese') || name.includes('asian')) {
    return { emoji: '🥡', gradient: 'from-red-100 to-amber-100' };
  }
  if (name.includes('mexican') || name.includes('taco')) {
    return { emoji: '🌮', gradient: 'from-yellow-100 to-orange-100' };
  }
  if (name.includes('italian') || name.includes('pasta') || name.includes('פסטה')) {
    return { emoji: '🍝', gradient: 'from-green-100 to-emerald-100' };
  }
  if (name.includes('bakery') || name.includes('מאפייה') || name.includes('cake')) {
    return { emoji: '🥐', gradient: 'from-amber-100 to-yellow-100' };
  }
  if (name.includes('ice cream') || name.includes('גלידה') || name.includes('gelato')) {
    return { emoji: '🍨', gradient: 'from-pink-100 to-purple-100' };
  }
  if (name.includes('bar') || name.includes('pub') || name.includes('wine')) {
    return { emoji: '🍷', gradient: 'from-purple-100 to-violet-100' };
  }
  if (name.includes('hummus') || name.includes('falafel') || name.includes('shawarma')) {
    return { emoji: '🧆', gradient: 'from-amber-100 to-lime-100' };
  }
  if (name.includes('steak') || name.includes('meat') || name.includes('grill')) {
    return { emoji: '🥩', gradient: 'from-red-100 to-rose-100' };
  }
  if (name.includes('breakfast') || name.includes('brunch')) {
    return { emoji: '🍳', gradient: 'from-yellow-100 to-amber-100' };
  }
  if (name.includes('salad') || name.includes('healthy') || name.includes('vegan')) {
    return { emoji: '🥗', gradient: 'from-green-100 to-lime-100' };
  }
  return { emoji: '🍽️', gradient: 'from-slate-100 to-gray-100' };
};

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
  review_videos?: Array<{ video_url: string; thumbnail_url?: string }>;
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

interface SavedCollection {
  id: string;
  name: string;
  cover_image_url: string | null;
  items_count: number;
  preview_images: string[];
  created_at: string;
  updated_at: string;
}

type ProfileTab = 'published' | 'unpublished' | 'saved';

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useUser();
  const { profileData, profileLoading, refreshProfile } = usePrefetch();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({ experiences: 0, followers: 0, following: 0 });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [collections, setCollections] = useState<SavedCollection[]>([]);
  const [allSavedCount, setAllSavedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingTab, setLoadingTab] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('published');
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();


  // Use prefetched data on initial load for instant display
  useEffect(() => {
    if (profileData && !profile) {
      // Use prefetched data immediately - but only if profile exists
      if (profileData.profile) {
        setProfile(profileData.profile);
        if (profileData.stats) {
          setStats(profileData.stats);
        }
        if (profileData.reviews && activeTab === 'published') {
          setReviews(profileData.reviews);
        }
        setLoading(false);
        setLoadingTab(false);
      }
      // If profileData exists but profile is null, we need to fetch fresh
    }
  }, [profileData, profile, activeTab]);

  // Optimized: Single API call for profile, stats, and reviews
  const fetchProfileDataFromAPI = async (tab: string = activeTab) => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`/api/profile/me?tab=${tab}`);
      const data = await response.json();
      
      if (data.error) {
        console.error('API error:', data.error, data.details);
        // Still try to set loading to false but profile stays null
        setLoading(false);
        return;
      }
      
      // Set all data at once
      if (data.profile) {
        setProfile(data.profile);
      }
      if (data.stats) {
        setStats(data.stats);
      }
      if (data.reviews) {
        setReviews(data.reviews);
      }
      setLoading(false);
      setLoadingTab(false);
    } catch (error) {
      console.error('Error fetching profile data:', error);
      setLoading(false);
      setLoadingTab(false);
    }
  };

  // Initial load - use prefetched data or fetch if not available
  useEffect(() => {
    // Fetch if: user exists AND (no prefetch data OR prefetch had no profile) AND we don't have profile yet
    const needsFetch = user && !profile && (!profileData || !profileData.profile);
    if (needsFetch) {
      setLoading(true);
      fetchProfileDataFromAPI('published');
    }
  }, [user, profileData, profile]);

  // Tab change - only fetch reviews for that tab
  useEffect(() => {
    if (user && profile) {
      if (activeTab === 'published' || activeTab === 'unpublished') {
        setLoadingTab(true);
        fetchReviewsOnly();
      } else {
        fetchCollections();
      }
    }
  }, [activeTab]);

  // Light-weight reviews fetch for tab switching
  const fetchReviewsOnly = async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`/api/profile/me?tab=${activeTab}`);
      const data = await response.json();
      
      if (data.reviews) {
        setReviews(data.reviews);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setReviews([]);
    } finally {
      setLoadingTab(false);
    }
  };

  // Keep these for backwards compatibility and refresh functionality
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
    }
  };

  const fetchStats = async () => {
    // Refresh stats after actions like delete/follow
    try {
      const response = await fetch(`/api/profile/me?tab=${activeTab}`);
      const data = await response.json();
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchReviews = async () => {
    setLoadingTab(true);
    await fetchReviewsOnly();
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

  const fetchCollections = async () => {
    if (!user?.id) return;
    
    setLoadingTab(true);
    try {
      // Fetch collections and all saved count in parallel
      const [collectionsRes, wishlistRes] = await Promise.all([
        fetch('/api/collections'),
        fetch('/api/wishlist'),
      ]);
      
      const collectionsData = await collectionsRes.json();
      const wishlistData = await wishlistRes.json();
      
      if (collectionsData.collections) {
        setCollections(collectionsData.collections);
      }
      
      if (wishlistData.wishlist) {
        setAllSavedCount(wishlistData.count || wishlistData.wishlist.length);
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
      setCollections([]);
    } finally {
      setLoadingTab(false);
    }
  };

  const handleCollectionCreated = (collection: { id: string; name: string }) => {
    // Refresh collections after creating a new one
    fetchCollections();
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
                  // Only show user-uploaded content (photos or video thumbnails), not Google restaurant images
                  const hasVideo = (review.review_videos?.length || 0) > 0;
                  const videoThumbnail = review.review_videos?.[0]?.thumbnail_url;
                  const photoUrl = review.review_photos?.[0]?.photo_url;
                  const thumbnailUrl = videoThumbnail || photoUrl; // Removed restaurant fallback
                  const hasMultipleMedia = ((review.review_photos?.length || 0) + (review.review_videos?.length || 0)) > 1;
                  
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
                        (() => {
                          const { emoji, gradient } = getGridPlaceholderStyle(review.restaurants?.name);
                          return (
                            <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center relative overflow-hidden`}>
                              {/* Subtle decorative elements */}
                              <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/30 blur-xl" />
                              <div className="absolute -bottom-4 -left-4 w-12 h-12 rounded-full bg-white/20 blur-lg" />
                              
                              {/* Icon */}
                              <span className="text-3xl mb-1 drop-shadow-sm relative z-10">{emoji}</span>
                              
                              {/* Rating badge */}
                              <div className="flex items-center gap-0.5 bg-white/70 backdrop-blur-sm px-1.5 py-0.5 rounded-full relative z-10">
                                <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                                <span className="text-[10px] font-semibold text-gray-700">{review.rating.toFixed(1)}</span>
                              </div>
                            </div>
                          );
                        })()
                      )}
                      
                      {/* Video Indicator */}
                      {hasVideo && (
                        <div className="absolute top-2 right-2">
                          <Play className="w-5 h-5 text-white drop-shadow-lg fill-white" />
                        </div>
                      )}
                      
                      {/* Multiple Media Indicator (only if no video indicator shown) */}
                      {!hasVideo && hasMultipleMedia && (
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
            // Saved Collections Grid
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3">
                {/* All Saved Collection - Always First */}
                <Link
                  href="/profile/collections/all"
                  className="relative aspect-square bg-gray-100 rounded-2xl overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                    <Bookmark className="w-12 h-12 text-gray-400" />
                  </div>
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-3">
                    <p className="text-white font-semibold text-sm">All Saved</p>
                    <p className="text-white/70 text-xs">{allSavedCount} {allSavedCount === 1 ? 'place' : 'places'}</p>
                  </div>
                </Link>

                {/* User Collections */}
                {collections.map((collection) => (
                  <Link
                    key={collection.id}
                    href={`/profile/collections/${collection.id}`}
                    className="relative aspect-square bg-gray-100 rounded-2xl overflow-hidden group"
                  >
                    {/* Collection Cover - Grid of up to 4 images or placeholder */}
                    {collection.preview_images && collection.preview_images.length > 0 ? (
                      collection.preview_images.length === 1 ? (
                        <img
                          src={collection.cover_image_url || collection.preview_images[0]}
                          alt={collection.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                          {collection.preview_images.slice(0, 4).map((img, idx) => (
                            <div key={idx} className="relative overflow-hidden">
                              <img
                                src={img}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                          {/* Fill empty slots if less than 4 images */}
                          {Array.from({ length: Math.max(0, 4 - collection.preview_images.length) }).map((_, idx) => (
                            <div key={`empty-${idx}`} className="bg-gray-200" />
                          ))}
                        </div>
                      )
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                        <Bookmark className="w-10 h-10 text-primary/40" />
                      </div>
                    )}
                    
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-3">
                      <p className="text-white font-semibold text-sm truncate">{collection.name}</p>
                      <p className="text-white/70 text-xs">{collection.items_count} {collection.items_count === 1 ? 'place' : 'places'}</p>
                    </div>
                  </Link>
                ))}

                {/* Create New Collection Button */}
                <button
                  onClick={() => setShowCollectionModal(true)}
                  className="aspect-square bg-white border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors group"
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <FolderPlus className="w-6 h-6 text-gray-400 group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-sm font-medium text-gray-500 group-hover:text-primary transition-colors">New Collection</span>
                </button>
              </div>

              {/* Empty State - Only show if no collections and no saved items */}
              {collections.length === 0 && allSavedCount === 0 && (
                <div className="mt-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl border-2 border-dashed border-red-200 p-8 text-center">
                  <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                    <Bookmark className="w-7 h-7 text-gray-400" />
                  </div>
                  <p className="text-gray-900 font-bold">Start saving places!</p>
                  <p className="text-sm text-gray-600 mt-1 mb-3">Save restaurants you want to try and organize them into collections</p>
                  <Link 
                    href="/map" 
                    className="inline-block bg-primary text-white px-5 py-2 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
                  >
                    Explore Restaurants
                  </Link>
                </div>
              )}
            </div>
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

      {/* Create Collection Modal */}
      <CollectionModal
        isOpen={showCollectionModal}
        onClose={() => setShowCollectionModal(false)}
        onSuccess={handleCollectionCreated}
      />
    </MainLayout>
  );
}
