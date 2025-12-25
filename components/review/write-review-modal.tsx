'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Star, Camera, MapPin, Loader2, Search, MessageSquare, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';

interface Restaurant {
  id?: string;
  googlePlaceId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  photoUrl?: string;
}

interface Review {
  id: string;
  rating: number;
  content: string;
  photos: string[];
}

interface WriteReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurant?: Restaurant | null;
  existingReview?: Review | null;
  onSuccess?: () => void;
}

export function WriteReviewModal({ isOpen, onClose, restaurant: initialRestaurant, existingReview, onSuccess }: WriteReviewModalProps) {
  const [step, setStep] = useState<'search' | 'experience'>(initialRestaurant ? 'experience' : 'search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Restaurant[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(initialRestaurant || null);
  
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [experienceText, setExperienceText] = useState(existingReview?.content || '');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>(existingReview?.photos || []);
  const [submitting, setSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const { showToast } = useToast();
  
  // Track the review ID to detect when we're editing a different review
  const existingReviewIdRef = useRef<string | null>(existingReview?.id || null);

  // Update form when existingReview changes (only when editing a DIFFERENT review)
  useEffect(() => {
    if (existingReview && existingReview.id !== existingReviewIdRef.current) {
      existingReviewIdRef.current = existingReview.id;
      setRating(existingReview.rating);
      setExperienceText(existingReview.content);
      setPhotoUrls(existingReview.photos || []);
      setPhotos([]);
    } else if (!existingReview && existingReviewIdRef.current !== null) {
      // Reset when switching from edit mode to create mode
      existingReviewIdRef.current = null;
      setRating(0);
      setExperienceText('');
      setPhotoUrls([]);
      setPhotos([]);
    }
  }, [existingReview]);

  if (!isOpen) return null;

  // Search for restaurants
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      // Get user's location for nearby search
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      }).catch(() => ({ coords: { latitude: 32.0853, longitude: 34.7818 } } as GeolocationPosition));

      const response = await fetch(
        `/api/restaurants/search?query=${encodeURIComponent(searchQuery)}&latitude=${position.coords.latitude}&longitude=${position.coords.longitude}`
      );
      const data = await response.json();
      setSearchResults(data.restaurants || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  // Handle photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Reset the file input to allow selecting the same files again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    if (files.length === 0) return;
    
    // Check total photos (existing + new)
    if (files.length + photoUrls.length > 5) {
      showToast('Maximum 5 photos allowed', 'error');
      return;
    }
    
    // Create preview URLs and add to state
    const newUrls: string[] = [];
    files.forEach(file => {
      const url = URL.createObjectURL(file);
      newUrls.push(url);
    });
    
    setPhotos(prev => [...prev, ...files]);
    setPhotoUrls(prev => [...prev, ...newUrls]);
  };

  // Remove photo
  const removePhoto = (index: number) => {
    // Check if this is an existing photo URL or a new file
    if (index < photoUrls.length - photos.length) {
      // It's an existing photo URL
      setPhotoUrls(prev => prev.filter((_, i) => i !== index));
    } else {
      // It's a new file
      const fileIndex = index - (photoUrls.length - photos.length);
      setPhotos(prev => prev.filter((_, i) => i !== fileIndex));
      setPhotoUrls(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Submit review
  const handleSubmit = async () => {
    if (!selectedRestaurant || rating === 0) {
      showToast('Please select a rating', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // Build the final photo URLs array using a Set to prevent duplicates
      const photoUrlSet = new Set<string>();
      
      // First, add existing photos that haven't been removed
      // Existing photos are regular URLs (not blob URLs)
      for (let i = 0; i < photoUrls.length; i++) {
        const url = photoUrls[i];
        if (!url.startsWith('blob:')) {
          // This is an existing photo URL (from the database)
          photoUrlSet.add(url);
        }
      }
      
      // Then upload only the new photos (files in photos array)
      // These correspond to blob URLs in photoUrls but we upload the actual files
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const fileExt = photo.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}-${i}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { data, error } = await supabase.storage
          .from('review-photos')
          .upload(`reviews/${fileName}`, photo);
        
        if (error) {
          console.error('Photo upload error:', error);
          continue;
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('review-photos')
          .getPublicUrl(`reviews/${fileName}`);
        
        photoUrlSet.add(publicUrl);
      }
      
      // Convert Set back to array to preserve order and eliminate duplicates
      const finalPhotoUrls = Array.from(photoUrlSet);

      // Submit experience
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant: selectedRestaurant,
          rating,
          content: experienceText,
          photoUrls: finalPhotoUrls,
          reviewId: existingReview?.id, // Include reviewId when editing
        }),
      });

      const data = await response.json();

      if (data.error) {
        showToast(data.error, 'error');
        return;
      }

      if (!data.success) {
        showToast('Failed to submit experience. Please try again.', 'error');
        return;
      }

      // Success
      showToast(
        existingReview ? 'Experience updated successfully!' : 'Experience posted successfully!',
        'success'
      );
      onSuccess?.();
      onClose();
      
      // Reset form
      setRating(0);
      setExperienceText('');
      setPhotos([]);
      setPhotoUrls([]);
      setSelectedRestaurant(null);
      setStep('search');
    } catch (error) {
      console.error('Submit error:', error);
      showToast('Failed to submit experience', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      
      {/* Modal - Compact & Modern */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl max-h-[75vh] overflow-hidden animate-slide-up flex flex-col shadow-2xl">
        {/* Header - Compact */}
        <div className="sticky top-0 bg-gradient-to-r from-primary/5 to-primary/10 border-b border-primary/10 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            {step === 'search' ? (
              <>
                <Search className="w-4 h-4" />
                Find a Place
              </>
            ) : (
              <>
                Share Experience
              </>
            )}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/50 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {step === 'search' ? (
            /* Search Step */
            <div className="p-4">
              {/* Search Input */}
              <div className="flex gap-2 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search restaurant name..."
                    className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="px-4 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
                </button>
              </div>

              {/* Search Results */}
              <div className="space-y-2">
                {searchResults.map((restaurant, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSelectedRestaurant(restaurant);
                      setStep('experience');
                    }}
                    className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                      {restaurant.photoUrl ? (
                        <img src={restaurant.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">🍽️</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{restaurant.name}</p>
                      <p className="text-sm text-gray-500 truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {restaurant.address}
                      </p>
                    </div>
                  </button>
                ))}

                {searchResults.length === 0 && searchQuery && !searching && (
                  <p className="text-center text-gray-500 py-8">No restaurants found</p>
                )}
              </div>
            </div>
          ) : (
            /* Experience Step - Compact */
            <div className="p-4 space-y-3">
              {/* Selected Restaurant - Compact */}
              <div className="flex items-center gap-2.5 p-2.5 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border border-primary/20">
                <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                  {selectedRestaurant?.photoUrl ? (
                    <img src={selectedRestaurant.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl">🍽️</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{selectedRestaurant?.name}</p>
                  <p className="text-sm text-gray-500 truncate">{selectedRestaurant?.address}</p>
                </div>
                {!initialRestaurant && (
                  <button
                    onClick={() => setStep('search')}
                    className="text-primary text-sm font-medium"
                  >
                    Change
                  </button>
                )}
              </div>

              {/* Star Rating - Full Width Compact */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Your Rating</label>
                <div className="flex gap-1 w-full">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="flex-1 transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-full h-auto max-h-8 ${
                          star <= (hoverRating || rating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <p className="text-center text-xs font-medium text-primary mt-1">
                    {rating === 1 && '😞 Poor'}
                    {rating === 2 && '😐 Fair'}
                    {rating === 3 && '😊 Good'}
                    {rating === 4 && '😄 Very Good'}
                    {rating === 5 && '🤩 Excellent'}
                  </p>
                )}
              </div>

              {/* Photo Upload - Compact */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Add Photos (Optional)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                
                {photoUrls.length === 0 ? (
                  /* Compact upload placeholder */
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-28 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-1.5 group-hover:shadow-md transition-shadow">
                      <Camera className="w-6 h-6 text-gray-400 group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-xs font-semibold text-gray-600 group-hover:text-primary">Add Photos</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Tap to upload</p>
                  </button>
                ) : (
                  /* Photo grid when photos exist */
                  <div className="grid grid-cols-3 gap-1.5">
                    {photoUrls.map((url, index) => (
                      <div key={index} className="relative aspect-square">
                        <img src={url} alt="" className="w-full h-full object-cover rounded-lg border border-gray-200" />
                        <button
                          onClick={() => removePhoto(index)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    
                    {photoUrls.length < 6 && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                      >
                        <Camera className="w-5 h-5" />
                        <span className="text-[9px] mt-0.5 font-medium">Add</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Experience Text - Compact */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Your Experience (Optional)</label>
                <textarea
                  value={experienceText}
                  onChange={(e) => setExperienceText(e.target.value)}
                  placeholder="Share your thoughts..."
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none border border-gray-200"
                />
              </div>

              {/* Submit Button - Compact & Modern */}
              <div className="pt-2 pb-4 sticky bottom-0 bg-white">
                <button
                  onClick={handleSubmit}
                  disabled={rating === 0 || submitting}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                  style={{ 
                    backgroundColor: '#C5459C',
                    color: '#FFFFFF',
                    boxShadow: '0 2px 8px rgba(197, 69, 156, 0.25)'
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span style={{ color: '#FFFFFF' }}>Posting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" style={{ color: '#FFFFFF' }} />
                      <span style={{ color: '#FFFFFF' }}>Post Experience</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

