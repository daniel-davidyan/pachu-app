'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Star, Camera, MapPin, Loader2, Search, MessageSquare, Send, Video, Play } from 'lucide-react';
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
  videos?: string[];
}

interface MediaItem {
  id: string;
  type: 'photo' | 'video';
  url: string;
  thumbnailUrl?: string;
  file?: File;
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
  
  // IMPORTANT: Initialize state to empty, let useEffect handle initial values
  // This prevents any stale state issues
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [experienceText, setExperienceText] = useState('');
  
  // Media items (photos and videos combined)
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  
  // Legacy state for backwards compatibility during transition
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoUrlToFileMap, setPhotoUrlToFileMap] = useState<Map<string, File>>(new Map());
  
  const [submitting, setSubmitting] = useState(false);
  const [submitType, setSubmitType] = useState<'publish' | 'save' | null>(null); // Track which button was clicked
  const [initialized, setInitialized] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);
  const [generatingThumbnail, setGeneratingThumbnail] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const { showToast } = useToast();

  // Initialize/reset form when modal opens or existingReview changes
  // This runs EVERY time isOpen becomes true or existingReview changes
  useEffect(() => {
    if (!isOpen) {
      // When modal closes, reset initialized flag so next open will re-initialize
      setInitialized(false);
      return;
    }
    
    // Only initialize once per modal open
    if (initialized) return;
    
    console.log('[WriteReviewModal] Initializing with existingReview:', existingReview?.id, 'photos:', existingReview?.photos?.length);
    
    if (existingReview) {
      // Editing mode - load existing data
      setRating(existingReview.rating);
      setExperienceText(existingReview.content || '');
      // IMPORTANT: Create a fresh copy of the photos array to avoid reference issues
      setPhotoUrls([...(existingReview.photos || [])]);
      setPhotos([]); // No new files yet
      setPhotoUrlToFileMap(new Map()); // Clear the map
      
      // Initialize media items from existing photos and videos
      const existingMedia: MediaItem[] = [
        ...(existingReview.photos || []).map((url, i) => ({
          id: `photo-${i}`,
          type: 'photo' as const,
          url,
        })),
        ...(existingReview.videos || []).map((url, i) => ({
          id: `video-${i}`,
          type: 'video' as const,
          url,
        })),
      ];
      setMediaItems(existingMedia);
    } else {
      // Create mode - start fresh
      setRating(0);
      setExperienceText('');
      setPhotoUrls([]);
      setPhotos([]);
      setPhotoUrlToFileMap(new Map()); // Clear the map
      setMediaItems([]);
    }
    
    setInitialized(true);
  }, [isOpen, existingReview, initialized]);

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

  // Generate video thumbnail
  const generateVideoThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      
      video.onloadeddata = () => {
        video.currentTime = 1; // Seek to 1 second
      };
      
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
        URL.revokeObjectURL(video.src);
        resolve(thumbnailUrl);
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(''); // Return empty string on error
      };
    });
  };

  // Handle photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Reset the file input to allow selecting the same files again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    if (files.length === 0) return;
    
    // Check total media (existing + new)
    const totalMedia = mediaItems.length + files.length;
    if (totalMedia > 10) {
      showToast('Maximum 10 photos/videos allowed', 'error');
      return;
    }
    
    // Create preview URLs and add to state
    const newUrls: string[] = [];
    const newMap = new Map(photoUrlToFileMap);
    const newMediaItems: MediaItem[] = [];
    
    files.forEach(file => {
      const url = URL.createObjectURL(file);
      newUrls.push(url);
      newMap.set(url, file);
      newMediaItems.push({
        id: `photo-${Date.now()}-${Math.random()}`,
        type: 'photo',
        url,
        file,
      });
    });
    
    setPhotos(prev => [...prev, ...files]);
    setPhotoUrls(prev => [...prev, ...newUrls]);
    setPhotoUrlToFileMap(newMap);
    setMediaItems(prev => [...prev, ...newMediaItems]);
  };

  // Handle video selection
  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Reset the file input
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
    
    if (files.length === 0) return;
    
    // Check total media
    const totalMedia = mediaItems.length + files.length;
    if (totalMedia > 10) {
      showToast('Maximum 10 photos/videos allowed', 'error');
      return;
    }
    
    // Validate video duration (max 30 seconds)
    for (const file of files) {
      // Check file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        showToast('Video must be under 50MB', 'error');
        return;
      }
    }
    
    setGeneratingThumbnail(true);
    
    const newMediaItems: MediaItem[] = [];
    
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const thumbnailUrl = await generateVideoThumbnail(file);
      
      newMediaItems.push({
        id: `video-${Date.now()}-${Math.random()}`,
        type: 'video',
        url,
        thumbnailUrl,
        file,
      });
    }
    
    setMediaItems(prev => [...prev, ...newMediaItems]);
    setGeneratingThumbnail(false);
  };

  // Remove media item
  const removeMedia = (index: number) => {
    const itemToRemove = mediaItems[index];
    
    // Clean up blob URL if it's a local file
    if (itemToRemove.url.startsWith('blob:')) {
      URL.revokeObjectURL(itemToRemove.url);
      
      // Also update legacy photo states
      if (itemToRemove.type === 'photo') {
        const newMap = new Map(photoUrlToFileMap);
        newMap.delete(itemToRemove.url);
        setPhotoUrlToFileMap(newMap);
        
        if (itemToRemove.file) {
          setPhotos(prev => prev.filter(p => p !== itemToRemove.file));
        }
        setPhotoUrls(prev => prev.filter(url => url !== itemToRemove.url));
      }
    }
    
    setMediaItems(prev => prev.filter((_, i) => i !== index));
  };

  // Legacy remove function for backwards compatibility
  const removePhoto = (index: number) => {
    const urlToRemove = photoUrls[index];
    
    // Remove from map if it's a blob URL
    if (urlToRemove.startsWith('blob:')) {
      const newMap = new Map(photoUrlToFileMap);
      newMap.delete(urlToRemove);
      setPhotoUrlToFileMap(newMap);
      
      // Also remove from photos array
      const file = photoUrlToFileMap.get(urlToRemove);
      if (file) {
        setPhotos(prev => prev.filter(p => p !== file));
      }
    }
    
    // Remove URL from photoUrls
    setPhotoUrls(prev => prev.filter((_, i) => i !== index));
    
    // Also remove from mediaItems
    const mediaIndex = mediaItems.findIndex(m => m.url === urlToRemove);
    if (mediaIndex !== -1) {
      setMediaItems(prev => prev.filter((_, i) => i !== mediaIndex));
    }
  };

  // Touch-friendly drag and drop handlers (works on mobile and desktop)
  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    const touch = e.touches[0];
    setTouchStartPos({ x: touch.clientX, y: touch.clientY });
    
    // Start long press timer (500ms)
    const timer = setTimeout(() => {
      setIsDragging(true);
      setDraggedIndex(index);
      // Haptic feedback on supported devices
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);
    
    setLongPressTimer(timer);
  };

  const handleTouchMove = (e: React.TouchEvent, index: number) => {
    if (!isDragging || draggedIndex === null) {
      // Check if moved too much before long press completed
      if (touchStartPos && longPressTimer) {
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - touchStartPos.x);
        const deltaY = Math.abs(touch.clientY - touchStartPos.y);
        
        if (deltaX > 10 || deltaY > 10) {
          // Cancel long press if user scrolls
          clearTimeout(longPressTimer);
          setLongPressTimer(null);
        }
      }
      return;
    }

    e.preventDefault(); // Prevent scrolling while dragging
    
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    
    // Find which photo we're over
    if (element) {
      const photoElement = element.closest('[data-photo-index]');
      if (photoElement) {
        const overIndex = parseInt(photoElement.getAttribute('data-photo-index') || '-1');
        if (overIndex !== -1 && overIndex !== draggedIndex) {
          setDragOverIndex(overIndex);
        }
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Clear long press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    if (isDragging && draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      // Perform the reorder - only reorder photoUrls, the map stays the same
      const newPhotoUrls = [...photoUrls];
      
      const draggedUrl = newPhotoUrls[draggedIndex];
      
      // Remove from old position
      newPhotoUrls.splice(draggedIndex, 1);
      
      // Insert at new position
      newPhotoUrls.splice(dragOverIndex, 0, draggedUrl);
      
      setPhotoUrls(newPhotoUrls);
      
      // Haptic feedback on success
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    }

    // Reset states
    setIsDragging(false);
    setDraggedIndex(null);
    setDragOverIndex(null);
    setTouchStartPos(null);
  };

  // Mouse drag handlers for desktop
  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    setIsDragging(true);
    setDraggedIndex(index);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || draggedIndex === null) return;

    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (element) {
      const photoElement = element.closest('[data-photo-index]');
      if (photoElement) {
        const overIndex = parseInt(photoElement.getAttribute('data-photo-index') || '-1');
        if (overIndex !== -1 && overIndex !== draggedIndex) {
          setDragOverIndex(overIndex);
        }
      }
    }
  };

  const handleMouseUp = () => {
    if (isDragging && draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      // Perform the reorder - only reorder photoUrls, the map stays the same
      const newPhotoUrls = [...photoUrls];
      
      const draggedUrl = newPhotoUrls[draggedIndex];
      
      // Remove from old position
      newPhotoUrls.splice(draggedIndex, 1);
      
      // Insert at new position
      newPhotoUrls.splice(dragOverIndex, 0, draggedUrl);
      
      setPhotoUrls(newPhotoUrls);
    }

    // Reset states
    setIsDragging(false);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Submit review
  const handleSubmit = async (publish: boolean = true) => {
    if (!selectedRestaurant || rating === 0) {
      showToast('Please select a rating', 'error');
      return;
    }

    setSubmitting(true);
    setSubmitType(publish ? 'publish' : 'save'); // Track which button was clicked
    try {
      console.log('[WriteReviewModal] handleSubmit called with publish:', publish);
      console.log('[WriteReviewModal] Current mediaItems:', mediaItems.length);
      console.log('[WriteReviewModal] existingReview:', existingReview?.id);
      
      // Process all media items and upload new ones
      const finalPhotoUrls: string[] = [];
      const finalVideoUrls: { url: string; thumbnailUrl?: string }[] = [];
      
      for (let i = 0; i < mediaItems.length; i++) {
        const item = mediaItems[i];
        
        if (item.url.startsWith('blob:') && item.file) {
          // This is a new file that needs to be uploaded
          const fileExt = item.file.name.split('.').pop() || (item.type === 'video' ? 'mp4' : 'jpg');
          const fileName = `${Date.now()}-${i}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const bucket = item.type === 'video' ? 'review-videos' : 'review-photos';
          
          console.log(`[WriteReviewModal] Uploading new ${item.type}:`, fileName);
          
          const { data, error } = await supabase.storage
            .from(bucket)
            .upload(`reviews/${fileName}`, item.file);
          
          if (error) {
            console.error(`${item.type} upload error:`, error);
            showToast(`Failed to upload ${item.type}`, 'error');
            setSubmitting(false);
            return;
          }
          
          const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(`reviews/${fileName}`);
          
          if (item.type === 'video') {
            // Upload thumbnail if we have one
            let thumbnailPublicUrl: string | undefined;
            if (item.thumbnailUrl && item.thumbnailUrl.startsWith('data:')) {
              // Convert data URL to blob and upload
              const thumbnailBlob = await fetch(item.thumbnailUrl).then(r => r.blob());
              const thumbnailFileName = `${Date.now()}-thumb-${Math.random().toString(36).substring(7)}.jpg`;
              
              const { error: thumbError } = await supabase.storage
                .from('review-photos')
                .upload(`thumbnails/${thumbnailFileName}`, thumbnailBlob);
              
              if (!thumbError) {
                const { data: { publicUrl: thumbUrl } } = supabase.storage
                  .from('review-photos')
                  .getPublicUrl(`thumbnails/${thumbnailFileName}`);
                thumbnailPublicUrl = thumbUrl;
              }
            }
            finalVideoUrls.push({ url: publicUrl, thumbnailUrl: thumbnailPublicUrl });
          } else {
            finalPhotoUrls.push(publicUrl);
          }
        } else if (!item.url.startsWith('blob:')) {
          // This is an existing URL from the database
          if (item.type === 'video') {
            finalVideoUrls.push({ url: item.url, thumbnailUrl: item.thumbnailUrl });
          } else {
            finalPhotoUrls.push(item.url);
          }
        }
      }
      
      console.log('[WriteReviewModal] Final uploads:', finalPhotoUrls.length, 'photos,', finalVideoUrls.length, 'videos');

      // Submit experience
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant: selectedRestaurant,
          rating,
          content: experienceText,
          photoUrls: finalPhotoUrls,
          videoUrls: finalVideoUrls,
          reviewId: existingReview?.id, // Include reviewId when editing
          isPublished: publish,
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
        existingReview 
          ? 'Experience updated successfully!' 
          : publish 
            ? 'Experience posted successfully!' 
            : 'Experience saved successfully!',
        'success'
      );
      onSuccess?.();
      onClose();
      
      // Reset form
      setRating(0);
      setExperienceText('');
      setPhotos([]);
      setPhotoUrls([]);
      setMediaItems([]);
      setSelectedRestaurant(null);
      setStep('search');
    } catch (error) {
      console.error('Submit error:', error);
      showToast('Failed to submit experience', 'error');
    } finally {
      setSubmitting(false);
      setSubmitType(null); // Reset submit type
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

              {/* Media Upload - Photos & Videos */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Add Photos & Videos (Optional)
                  <span className="text-gray-400 font-normal ml-1">• Max 10 items, videos up to 30s</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  multiple
                  onChange={handleVideoSelect}
                  className="hidden"
                />
                
                {mediaItems.length === 0 ? (
                  /* Clean modern upload placeholder with both options */
                  <div className="flex gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="relative flex-1 h-32 rounded-2xl overflow-hidden transition-all hover:opacity-90 active:scale-[0.98]"
                      style={{
                        background: 'linear-gradient(135deg, #FFF5F7 0%, #FFF0F5 50%, #F8F4FF 100%)'
                      }}
                    >
                      <div className="relative flex flex-col items-center justify-center h-full">
                        <div className="relative w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FFE6F0' }}>
                          <Camera className="w-7 h-7" style={{ color: '#FF69B4' }} />
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FF69B4' }}>
                            <svg width="8" height="8" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M5 1V9M1 5H9" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-gray-600 mt-2">Photos</span>
                      </div>
                    </button>
                    <button
                      onClick={() => videoInputRef.current?.click()}
                      disabled={generatingThumbnail}
                      className="relative flex-1 h-32 rounded-2xl overflow-hidden transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                      style={{
                        background: 'linear-gradient(135deg, #F0F5FF 0%, #E8F0FF 50%, #F5F0FF 100%)'
                      }}
                    >
                      <div className="relative flex flex-col items-center justify-center h-full">
                        <div className="relative w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: '#E0E8FF' }}>
                          <Video className="w-7 h-7" style={{ color: '#6366F1' }} />
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#6366F1' }}>
                            <svg width="8" height="8" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M5 1V9M1 5H9" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-gray-600 mt-2">Video</span>
                      </div>
                    </button>
                  </div>
                ) : (
                  /* Media grid when items exist - with touch-friendly drag and drop */
                  <div 
                    className="grid grid-cols-3 gap-1.5"
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    {mediaItems.map((item, index) => (
                      <div
                        key={item.id}
                        data-photo-index={index}
                        onTouchStart={(e) => handleTouchStart(e, index)}
                        onTouchMove={(e) => handleTouchMove(e, index)}
                        onTouchEnd={handleTouchEnd}
                        onMouseDown={(e) => handleMouseDown(e, index)}
                        className={`
                          relative aspect-square select-none
                          transition-all duration-200 ease-out
                          ${draggedIndex === index ? 'scale-90 opacity-40 z-50' : ''}
                          ${dragOverIndex === index ? 'scale-110 ring-4 ring-primary/50 ring-offset-2 z-40' : 'scale-100'}
                          ${isDragging && draggedIndex === index ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'}
                        `}
                      >
                        {item.type === 'video' ? (
                          /* Video thumbnail with play indicator */
                          <div className="relative w-full h-full">
                            {item.thumbnailUrl ? (
                              <img 
                                src={item.thumbnailUrl} 
                                alt="" 
                                className="w-full h-full object-cover rounded-lg border border-gray-200 pointer-events-none" 
                                draggable={false}
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-800 rounded-lg flex items-center justify-center">
                                <Video className="w-8 h-8 text-gray-400" />
                              </div>
                            )}
                            {/* Play icon overlay */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                                <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                              </div>
                            </div>
                            {/* Video badge */}
                            <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded font-medium">
                              Video
                            </div>
                          </div>
                        ) : (
                          <img 
                            src={item.url} 
                            alt="" 
                            className="w-full h-full object-cover rounded-lg border border-gray-200 pointer-events-none" 
                            draggable={false}
                          />
                        )}
                        
                        {/* Visual feedback during drag */}
                        {isDragging && draggedIndex === index && (
                          <div className="absolute inset-0 bg-primary/20 rounded-lg flex items-center justify-center">
                            <div className="bg-white rounded-full p-3 shadow-xl">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7 10L12 5L17 10M7 14L12 19L17 14" stroke="#FF69B4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                          </div>
                        )}
                        
                        {/* Drop zone indicator */}
                        {isDragging && dragOverIndex === index && draggedIndex !== index && (
                          <div className="absolute inset-0 bg-primary/10 rounded-lg border-2 border-dashed border-primary animate-pulse" />
                        )}
                        
                        {/* Long press hint */}
                        {!isDragging && index === 0 && mediaItems.length > 1 && (
                          <div className="absolute bottom-1 left-1 right-1 bg-black/70 text-white text-[8px] text-center py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            Press & hold to reorder
                          </div>
                        )}
                        
                        {/* Remove button */}
                        <button
                          onClick={() => removeMedia(index)}
                          onTouchEnd={(e) => {
                            e.stopPropagation();
                            removeMedia(index);
                          }}
                          className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 hover:scale-110 transition-all z-50 active:scale-95"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    
                    {mediaItems.length < 10 && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors active:scale-95"
                        >
                          <Camera className="w-4 h-4" />
                          <span className="text-[8px] mt-0.5 font-medium">Photo</span>
                        </button>
                        <button
                          onClick={() => videoInputRef.current?.click()}
                          disabled={generatingThumbnail}
                          className="flex-1 aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-indigo-500 hover:text-indigo-500 hover:bg-indigo-50 transition-colors active:scale-95 disabled:opacity-50"
                        >
                          {generatingThumbnail ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Video className="w-4 h-4" />
                              <span className="text-[8px] mt-0.5 font-medium">Video</span>
                            </>
                          )}
                        </button>
                      </div>
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

              {/* Submit Buttons - Two Options */}
              <div className="pt-2 pb-4 sticky bottom-0 bg-white">
                <div className="space-y-3">
                  {/* Post Experience Button */}
                  <button
                    onClick={() => handleSubmit(true)}
                    disabled={rating === 0 || submitting}
                    className="w-full py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                    style={{ 
                      backgroundColor: '#C5459C',
                      color: '#FFFFFF',
                      boxShadow: '0 2px 8px rgba(197, 69, 156, 0.25)'
                    }}
                  >
                    {submitting && submitType === 'publish' ? (
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

                  {/* Save Without Publishing Button */}
                  <button
                    onClick={() => handleSubmit(false)}
                    disabled={rating === 0 || submitting}
                    className="w-full py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 bg-gray-100 text-gray-700 border border-gray-300"
                  >
                    {submitting && submitType === 'save' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <MessageSquare className="w-4 h-4" />
                        <span>Save Without Publishing</span>
                      </>
                    )}
                  </button>

                  {/* Helper Text */}
                  <p className="text-xs text-gray-500 text-center px-2 leading-relaxed">
                    Saving helps us learn your preferences and taste so we can suggest more accurate recommendations for you
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

