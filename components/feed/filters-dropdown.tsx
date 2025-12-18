'use client';

import { useState, useEffect } from 'react';
import { MapPin, ChevronDown, ChevronLeft, SlidersHorizontal } from 'lucide-react';
import { CitySelector } from './city-selector';

interface City {
  id: string;
  name: string;
  country?: string;
  latitude: number;
  longitude: number;
}

interface FiltersDropdownProps {
  selectedCity: City | null;
  onSelectCity: (city: City | null) => void;
  locationFilterEnabled: boolean;
  setLocationFilterEnabled: (enabled: boolean) => void;
  distanceKm: number;
  setDistanceKm: (km: number) => void;
}

export function FiltersDropdown({
  selectedCity,
  onSelectCity,
  locationFilterEnabled,
  setLocationFilterEnabled,
  distanceKm,
  setDistanceKm,
}: FiltersDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Hide bottom nav and prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.classList.add('filters-modal-open');
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      const scrollY = document.body.style.top;
      document.body.classList.remove('filters-modal-open');
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    
    return () => {
      document.body.classList.remove('filters-modal-open');
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const getDisplayText = () => {
    if (selectedCity) {
      return selectedCity.name;
    }
    return 'Nearby';
  };

  const activeFiltersCount = () => {
    let count = 0;
    if (selectedCity) count++;
    if (!locationFilterEnabled || distanceKm !== 5) count++;
    return count;
  };

  return (
    <>
      {/* Nearby Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 transition-all hover:opacity-70 active:scale-95"
      >
        <MapPin className="w-4 h-4 text-gray-600" strokeWidth={2.5} />
        <span className="text-sm font-medium text-gray-900">
          {getDisplayText()}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-600" strokeWidth={2.5} />
      </button>

      {/* Full Screen Modal */}
      {isOpen && (
        <>
          {/* Full Screen Overlay */}
          <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-gray-50 to-white animate-fade-in flex flex-col w-screen" style={{ height: '100dvh', overscrollBehavior: 'contain' }}>
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-5 border-b border-gray-100/50 bg-white/80 backdrop-blur-xl" style={{ paddingTop: 'max(1.25rem, calc(1.25rem + env(safe-area-inset-top)))' }}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100/80 transition-all duration-200 active:scale-95"
                >
                  <ChevronLeft className="w-6 h-6 text-gray-900" strokeWidth={2} />
                </button>
                <h2 className="text-2xl font-semibold text-gray-900">Filters</h2>
              </div>
            </div>

            {/* Content (scrollable) */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-6 pt-6 pb-32 space-y-8">
                {/* City Filter */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-4">City</h3>
                  <CitySelector selectedCity={selectedCity} onSelectCity={onSelectCity} />
                </div>

                {/* Distance Filter */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-4">Distance</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => setLocationFilterEnabled(false)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all duration-200 ${
                        !locationFilterEnabled
                          ? 'bg-primary/10 border-2 border-primary'
                          : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                      }`}
                    >
                      <span className={`text-xs font-semibold ${
                        !locationFilterEnabled ? 'text-primary' : 'text-gray-900'
                      }`}>
                        No distance limit
                      </span>
                      {!locationFilterEnabled && (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#C5459C' }}>
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>

                    {[1, 3, 5, 10].map((km) => (
                      <button
                        key={km}
                        onClick={() => {
                          setLocationFilterEnabled(true);
                          setDistanceKm(km);
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all duration-200 ${
                          locationFilterEnabled && distanceKm === km
                            ? 'bg-primary/10 border-2 border-primary'
                            : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                        }`}
                      >
                        <span className={`text-xs font-semibold ${
                          locationFilterEnabled && distanceKm === km ? 'text-primary' : 'text-gray-900'
                        }`}>
                          Within {km} km
                        </span>
                        {locationFilterEnabled && distanceKm === km && (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#C5459C' }}>
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clear Filters */}
                {activeFiltersCount() > 0 && (
                  <button
                    onClick={() => {
                      onSelectCity(null);
                      setLocationFilterEnabled(true);
                      setDistanceKm(5);
                    }}
                    className="w-full py-3.5 rounded-2xl border border-gray-200 text-base font-normal text-gray-600 hover:bg-gray-50/50 hover:border-gray-300 transition-all duration-200"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
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
        body.filters-modal-open .bottom-nav-container {
          display: none !important;
        }
      `}</style>
    </>
  );
}
