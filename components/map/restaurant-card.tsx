'use client';

import { X, MapPin, Star, Heart, Navigation, ExternalLink } from 'lucide-react';
import { Restaurant } from './mapbox';

interface RestaurantCardProps {
  restaurant: Restaurant | null;
  onClose: () => void;
}

export function RestaurantCard({ restaurant, onClose }: RestaurantCardProps) {
  if (!restaurant) return null;

  const isFriendOrOwn = restaurant.source === 'friends' || restaurant.source === 'own';
  
  const priceSymbols = restaurant.priceLevel 
    ? '₪'.repeat(restaurant.priceLevel) 
    : '';

  // Get icon based on cuisine
  const getIcon = () => {
    const cuisines = restaurant.cuisineTypes || [];
    const name = restaurant.name.toLowerCase();
    
    if (cuisines.some(c => c.includes('coffee') || c.includes('cafe')) || name.includes('cafe')) return '☕';
    if (cuisines.some(c => c.includes('pizza') || c.includes('italian'))) return '🍕';
    if (cuisines.some(c => c.includes('sushi') || c.includes('japanese'))) return '🍣';
    if (cuisines.some(c => c.includes('chinese') || c.includes('asian'))) return '🥡';
    if (cuisines.some(c => c.includes('burger'))) return '🍔';
    if (cuisines.some(c => c.includes('mexican'))) return '🌮';
    if (cuisines.some(c => c.includes('bakery'))) return '🧁';
    return '🍽️';
  };

  return (
    <>
      {/* Backdrop - transparent, just for closing */}
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      {/* Compact Card */}
      <div className="fixed bottom-28 left-4 right-4 z-50 animate-slide-up">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div className="flex">
            {/* Image */}
            <div className="w-28 h-28 flex-shrink-0 relative bg-gray-100">
              {restaurant.photoUrl ? (
                <img 
                  src={restaurant.photoUrl} 
                  alt={restaurant.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-gray-50 to-gray-100">
                  {getIcon()}
                </div>
              )}
              {/* Source Badge */}
              {isFriendOrOwn && (
                <div className="absolute top-2 left-2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {restaurant.source === 'own' ? '⭐ YOU' : '👥 FRIEND'}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
              {/* Header */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-gray-900 truncate text-base leading-tight">
                    {restaurant.name}
                  </h3>
                  <button
                    onClick={onClose}
                    className="p-1 -m-1 hover:bg-gray-100 rounded-full flex-shrink-0"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                
                {/* Rating & Price Row */}
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-0.5">
                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold text-sm text-gray-900">{restaurant.rating.toFixed(1)}</span>
                  </div>
                  <span className="text-gray-300">•</span>
                  <span className="text-xs text-gray-500">
                    {restaurant.totalReviews} reviews
                  </span>
                  {priceSymbols && (
                    <>
                      <span className="text-gray-300">•</span>
                      <span className="text-xs font-medium text-gray-600">{priceSymbols}</span>
                    </>
                  )}
                </div>

                {/* Address */}
                <div className="flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <p className="text-xs text-gray-500 truncate">{restaurant.address}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-2">
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors">
                  <Navigation className="w-3.5 h-3.5" />
                  Directions
                </button>
                <button className="flex items-center justify-center w-10 h-10 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  <Heart className="w-4 h-4 text-gray-600" />
                </button>
                <button className="flex items-center justify-center w-10 h-10 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  <ExternalLink className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

