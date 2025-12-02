'use client';

import { X, MapPin, Star, DollarSign } from 'lucide-react';
import { Restaurant } from './mapbox';

interface RestaurantCardProps {
  restaurant: Restaurant | null;
  onClose: () => void;
}

export function RestaurantCard({ restaurant, onClose }: RestaurantCardProps) {
  if (!restaurant) return null;

  const sourceLabel = {
    own: 'Your Review',
    friends: "Friends' Reviews",
    google: 'Google Reviews'
  };

  const sourceColor = {
    own: 'bg-primary text-white',
    friends: 'bg-primary text-white',
    google: 'bg-secondary text-white'
  };

  const priceSymbols = restaurant.priceLevel 
    ? '₪'.repeat(restaurant.priceLevel) 
    : '';

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Card */}
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 max-h-[70vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">{restaurant.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-1 rounded-full ${sourceColor[restaurant.source]}`}>
                {sourceLabel[restaurant.source]}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Photo */}
        {restaurant.photoUrl && (
          <div className="w-full h-48 bg-gray-200">
            <img 
              src={restaurant.photoUrl} 
              alt={restaurant.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Rating */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              <span className="font-semibold text-lg">{restaurant.rating.toFixed(1)}</span>
            </div>
            <span className="text-gray-500">
              ({restaurant.totalReviews} {restaurant.totalReviews === 1 ? 'review' : 'reviews'})
            </span>
            {priceSymbols && (
              <div className="flex items-center gap-1 text-gray-700">
                <DollarSign className="w-4 h-4" />
                <span className="font-medium">{priceSymbols}</span>
              </div>
            )}
          </div>

          {/* Address */}
          <div className="flex items-start gap-2">
            <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <p className="text-gray-700">{restaurant.address}</p>
          </div>

          {/* Cuisine Types */}
          {restaurant.cuisineTypes && restaurant.cuisineTypes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {restaurant.cuisineTypes.slice(0, 3).map((cuisine, index) => (
                <span 
                  key={index}
                  className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-full capitalize"
                >
                  {cuisine.replace('_', ' ')}
                </span>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button className="flex-1 py-3 px-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors">
              Add to Wishlist
            </button>
            <button className="flex-1 py-3 px-4 border-2 border-primary text-primary rounded-xl font-semibold hover:bg-primary/5 transition-colors">
              Write Review
            </button>
          </div>

          {/* Info Message */}
          {restaurant.source === 'google' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-medium">📍 From Google Reviews</p>
              <p className="text-xs mt-1">Be the first of your friends to review this place!</p>
            </div>
          )}
          
          {restaurant.source === 'friends' && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-800">
              <p className="font-medium">👥 Your friends love this place!</p>
              <p className="text-xs mt-1">See what they're saying about it.</p>
            </div>
          )}

          {restaurant.source === 'own' && (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-sm" style={{ color: 'rgb(197, 69, 156)' }}>
              <p className="font-medium">⭐ You reviewed this place</p>
              <p className="text-xs mt-1">Edit your review or add more photos.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

