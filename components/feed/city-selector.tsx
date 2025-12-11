'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, X, Navigation, ChevronDown, Loader2 } from 'lucide-react';

interface City {
  id: string;
  name: string;
  country?: string;
  latitude: number;
  longitude: number;
  distance?: number;
}

interface CitySelectorProps {
  selectedCity: City | null;
  onSelectCity: (city: City | null) => void;
}

export function CitySelector({ selectedCity, onSelectCity }: CitySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<City[]>([]);
  const [nearbyCities, setNearbyCities] = useState<City[]>([]);
  const [popularCities, setPopularCities] = useState<City[]>([]);
  const [searching, setSearching] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
        // Default to Tel Aviv if location unavailable
        setUserLocation({ latitude: 32.0853, longitude: 34.7818 });
      }
    );
  }, []);

  // Focus search input when modal opens and prevent body scroll
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      // Prevent body scroll when modal is open (mobile-friendly)
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      // Restore body scroll when modal closes
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Search cities via Google Places API
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
    if (!userLocation || !isOpen) return;

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
  }, [userLocation, isOpen]);

  // Popular cities (A-Z)
  useEffect(() => {
    if (!isOpen) return;

    const fetchPopularCities = async () => {
      try {
        const response = await fetch('/api/cities/popular');
        const data = await response.json();
        setPopularCities(data.cities || []);
      } catch (error) {
        console.error('Error fetching popular cities:', error);
      }
    };

    fetchPopularCities();
  }, [isOpen]);

  const handleSelectCity = (city: City | null) => {
    onSelectCity(city);
    setIsOpen(false);
    setSearchQuery('');
  };

  const formatDistance = (distance?: number) => {
    if (!distance) return '';
    if (distance < 1) return `${Math.round(distance * 1000)}m away`;
    return `${distance.toFixed(1)}km away`;
  };

  // Group cities by first letter
  const groupedCities = popularCities.reduce((acc, city) => {
    const firstLetter = city.name.charAt(0).toUpperCase();
    if (!acc[firstLetter]) {
      acc[firstLetter] = [];
    }
    acc[firstLetter].push(city);
    return acc;
  }, {} as Record<string, City[]>);

  return (
    <>
      {/* City Dropdown Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 border-2 backdrop-blur-sm bg-white text-gray-700 border-gray-200 shadow-sm hover:shadow-md active:scale-[0.98]"
      >
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" strokeWidth={2.5} />
          <span className="text-gray-900">
            {selectedCity ? selectedCity.name : 'All Cities'}
          </span>
        </div>
        <ChevronDown className="w-4 h-4 text-gray-500" strokeWidth={2.5} />
      </button>

      {/* Full Screen Modal */}
      {isOpen && (
        <>
          {/* Full Screen Overlay */}
          <div className="fixed inset-0 z-[9999] bg-white animate-fade-in flex flex-col w-screen h-screen">
            {/* Header */}
            <div className="flex-shrink-0 px-4 pt-safe pb-3 border-b border-gray-100 bg-white" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-900">Select City</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors active:scale-95"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search for a city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-10 pr-10 bg-gray-50 rounded-xl border-2 border-gray-100 focus:border-primary focus:bg-white focus:outline-none text-sm text-gray-900 placeholder-gray-400 transition-all"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
                )}
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-safe" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                {/* All Cities Option */}
                {!searchQuery && (
                  <div className="px-4 py-2 border-b border-gray-100">
                    <button
                      onClick={() => handleSelectCity(null)}
                      className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-all ${
                        !selectedCity
                          ? 'bg-primary/10 border-2 border-primary'
                          : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        !selectedCity ? 'bg-primary/20' : 'bg-white'
                      }`}>
                        <MapPin className={`w-4 h-4 ${!selectedCity ? 'text-primary' : 'text-gray-400'}`} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className={`font-semibold text-xs ${
                          !selectedCity ? 'text-primary' : 'text-gray-900'
                        }`}>
                          All Cities
                        </p>
                        <p className="text-[10px] text-gray-500">Show restaurants from everywhere</p>
                      </div>
                      {!selectedCity && (
                        <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  </div>
                )}

                {/* Search Results */}
                {searchQuery && (
                  <div className="px-4 py-3">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Search Results
                    </h3>
                    {searching ? (
                      <div className="text-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Searching cities...</p>
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div className="space-y-1.5">
                        {searchResults.map((city) => (
                          <button
                            key={city.id}
                            onClick={() => handleSelectCity(city)}
                            className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-all ${
                              selectedCity?.id === city.id
                                ? 'bg-primary/10 border-2 border-primary'
                                : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              selectedCity?.id === city.id ? 'bg-primary/20' : 'bg-white'
                            }`}>
                              <MapPin className={`w-4 h-4 ${
                                selectedCity?.id === city.id ? 'text-primary' : 'text-gray-400'
                              }`} />
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <p className={`font-semibold text-xs ${
                                selectedCity?.id === city.id ? 'text-primary' : 'text-gray-900'
                              }`}>
                                {city.name}
                              </p>
                              {city.country && (
                                <p className="text-[10px] text-gray-500 truncate">{city.country}</p>
                              )}
                            </div>
                            {selectedCity?.id === city.id && (
                              <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Search className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500">No cities found</p>
                        <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Nearby Cities */}
                {!searchQuery && nearbyCities.length > 0 && (
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Navigation className="w-3 h-3 text-primary" />
                      Nearby Cities
                    </h3>
                    <div className="space-y-1.5">
                      {nearbyCities.slice(0, 5).map((city) => (
                        <button
                          key={city.id}
                          onClick={() => handleSelectCity(city)}
                          className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-all ${
                            selectedCity?.id === city.id
                              ? 'bg-primary/10 border-2 border-primary'
                              : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            selectedCity?.id === city.id ? 'bg-primary/20' : 'bg-white'
                          }`}>
                            <MapPin className={`w-4 h-4 ${
                              selectedCity?.id === city.id ? 'text-primary' : 'text-gray-400'
                            }`} />
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className={`font-semibold text-xs ${
                              selectedCity?.id === city.id ? 'text-primary' : 'text-gray-900'
                            }`}>
                              {city.name}
                            </p>
                            <p className="text-[10px] text-gray-500">{formatDistance(city.distance)}</p>
                          </div>
                          {selectedCity?.id === city.id && (
                            <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* All Cities A-Z */}
                {!searchQuery && Object.keys(groupedCities).length > 0 && (
                  <div className="px-4 py-3">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                      All Cities
                    </h3>
                    <div className="space-y-3">
                      {Object.keys(groupedCities)
                        .sort()
                        .map((letter) => (
                          <div key={letter}>
                            <div className="sticky top-0 bg-white py-1.5 mb-1.5 z-10">
                              <h4 className="text-base font-bold text-primary">{letter}</h4>
                            </div>
                            <div className="space-y-1.5">
                              {groupedCities[letter].map((city) => (
                                <button
                                  key={city.id}
                                  onClick={() => handleSelectCity(city)}
                                  className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-all ${
                                    selectedCity?.id === city.id
                                      ? 'bg-primary/10 border-2 border-primary'
                                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                                  }`}
                                >
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    selectedCity?.id === city.id ? 'bg-primary/20' : 'bg-white'
                                  }`}>
                                    <MapPin className={`w-4 h-4 ${
                                      selectedCity?.id === city.id ? 'text-primary' : 'text-gray-400'
                                    }`} />
                                  </div>
                                  <div className="flex-1 text-left min-w-0">
                                    <p className={`font-semibold text-xs ${
                                      selectedCity?.id === city.id ? 'text-primary' : 'text-gray-900'
                                    }`}>
                                      {city.name}
                                    </p>
                                    {city.country && (
                                      <p className="text-[10px] text-gray-500 truncate">{city.country}</p>
                                    )}
                                  </div>
                                  {selectedCity?.id === city.id && (
                                    <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </>
      )}

      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </>
  );
}

