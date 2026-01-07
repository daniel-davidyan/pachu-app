'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, MapPin, Heart, Navigation, Phone, Globe, ChevronRight, Edit3, Loader2, Calendar, Bookmark } from 'lucide-react';
import { Restaurant } from './mapbox';
import { WriteReviewModal } from '@/components/review/write-review-modal';
import { formatAddress, extractCityFromAddress } from '@/lib/address-utils';
import { CollectionPicker } from '@/components/collections/collection-picker';
import { CollectionModal } from '@/components/collections/collection-modal';

interface RestaurantCardProps {
  restaurant: Restaurant | null;
  onClose: () => void;
  userLocation?: { lat: number; lng: number } | null;
  onReviewModalChange?: (isOpen: boolean) => void;
}

interface Friend {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
}

export function RestaurantCard({ restaurant, onClose, userLocation, onReviewModalChange }: RestaurantCardProps) {
  const router = useRouter();
  const [similarPlaces, setSimilarPlaces] = useState<Restaurant[]>([]);
  const [isLiked, setIsLiked] = useState(false);
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [loadingWishlist, setLoadingWishlist] = useState(false);
  const [friendsWhoVisited, setFriendsWhoVisited] = useState<Friend[]>([]);
  const [loadingWebsite, setLoadingWebsite] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState<string | undefined>(restaurant?.website);
  const [hasNoWebsite, setHasNoWebsite] = useState(false);
  const [loadingOntopo, setLoadingOntopo] = useState(false);
  const [ontopoUrl, setOntopoUrl] = useState<string | null>(null);
  const [isIsrael, setIsIsrael] = useState(false);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);

  // Notify parent when review modal opens/closes
  useEffect(() => {
    onReviewModalChange?.(showWriteReview);
  }, [showWriteReview, onReviewModalChange]);

  // Update website URL when restaurant changes
  useEffect(() => {
    setWebsiteUrl(restaurant?.website);
    setHasNoWebsite(false); // Reset when restaurant changes
  }, [restaurant]);

  // Check if restaurant is in Israel and fetch ONTOPO link, and check for website
  useEffect(() => {
    // Reset state when restaurant changes
    setOntopoUrl(null);
    setIsIsrael(false);
    setHasNoWebsite(false);
    
    if (!restaurant) return;

    const checkDetailsAndFetchData = async () => {
      // Check if restaurant is in Israel and has website by fetching place details
      try {
        const placeId = restaurant.googlePlaceId || restaurant.id;
        const response = await fetch(`/api/restaurants/details?placeId=${placeId}`);
        const data = await response.json();
        
        // Check if website exists
        if (data.website) {
          setWebsiteUrl(data.website);
          setHasNoWebsite(false);
        } else {
          setHasNoWebsite(true);
        }
        
        // Check if country is Israel
        const country = data.country || restaurant.address?.toLowerCase();
        const inIsrael = country?.toLowerCase().includes('israel') || 
                         country?.toLowerCase().includes('ישראל');
        
        setIsIsrael(inIsrael);

        // If in Israel, fetch ONTOPO link
        if (inIsrael) {
          const city = data.city || extractCityFromAddress(restaurant.address);
          const ontopoResponse = await fetch(
            `/api/ontopo?name=${encodeURIComponent(restaurant.name)}${city ? `&city=${encodeURIComponent(city)}` : ''}`
          );
          
          if (ontopoResponse.ok) {
            const ontopoData = await ontopoResponse.json();
            setOntopoUrl(ontopoData.url);
          } else {
            // If ONTOPO returns error, don't show the button
            console.log('ONTOPO not available for this restaurant');
            setOntopoUrl(null);
          }
        }
      } catch (error) {
        console.error('Error checking restaurant details:', error);
        // On error, hide the button
        setOntopoUrl(null);
      }
    };

    checkDetailsAndFetchData();
  }, [restaurant]);

  const handleWishlist = async () => {
    if (loadingWishlist) return;
    
    if (isLiked) {
      // If already saved, remove from wishlist
      setLoadingWishlist(true);
      setIsLiked(false);
      
      try {
        // Remove from wishlist - we need to get the restaurant ID first
        const wishlistResponse = await fetch('/api/wishlist');
        const wishlistData = await wishlistResponse.json();
        const wishlistItem = wishlistData.wishlist?.find(
          (item: any) => item.restaurants?.google_place_id === (restaurant?.googlePlaceId || restaurant?.id)
        );

        if (wishlistItem) {
          const response = await fetch(`/api/wishlist?restaurantId=${wishlistItem.restaurants.id}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            throw new Error('Failed to remove from wishlist');
          }
        }
      } catch (error) {
        console.error('Error updating wishlist:', error);
        // Revert on error
        setIsLiked(true);
      } finally {
        setLoadingWishlist(false);
      }
    } else {
      // If not saved, open collection picker
      setShowCollectionPicker(true);
    }
  };

  const handleSavedToCollection = (collectionId: string | null) => {
    setIsLiked(true);
  };

  const handleCreateNewCollection = () => {
    setShowCollectionModal(true);
  };

  const handleCollectionCreated = (collection: { id: string; name: string }) => {
    // Re-open collection picker after creating a collection
    setShowCollectionPicker(true);
  };

  // Check if restaurant is already in wishlist
  useEffect(() => {
    if (!restaurant) return;
    
    const checkWishlistStatus = async () => {
      try {
        const response = await fetch('/api/wishlist');
        const data = await response.json();
        const inWishlist = data.wishlist?.some(
          (item: any) => item.restaurants?.google_place_id === (restaurant.googlePlaceId || restaurant.id)
        );
        setIsLiked(inWishlist || false);
      } catch (error) {
        console.error('Error checking wishlist status:', error);
      }
    };
    
    checkWishlistStatus();
  }, [restaurant]);

  // Fetch similar places
  useEffect(() => {
    if (!restaurant || !userLocation) return;
    
    const fetchSimilar = async () => {
      try {
        const response = await fetch(
          `/api/restaurants/nearby?latitude=${restaurant.latitude}&longitude=${restaurant.longitude}&radius=1000`
        );
        const data = await response.json();
        const places = (data.restaurants || [])
          .filter((r: Restaurant) => r.id !== restaurant.id)
          .slice(0, 5);
        setSimilarPlaces(places);
      } catch (error) {
        console.error('Error fetching similar places:', error);
      }
    };
    
    fetchSimilar();
  }, [restaurant, userLocation]);

  // Fetch friends who visited this restaurant
  useEffect(() => {
    if (!restaurant) return;
    
    const fetchFriendsWhoVisited = async () => {
      try {
        const restaurantId = restaurant.googlePlaceId || restaurant.id;
        const response = await fetch(`/api/restaurants/${restaurantId}`);
        const data = await response.json();
        
        if (data.friendsWhoReviewed) {
          setFriendsWhoVisited(data.friendsWhoReviewed);
        }
      } catch (error) {
        console.error('Error fetching friends who visited:', error);
      }
    };
    
    fetchFriendsWhoVisited();
  }, [restaurant]);

  if (!restaurant) return null;

  const isFriendOrOwn = restaurant.source === 'friends' || restaurant.source === 'own';

  const getIcon = (r: Restaurant) => {
    const cuisines = r.cuisineTypes || [];
    const name = r.name.toLowerCase();
    
    // Coffee & Café
    if (cuisines.some(c => c.includes('coffee') || c.includes('cafe')) || name.includes('cafe') || name.includes('coffee')) return '☕';
    
    // Pizza & Italian
    if (cuisines.some(c => c.includes('pizza') || c.includes('italian')) || name.includes('pizza')) return '🍕';
    
    // Sushi & Japanese
    if (cuisines.some(c => c.includes('sushi') || c.includes('japanese'))) return '🍣';
    
    // Chinese & Asian
    if (cuisines.some(c => c.includes('chinese') || c.includes('asian'))) return '🥡';
    
    // Burger & American
    if (cuisines.some(c => c.includes('burger') || c.includes('american')) || name.includes('burger')) return '🍔';
    
    // Mexican
    if (cuisines.some(c => c.includes('mexican')) || name.includes('taco') || name.includes('burrito')) return '🌮';
    
    // Indian
    if (cuisines.some(c => c.includes('indian'))) return '🍛';
    
    // Bakery & Desserts
    if (cuisines.some(c => c.includes('bakery') || c.includes('dessert') || c.includes('ice_cream'))) return '🧁';
    
    // Bar & Pub
    if (cuisines.some(c => c.includes('bar') || c.includes('pub')) || name.includes('bar')) return '🍺';
    
    // Seafood
    if (cuisines.some(c => c.includes('seafood') || c.includes('fish'))) return '🦐';
    
    // Steakhouse & Grill
    if (cuisines.some(c => c.includes('steakhouse') || c.includes('grill') || c.includes('bbq'))) return '🥩';
    
    // Thai
    if (cuisines.some(c => c.includes('thai'))) return '🍜';
    
    // Mediterranean & Greek
    if (cuisines.some(c => c.includes('mediterranean') || c.includes('greek') || c.includes('middle_eastern'))) return '🥙';
    
    // French
    if (cuisines.some(c => c.includes('french'))) return '🥐';
    
    // Vietnamese
    if (cuisines.some(c => c.includes('vietnamese'))) return '🍲';
    
    // Korean
    if (cuisines.some(c => c.includes('korean'))) return '🍱';
    
    // Breakfast & Brunch
    if (cuisines.some(c => c.includes('breakfast') || c.includes('brunch'))) return '🥞';
    
    // Vegan & Vegetarian
    if (cuisines.some(c => c.includes('vegan') || c.includes('vegetarian'))) return '🥗';
    
    // Default
    return '🍽️';
  };

  const handleDirections = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${restaurant.latitude},${restaurant.longitude}`;
    window.open(url, '_blank');
  };

  const handleViewDetails = () => {
    const restaurantId = restaurant.googlePlaceId || restaurant.id;
    router.push(`/restaurant/${restaurantId}`);
  };

  const handleSimilarPlaceClick = (place: Restaurant) => {
    const placeId = place.googlePlaceId || place.id;
    router.push(`/restaurant/${placeId}`);
  };

  const handleWebsite = async () => {
    if (loadingWebsite) return;

    // If we already have the website URL, open it
    if (websiteUrl) {
      window.open(websiteUrl, '_blank');
      return;
    }

    // Otherwise, fetch it from the details API
    setLoadingWebsite(true);
    try {
      const placeId = restaurant?.googlePlaceId || restaurant?.id;
      const response = await fetch(`/api/restaurants/details?placeId=${placeId}`);
      const data = await response.json();
      
      if (data.website) {
        setWebsiteUrl(data.website);
        window.open(data.website, '_blank');
      } else {
        // No website available - mark it so we can hide the button
        setHasNoWebsite(true);
        console.log('No website available for this restaurant');
      }
    } catch (error) {
      console.error('Error fetching website:', error);
    } finally {
      setLoadingWebsite(false);
    }
  };

  const handleOntopo = async () => {
    if (loadingOntopo) return;

    // If we already have the ONTOPO URL, open it
    if (ontopoUrl) {
      window.open(ontopoUrl, '_blank');
      return;
    }

    // Otherwise, try to fetch it
    setLoadingOntopo(true);
    try {
      const city = extractCityFromAddress(restaurant?.address);
      const response = await fetch(
        `/api/ontopo?name=${encodeURIComponent(restaurant?.name || '')}${city ? `&city=${encodeURIComponent(city)}` : ''}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setOntopoUrl(data.url);
        window.open(data.url, '_blank');
      } else {
        console.log('No ONTOPO page available for this restaurant');
      }
    } catch (error) {
      console.error('Error fetching ONTOPO link:', error);
    } finally {
      setLoadingOntopo(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-40 animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modern Card */}
      <div 
        className="fixed bottom-[72px] z-50 animate-slide-up"
        style={{
          left: 'max(0.75rem, env(safe-area-inset-left))',
          right: 'max(0.75rem, env(safe-area-inset-right))',
        }}
      >
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Main Content */}
          <div className="p-4">
            {/* Header Row - Clickable to view details */}
            <div 
              className="flex gap-3 cursor-pointer hover:bg-gray-50 -m-4 p-4 rounded-t-3xl transition-colors"
              onClick={handleViewDetails}
            >
              {/* Image */}
              <div className="w-20 h-20 flex-shrink-0 rounded-2xl overflow-hidden bg-gray-100 relative">
                {restaurant.photoUrl ? (
                  <img 
                    src={restaurant.photoUrl} 
                    alt={restaurant.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl bg-gradient-to-br from-primary/10 to-primary/5">
                    {getIcon(restaurant)}
                  </div>
                )}
                {isFriendOrOwn && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-[10px]">{restaurant.source === 'own' ? '⭐' : '👥'}</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-gray-900 text-lg leading-tight truncate pr-2">
                    {restaurant.name}
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    className="p-1.5 -m-1 hover:bg-gray-100 rounded-full flex-shrink-0 transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                
                {/* Rating & Meta */}
                <div className="flex items-center gap-1.5 mt-1">
                  {/* Match Percentage */}
                  <div className="bg-white border border-gray-200 rounded-full px-2 py-0.5 shadow-sm">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-green-400 to-green-500 animate-pulse" />
                      <span className="text-xs font-bold text-gray-900">{Math.round((restaurant.rating / 5) * 100)}%</span>
                      <span className="text-[9px] text-gray-500 font-medium">match</span>
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="flex items-center gap-1 mt-1.5">
                  <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <p className="text-xs text-gray-500 truncate">{formatAddress(restaurant.address)}</p>
                </div>
              </div>
            </div>

            {/* Friends Who Visited - Enhanced Modern Design */}
            {friendsWhoVisited.length > 0 && (
              <div className="mt-3 -mx-4 px-4 py-2.5 bg-gradient-to-r from-primary/5 via-purple-50/50 to-pink-50/50 border-t border-b border-primary/10">
                <div className="flex items-center gap-2.5">
                  {/* Avatar Stack */}
                  <div className="flex -space-x-2.5 relative">
                    {friendsWhoVisited.slice(0, 3).map((friend, index) => (
                      friend.avatarUrl ? (
                        <div
                          key={friend.id}
                          className="relative"
                          style={{ zIndex: 10 - index }}
                        >
                          <img
                            src={friend.avatarUrl}
                            alt={friend.fullName}
                            className="w-8 h-8 rounded-full border-2 border-white object-cover shadow-sm"
                          />
                        </div>
                      ) : (
                        <div
                          key={friend.id}
                          className="relative w-8 h-8 rounded-full border-2 border-white bg-gradient-to-br from-primary via-purple-500 to-pink-500 flex items-center justify-center shadow-sm"
                          style={{ zIndex: 10 - index }}
                        >
                          <span className="text-xs font-bold text-white">
                            {friend.fullName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )
                    ))}
                    {friendsWhoVisited.length > 3 && (
                      <div className="relative w-8 h-8 rounded-full border-2 border-white bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center shadow-sm" style={{ zIndex: 7 }}>
                        <span className="text-[10px] font-bold text-white">
                          +{friendsWhoVisited.length - 3}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Text Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-tight text-gray-800">
                      {friendsWhoVisited.length === 1 ? (
                        <>
                          <span className="font-bold text-primary">{friendsWhoVisited[0].fullName}</span>
                          <span className="text-gray-600"> visited here</span>
                        </>
                      ) : friendsWhoVisited.length === 2 ? (
                        <>
                          <span className="font-bold text-primary">{friendsWhoVisited[0].fullName}</span>
                          <span className="text-gray-600"> and </span>
                          <span className="font-bold text-primary">{friendsWhoVisited[1].fullName}</span>
                          <span className="text-gray-600"> visited here</span>
                        </>
                      ) : (
                        <>
                          <span className="font-bold text-primary">{friendsWhoVisited[0].fullName}</span>
                          <span className="text-gray-600"> and </span>
                          <span className="font-bold text-primary">{friendsWhoVisited.length - 1} others</span>
                          <span className="text-gray-600"> visited here</span>
                        </>
                      )}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] text-gray-500 font-medium">
                        From your following
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Action Buttons */}
            <div className="flex gap-2 mt-4">
              <button 
                onClick={handleDirections}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-2xl text-sm font-semibold hover:bg-primary/90 transition-all active:scale-[0.98]"
              >
                <Navigation className="w-4 h-4" />
                Directions
              </button>
              <button 
                onClick={() => setShowWriteReview(true)}
                className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-2xl hover:bg-gray-200 transition-colors active:scale-95"
              >
                <Edit3 className="w-5 h-5 text-gray-600" />
              </button>
              <button 
                onClick={handleWishlist}
                disabled={loadingWishlist}
                className={`flex items-center justify-center w-12 h-12 rounded-2xl transition-all active:scale-95 disabled:opacity-50 ${
                  isLiked ? 'bg-primary/10' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {loadingWishlist ? (
                  <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
                ) : (
                  <Bookmark className={`w-5 h-5 transition-colors ${isLiked ? 'fill-primary text-primary' : 'text-gray-600'}`} />
                )}
              </button>
              {/* Website button - Only show if not confirmed to have no website */}
              {!hasNoWebsite && (
                <button 
                  onClick={handleWebsite}
                  disabled={loadingWebsite}
                  className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-2xl hover:bg-gray-200 transition-colors active:scale-95 disabled:opacity-50"
                >
                  {loadingWebsite ? (
                    <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
                  ) : (
                    <Globe className="w-5 h-5 text-gray-600" />
                  )}
                </button>
              )}
              {/* ONTOPO Reservation Button - Only for Israeli restaurants */}
              {isIsrael && (
                <button 
                  onClick={handleOntopo}
                  disabled={loadingOntopo}
                  className="flex items-center justify-center w-12 h-12 bg-green-50 rounded-2xl hover:bg-green-100 transition-colors active:scale-95 disabled:opacity-50 border border-green-200"
                  title="Reserve on ONTOPO"
                >
                  {loadingOntopo ? (
                    <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
                  ) : (
                    <Calendar className="w-5 h-5 text-green-600" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Similar Places Carousel */}
          {similarPlaces.length > 0 && (
            <div className="border-t border-gray-100 pt-3 pb-4">
              <div className="flex items-center justify-between px-4 mb-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Similar nearby</h4>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex gap-2 px-4 overflow-x-auto scrollbar-hide">
                {similarPlaces.map((place) => (
                  <div 
                    key={place.id}
                    onClick={() => handleSimilarPlaceClick(place)}
                    className="flex-shrink-0 w-28 bg-gray-50 rounded-xl p-2 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <div className="w-full h-16 rounded-lg overflow-hidden bg-gray-200 mb-1.5">
                      {place.photoUrl ? (
                        <img src={place.photoUrl} alt={place.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl bg-gradient-to-br from-gray-100 to-gray-200">
                          {getIcon(place)}
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-medium text-gray-900 truncate">{place.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="bg-white border border-gray-200 rounded-full px-1.5 py-0.5">
                        <div className="flex items-center gap-0.5">
                          <div className="w-1 h-1 rounded-full bg-gradient-to-r from-green-400 to-green-500" />
                          <span className="text-[10px] font-bold text-gray-900">{Math.round((place.rating / 5) * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Write Review Modal */}
      <WriteReviewModal
        isOpen={showWriteReview}
        onClose={() => setShowWriteReview(false)}
        restaurant={restaurant ? {
          googlePlaceId: restaurant.googlePlaceId || restaurant.id,
          name: restaurant.name,
          address: restaurant.address,
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
          photoUrl: restaurant.photoUrl,
        } : null}
        onSuccess={() => {
          setShowWriteReview(false);
        }}
      />

      {/* Collection Picker */}
      {restaurant && (
        <CollectionPicker
          isOpen={showCollectionPicker}
          onClose={() => setShowCollectionPicker(false)}
          restaurant={{
            googlePlaceId: restaurant.googlePlaceId || restaurant.id,
            name: restaurant.name,
            address: restaurant.address,
            imageUrl: restaurant.photoUrl,
          }}
          onSaved={handleSavedToCollection}
          onCreateNew={handleCreateNewCollection}
        />
      )}

      {/* Create Collection Modal */}
      <CollectionModal
        isOpen={showCollectionModal}
        onClose={() => setShowCollectionModal(false)}
        onSuccess={handleCollectionCreated}
      />
    </>
  );
}

