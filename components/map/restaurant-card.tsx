'use client';

import { useState, useEffect } from 'react';
import { X, MapPin, Star, Heart, Navigation, Phone, Globe, ChevronRight } from 'lucide-react';
import { Restaurant } from './mapbox';

interface RestaurantCardProps {
  restaurant: Restaurant | null;
  onClose: () => void;
  userLocation?: { lat: number; lng: number } | null;
}

export function RestaurantCard({ restaurant, onClose, userLocation }: RestaurantCardProps) {
  const [similarPlaces, setSimilarPlaces] = useState<Restaurant[]>([]);
  const [isLiked, setIsLiked] = useState(false);

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
    if (cuisines.some(c => c.includes('coffee') || c.includes('cafe')) || name.includes('cafe')) return '☕';
    if (cuisines.some(c => c.includes('pizza') || c.includes('italian'))) return '🍕';
    if (cuisines.some(c => c.includes('sushi') || c.includes('japanese'))) return '🍣';
    if (cuisines.some(c => c.includes('chinese') || c.includes('asian'))) return '🥡';
    if (cuisines.some(c => c.includes('burger'))) return '🍔';
    if (cuisines.some(c => c.includes('mexican'))) return '🌮';
    if (cuisines.some(c => c.includes('bakery'))) return '🧁';
    if (cuisines.some(c => c.includes('bar'))) return '🍺';
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
      <div className="fixed bottom-[72px] left-3 right-3 z-50 animate-slide-up">
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
                  <div className="flex items-center gap-0.5 bg-yellow-50 px-1.5 py-0.5 rounded-md">
                    <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                    <span className="font-bold text-xs text-yellow-700">{restaurant.rating.toFixed(1)}</span>
                  </div>
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
              <button className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-2xl hover:bg-gray-200 transition-colors active:scale-95">
                <Phone className="w-5 h-5 text-gray-600" />
              </button>
              <button 
                onClick={() => setIsLiked(!isLiked)}
                className={`flex items-center justify-center w-12 h-12 rounded-2xl transition-all active:scale-95 ${
                  isLiked ? 'bg-red-50' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <Heart className={`w-5 h-5 transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
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
                      <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                      <span className="text-[10px] font-medium text-gray-600">{place.rating.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

