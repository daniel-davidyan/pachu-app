'use client';

import { useState, useEffect } from 'react';
import { X, MapPin, Heart, Navigation, Phone, Globe, ChevronRight, Edit3, Loader2 } from 'lucide-react';
import { Restaurant } from './mapbox';
import { WriteReviewModal } from '@/components/review/write-review-modal';
import { CompactRating } from '@/components/ui/modern-rating';

interface RestaurantCardProps {
  restaurant: Restaurant | null;
  onClose: () => void;
  userLocation?: { lat: number; lng: number } | null;
}

export function RestaurantCard({ restaurant, onClose, userLocation }: RestaurantCardProps) {
  const [similarPlaces, setSimilarPlaces] = useState<Restaurant[]>([]);
  const [isLiked, setIsLiked] = useState(false);
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [loadingWishlist, setLoadingWishlist] = useState(false);

  const handleWishlist = async () => {
    if (loadingWishlist) return;
    
    setLoadingWishlist(true);
    const newWishlistState = !isLiked;
    setIsLiked(newWishlistState);
    
    try {
      if (newWishlistState) {
        // Add to wishlist
        const response = await fetch('/api/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            googlePlaceId: restaurant?.googlePlaceId || restaurant?.id,
            name: restaurant?.name,
            address: restaurant?.address,
            imageUrl: restaurant?.photoUrl,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to add to wishlist');
        }
      } else {
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
      }
    } catch (error) {
      console.error('Error updating wishlist:', error);
      // Revert on error
      setIsLiked(!newWishlistState);
    } finally {
      setLoadingWishlist(false);
    }
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

  if (!restaurant) return null;

  const isFriendOrOwn = restaurant.source === 'friends' || restaurant.source === 'own';
  const priceSymbols = restaurant.priceLevel ? '₪'.repeat(restaurant.priceLevel) : '';

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
            {/* Header Row */}
            <div className="flex gap-3">
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
                    onClick={onClose}
                    className="p-1.5 -m-1 hover:bg-gray-100 rounded-full flex-shrink-0 transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                
                {/* Rating & Meta */}
                <div className="flex items-center gap-1.5 mt-1">
                  <CompactRating rating={restaurant.rating} />
                  <span className="text-xs text-gray-400">({restaurant.totalReviews})</span>
                  {priceSymbols && (
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md">{priceSymbols}</span>
                  )}
                </div>

                {/* Address */}
                <div className="flex items-center gap-1 mt-1.5">
                  <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <p className="text-xs text-gray-500 truncate">{restaurant.address}</p>
                </div>
              </div>
            </div>

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
                  isLiked ? 'bg-red-50' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {loadingWishlist ? (
                  <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
                ) : (
                  <Heart className={`w-5 h-5 transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
                )}
              </button>
              <button className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-2xl hover:bg-gray-200 transition-colors active:scale-95">
                <Globe className="w-5 h-5 text-gray-600" />
              </button>
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
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <CompactRating rating={place.rating} />
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
    </>
  );
}

