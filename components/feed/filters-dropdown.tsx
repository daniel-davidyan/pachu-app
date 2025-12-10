'use client';

import { useState } from 'react';
import { MapPin, ChevronDown, X, SlidersHorizontal } from 'lucide-react';
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
          <div className="fixed inset-0 z-[9999] bg-white animate-fade-in flex flex-col w-screen h-screen">
            {/* Header */}
            <div className="flex-shrink-0 px-4 py-4 border-b border-gray-100 bg-white" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Filters</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors active:scale-95"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-safe" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <div className="px-4 py-4 space-y-6">
                {/* City Filter */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">City</h3>
                  <CitySelector selectedCity={selectedCity} onSelectCity={onSelectCity} />
                </div>

                {/* Distance Filter */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Distance</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => setLocationFilterEnabled(false)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                        !locationFilterEnabled
                          ? 'bg-primary/10 border-2 border-primary'
                          : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                      }`}
                    >
                      <span className={`text-sm font-medium ${
                        !locationFilterEnabled ? 'text-primary' : 'text-gray-900'
                      }`}>
                        No distance limit
                      </span>
                      {!locationFilterEnabled && (
                        <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
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
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                          locationFilterEnabled && distanceKm === km
                            ? 'bg-primary/10 border-2 border-primary'
                            : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                        }`}
                      >
                        <span className={`text-sm font-medium ${
                          locationFilterEnabled && distanceKm === km ? 'text-primary' : 'text-gray-900'
                        }`}>
                          Within {km} km
                        </span>
                        {locationFilterEnabled && distanceKm === km && (
                          <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
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
                    className="w-full py-3 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            </div>

            {/* Apply Button */}
            <div className="flex-shrink-0 px-4 py-4 border-t border-gray-100 bg-white">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-3.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all active:scale-[0.98] shadow-lg shadow-primary/25"
              >
                Apply Filters
              </button>
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

