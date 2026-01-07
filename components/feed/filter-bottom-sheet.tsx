'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, ChevronDown, Search, Loader2, X } from 'lucide-react';

interface City {
  id: string;
  name: string;
  country?: string;
  latitude: number;
  longitude: number;
  distance?: number;
}

interface FilterBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCity: City | null;
  onSelectCity: (city: City | null) => void;
  distanceKm: number;
  onDistanceChange: (distance: number) => void;
}

export function FilterBottomSheet({
  isOpen,
  onClose,
  selectedCity,
  onSelectCity,
  distanceKm,
  onDistanceChange,
}: FilterBottomSheetProps) {
  const [showCitySelector, setShowCitySelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<City[]>([]);
  const [nearbyCities, setNearbyCities] = useState<City[]>([]);
  const [searching, setSearching] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Distance presets
  const distancePresets = [1, 2, 5, 10, 25];

  // Get user location
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setUserLocation({ latitude: 32.0853, longitude: 34.7818 });
      }
    );
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY) * -1);
      }
      setShowCitySelector(false);
      setSearchQuery('');
    }
    
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Search cities
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const searchCities = async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `/api/cities/search?query=${encodeURIComponent(searchQuery)}`
        );
        const data = await response.json();
        setSearchResults(data.cities || []);
      } catch (error) {
        console.error('City search error:', error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    };

    const timeoutId = setTimeout(searchCities, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Fetch nearby cities
  useEffect(() => {
    if (!userLocation || !showCitySelector) return;

    const fetchNearbyCities = async () => {
      try {
        const response = await fetch(
          `/api/cities/nearby?latitude=${userLocation.latitude}&longitude=${userLocation.longitude}`
        );
        const data = await response.json();
        setNearbyCities(data.cities || []);
      } catch (error) {
        console.error('Error fetching nearby cities:', error);
      }
    };

    fetchNearbyCities();
  }, [userLocation, showCitySelector]);

  // Focus search input when city selector opens
  useEffect(() => {
    if (showCitySelector) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [showCitySelector]);

  // Drag handlers - using refs to track state for non-passive event listener
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    isDraggingRef.current = true;
    startYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
    setIsDragging(true);
    setStartY(e.touches[0].clientY);
    setCurrentY(e.touches[0].clientY);
  };

  // Use effect to add non-passive touchmove listener
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || !isOpen) return;

    const handleTouchMoveNative = (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      const content = contentRef.current;
      const newY = e.touches[0].clientY;
      const deltaY = newY - startYRef.current;
      
      // For top sheet, close on swipe up (negative deltaY)
      if (content && content.scrollTop === 0 && deltaY < 0) {
        e.preventDefault();
        currentYRef.current = newY;
        setCurrentY(newY);
      } else if (content && content.scrollTop > 0) {
        isDraggingRef.current = false;
        setIsDragging(false);
      }
    };

    sheet.addEventListener('touchmove', handleTouchMoveNative, { passive: false });
    return () => {
      sheet.removeEventListener('touchmove', handleTouchMoveNative);
    };
  }, [isOpen]);

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    
    const deltaY = currentYRef.current - startYRef.current;
    // Close on swipe up (negative deltaY)
    if (deltaY < -100) {
      onClose();
    }
    setCurrentY(0);
    setStartY(0);
  };

  const formatDistance = (distance?: number) => {
    if (!distance) return '';
    if (distance < 1) return `${Math.round(distance * 1000)}m`;
    return `${distance.toFixed(1)}km`;
  };

  if (!isOpen) return null;

  const dragOffset = isDragging && currentY < startY ? currentY - startY : 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[100] transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Top Sheet - doesn't hide bottom nav */}
      <div
        ref={sheetRef}
        className="fixed top-0 left-0 right-0 bg-black/95 backdrop-blur-xl rounded-b-[28px] z-[101] flex flex-col border-b border-white/10 animate-slide-down"
        style={{
          height: 'calc(80vh - 70px)', // Leave room for bottom nav
          maxHeight: 'calc(80vh - 70px)',
          paddingTop: 'env(safe-area-inset-top)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="w-full py-4 px-4 flex items-center justify-between flex-shrink-0 border-b border-white/10">
          <h3 className="text-lg font-bold text-white">
            {showCitySelector ? 'Select City' : 'Filters'}
          </h3>
          <button
            onClick={showCitySelector ? () => setShowCitySelector(false) : onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>
        </div>

        {/* Content */}
        <div 
          ref={contentRef}
          className="flex-1 overflow-y-auto px-5 pb-8"
          style={{ 
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 'max(2rem, env(safe-area-inset-bottom))'
          }}
        >
          {!showCitySelector ? (
            /* Main Filters View */
            <div className="space-y-6">
              {/* City Selection */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                  Location
                </label>
                <button
                  onClick={() => setShowCitySelector(true)}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-white text-sm font-medium">
                      {selectedCity ? selectedCity.name : 'All Cities'}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-white/40" />
                </button>
              </div>

              {/* Distance Selection */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                  Distance
                </label>
                <div className="flex items-center justify-center mb-4">
                  <span className="text-4xl font-bold text-white">{distanceKm}</span>
                  <span className="text-base font-medium text-white/50 ml-1.5">km</span>
                </div>
                
                {/* Distance Slider */}
                <div className="relative px-1">
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={distanceKm}
                    onChange={(e) => onDistanceChange(parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #C5459C 0%, #C5459C ${((distanceKm - 1) / 49) * 100}%, rgba(255,255,255,0.1) ${((distanceKm - 1) / 49) * 100}%, rgba(255,255,255,0.1) 100%)`
                    }}
                  />
                </div>
                
                {/* Preset Buttons */}
                <div className="flex flex-wrap gap-1.5 mt-4 justify-center">
                  {distancePresets.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => onDistanceChange(preset)}
                      className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all ${
                        distanceKm === preset
                          ? 'bg-primary text-white'
                          : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      {preset} km
                    </button>
                  ))}
                </div>
              </div>

              {/* Apply Button */}
              <button
                onClick={onClose}
                className="w-full py-3.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98] mt-2"
              >
                Apply Filters
              </button>
            </div>
          ) : (
            /* City Selector View */
            <div className="space-y-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search for a city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-9 pr-9 bg-white/5 rounded-xl border border-white/10 focus:border-primary focus:bg-white/10 focus:outline-none text-sm text-white placeholder-white/40 transition-all"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
                )}
              </div>

              {/* All Cities Option */}
              {!searchQuery && (
                <button
                  onClick={() => {
                    onSelectCity(null);
                    setShowCitySelector(false);
                  }}
                  className={`w-full flex items-center gap-2.5 p-3 rounded-xl transition-all ${
                    !selectedCity
                      ? 'bg-primary/20 border border-primary'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    !selectedCity ? 'bg-primary/30' : 'bg-white/10'
                  }`}>
                    <MapPin className={`w-4 h-4 ${!selectedCity ? 'text-primary' : 'text-white/50'}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-semibold ${!selectedCity ? 'text-primary' : 'text-white'}`}>
                      All Cities
                    </p>
                    <p className="text-[10px] text-white/50">Show restaurants from everywhere</p>
                  </div>
                  {!selectedCity && (
                    <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              )}

              {/* Search Results */}
              {searchQuery && (
                <div>
                  <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">
                    Search Results
                  </h4>
                  {searching ? (
                    <div className="text-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-1.5">
                      {searchResults.map((city) => (
                        <CityItem
                          key={city.id}
                          city={city}
                          isSelected={selectedCity?.id === city.id}
                          onSelect={() => {
                            onSelectCity(city);
                            setShowCitySelector(false);
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-white/50 text-sm py-6">No cities found</p>
                  )}
                </div>
              )}

              {/* Nearby Cities */}
              {!searchQuery && nearbyCities.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Navigation className="w-2.5 h-2.5 text-primary" />
                    Nearby
                  </h4>
                  <div className="space-y-1.5">
                    {nearbyCities.slice(0, 5).map((city) => (
                      <CityItem
                        key={city.id}
                        city={city}
                        isSelected={selectedCity?.id === city.id}
                        subtitle={formatDistance(city.distance)}
                        onSelect={() => {
                          onSelectCity(city);
                          setShowCitySelector(false);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom drag indicator */}
        <div className="py-3 flex justify-center flex-shrink-0">
          <div className="w-10 h-1 bg-white/30 rounded-full" />
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-down {
          from {
            transform: translateY(-100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
      `}</style>
    </>
  );
}

// City Item Component
function CityItem({
  city,
  isSelected,
  subtitle,
  onSelect,
}: {
  city: City;
  isSelected: boolean;
  subtitle?: string;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-2.5 p-3 rounded-xl transition-all ${
        isSelected
          ? 'bg-primary/20 border border-primary'
          : 'bg-white/5 border border-white/10 hover:bg-white/10'
      }`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
        isSelected ? 'bg-primary/30' : 'bg-white/10'
      }`}>
        <MapPin className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-white/50'}`} />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-white'}`}>
          {city.name}
        </p>
        {(subtitle || city.country) && (
          <p className="text-[10px] text-white/50 truncate">{subtitle || city.country}</p>
        )}
      </div>
      {isSelected && (
        <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
}
