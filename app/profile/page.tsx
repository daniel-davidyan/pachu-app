'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { useUser } from '@/hooks/use-user';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useRef } from 'react';
import { Calendar, Camera, X, Check, Edit2, Heart, MapPin, Loader2, Trash2, MoreVertical } from 'lucide-react';
import { CompactRating } from '@/components/ui/modern-rating';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WriteReviewModal } from '@/components/review/write-review-modal';

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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({ experiences: 0, followers: 0, following: 0 });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTab, setLoadingTab] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('experiences');
  const [showReviewMenu, setShowReviewMenu] = useState<string | null>(null);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
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
    if (!confirm('Are you sure you want to delete this review?')) {
      return;
    }

    try {
      const response = await fetch(`/api/reviews?reviewId=${reviewId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setReviews(prev => prev.filter(review => review.id !== reviewId));
        fetchStats(); // Refresh stats
        setShowReviewMenu(null);
      } else {
        alert('Failed to delete review');
      }
    } catch (error) {
      console.error('Error deleting review:', error);
      alert('Failed to delete review');
    }
  };

  const handleEditReview = (review: Review) => {
    setEditingReview(review);
    setShowEditModal(true);
    setShowReviewMenu(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
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
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Failed to upload photo. Please try again.');
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
        alert(data.error || 'Failed to update profile');
        return;
      }

      setProfile(data.profile);
      setIsEditingProfile(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
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
    <MainLayout>
      <div className="pb-24 bg-gray-50 min-h-screen">
        {/* Compact Profile Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          {isEditingProfile ? (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Full Name"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary text-sm"
              />
              <input
                type="text"
                placeholder="Username"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary text-sm"
              />
              <textarea
                placeholder="Bio"
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary text-sm resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="flex-1 bg-primary text-white py-2 rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save
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
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
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
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">
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
                  className="absolute bottom-0 right-0 w-7 h-7 bg-white rounded-full shadow-lg flex items-center justify-center border-2 border-gray-100 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-3 h-3 text-primary animate-spin" />
                  ) : (
                    <Camera className="w-3 h-3 text-gray-600" />
                  )}
                </button>
              </div>

              {/* Info - Right Side - Centered & Spread */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                {/* Name and Username - Centered */}
                <div className="text-center">
                  <h2 className="text-lg font-bold text-gray-900">
                    {profile.full_name || profile.username}
                  </h2>
                  <p className="text-sm text-gray-500">@{profile.username}</p>
                </div>

                {/* Stats Row - Spread Across Width */}
                <div className="flex justify-around items-center mt-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 leading-none">{stats.experiences}</p>
                    <p className="text-[10px] text-gray-500 mt-1">Experiences</p>
                  </div>
                  <button
                    onClick={() => router.push('/profile/connections?tab=followers')}
                    className="text-center hover:bg-gray-50 px-2 py-1 rounded transition-colors"
                  >
                    <p className="text-2xl font-bold text-gray-900 leading-none">{stats.followers}</p>
                    <p className="text-[10px] text-gray-500 mt-1">Followers</p>
                  </button>
                  <button
                    onClick={() => router.push('/profile/connections?tab=following')}
                    className="text-center hover:bg-gray-50 px-2 py-1 rounded transition-colors"
                  >
                    <p className="text-2xl font-bold text-gray-900 leading-none">{stats.following}</p>
                    <p className="text-[10px] text-gray-500 mt-1">Following</p>
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
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
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
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {/* Restaurant Header */}
                    <Link
                      href={`/restaurant/${review.restaurants?.google_place_id || review.restaurants?.id}`}
                      className="block p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl overflow-hidden flex-shrink-0">
                          {review.restaurants?.image_url ? (
                            <img src={review.restaurants.image_url} alt={review.restaurants.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">🍽️</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 truncate">
                            {review.restaurants?.name || 'Restaurant'}
                          </h3>
                          <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {review.restaurants?.address || 'Address not available'}
                          </p>
                          <div className="flex items-center gap-1 mt-1.5">
                            <CompactRating rating={review.rating} />
                          </div>
                        </div>
                        <div className="relative flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setShowReviewMenu(showReviewMenu === review.id ? null : review.id);
                            }}
                            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-600" />
                          </button>
                          
                          {showReviewMenu === review.id && (
                            <>
                              <div 
                                className="fixed inset-0 z-10"
                                onClick={() => setShowReviewMenu(null)}
                              />
                              <div className="absolute right-0 top-10 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-32">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleEditReview(review);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleDeleteReview(review.id);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>

                    {/* Review Photos */}
                    {review.review_photos && review.review_photos.length > 0 && (
                      <div className="px-4 pb-3">
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                          {review.review_photos.map((photo, index) => (
                            <img
                              key={index}
                              src={photo.photo_url}
                              alt=""
                              className="w-28 h-28 rounded-xl object-cover flex-shrink-0 border border-gray-200"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Review Text */}
                    {review.content && (
                      <div className="px-4 pb-3">
                        <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{review.content}</p>
                      </div>
                    )}

                    {/* Date */}
                    <div className="px-4 pb-4 pt-2 border-t border-gray-50">
                      <p className="text-xs text-gray-400">
                        📅 {new Date(review.created_at).toLocaleDateString('en-US', { 
                          month: 'long', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>
                ))}
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
          onSuccess={() => {
            setShowEditModal(false);
            setEditingReview(null);
            fetchReviews();
            fetchStats();
          }}
        />
      )}
    </MainLayout>
  );
}
