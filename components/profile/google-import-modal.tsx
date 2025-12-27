'use client';

import { useState } from 'react';
import { X, Upload, FileText, Loader2, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface GoogleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface GoogleReview {
  placeId: string;
  placeName: string;
  placeAddress: string;
  rating: number;
  text: string;
  photos: string[];
  timestamp: number;
}

export function GoogleImportModal({ isOpen, onClose, onSuccess }: GoogleImportModalProps) {
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [parseError, setParseError] = useState('');
  const [importResults, setImportResults] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    setParseError('');
    setImportResults(null);

    // Check file type
    if (!file.name.endsWith('.json')) {
      setParseError('Please upload a valid JSON file');
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate JSON structure - expect Google Takeout format
      let reviews: GoogleReview[] = [];

      // Handle different possible Google Takeout formats
      if (data.type === 'FeatureCollection' && data.features) {
        // GeoJSON format (most common from newer Google Takeout)
        reviews = parseGeoJsonFormat(data);
      } else if (Array.isArray(data)) {
        // Direct array of reviews
        reviews = parseGoogleReviews(data);
      } else if (data.reviews && Array.isArray(data.reviews)) {
        // Wrapped in reviews object
        reviews = parseGoogleReviews(data.reviews);
      } else if (data.locations) {
        // Alternative format with locations
        reviews = parseLocationsFormat(data.locations);
      } else {
        setParseError('Unrecognized file format. Please ensure this is a Google Reviews export file.');
        return;
      }

      if (reviews.length === 0) {
        setParseError('No valid reviews found in the file');
        return;
      }

      // Import reviews
      await importReviews(reviews);
    } catch (error) {
      console.error('Error parsing file:', error);
      setParseError('Invalid JSON file or wrong format');
    }
  };

  const parseGoogleReviews = (data: any[]): GoogleReview[] => {
    const reviews: GoogleReview[] = [];

    for (const item of data) {
      try {
        // Google Takeout format varies, try to extract common fields
        const review: GoogleReview = {
          placeId: item.placeId || item.place_id || item.locationId || '',
          placeName: item.placeName || item.name || item.location?.name || 'Unknown Restaurant',
          placeAddress: item.address || item.location?.address || '',
          rating: parseInt(item.rating || item.starRating || '0'),
          text: item.comment || item.text || item.reviewText || '',
          photos: item.photos || item.images || [],
          timestamp: item.timestamp || item.publishedTime || Date.now(),
        };

        // Only include if we have essential data
        if (review.placeId && review.rating > 0) {
          reviews.push(review);
        }
      } catch (error) {
        console.error('Error parsing review item:', error);
      }
    }

    return reviews;
  };

  const parseGeoJsonFormat = (data: any): GoogleReview[] => {
    const reviews: GoogleReview[] = [];

    if (!data.features || !Array.isArray(data.features)) {
      return reviews;
    }

    for (const feature of data.features) {
      try {
        const props = feature.properties;
        if (!props) continue;

        // Extract place ID from Google Maps URL
        // URL format: https://www.google.com/maps/place//data=!4m2!3m1!1s0x0:0x35f6e7ed40d5e917
        let placeId = '';
        if (props.google_maps_url) {
          const match = props.google_maps_url.match(/1s0x[0-9a-fA-F]+:0x[0-9a-fA-F]+/);
          if (match) {
            // This is the hex format, we need to convert it or use Google's geocoding
            // For now, we'll use the coordinates to search
            placeId = match[0].replace('1s', '');
          }
        }

        // If no place ID from URL, we'll need to use coordinates or name
        const coords = feature.geometry?.coordinates;
        const location = props.location || {};

        const review: GoogleReview = {
          placeId: placeId || `${location.name}_${coords?.[0]}_${coords?.[1]}`, // Fallback to name+coords
          placeName: location.name || 'Unknown Restaurant',
          placeAddress: location.address || '',
          rating: parseInt(props.five_star_rating_published || props.rating || '0'),
          text: props.review_text_published || props.review_text || '',
          photos: props.photos || [],
          timestamp: props.date ? new Date(props.date).getTime() : Date.now(),
        };

        // Only include if we have essential data (name and rating)
        if (review.placeName && review.rating > 0) {
          reviews.push(review);
        }
      } catch (error) {
        console.error('Error parsing GeoJSON feature:', error);
      }
    }

    return reviews;
  };

  const parseLocationsFormat = (locations: any[]): GoogleReview[] => {
    const reviews: GoogleReview[] = [];

    for (const location of locations) {
      if (location.review) {
        const review: GoogleReview = {
          placeId: location.placeId || '',
          placeName: location.name || 'Unknown Restaurant',
          placeAddress: location.address || '',
          rating: parseInt(location.review.starRating || '0'),
          text: location.review.comment || '',
          photos: location.review.photos || [],
          timestamp: location.review.publishedTime || Date.now(),
        };

        if (review.placeId && review.rating > 0) {
          reviews.push(review);
        }
      }
    }

    return reviews;
  };

  const importReviews = async (reviews: GoogleReview[]) => {
    setImporting(true);

    try {
      const response = await fetch('/api/google-reviews/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviews }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to import reviews');
      }

      setImportResults({
        imported: data.imported,
        skipped: data.skipped,
        errors: data.errors || [],
      });

      if (data.imported > 0) {
        showToast(`Successfully imported ${data.imported} review(s)!`, 'success');
        onSuccess?.();
      } else {
        showToast('No new reviews were imported', 'info');
      }
    } catch (error: any) {
      console.error('Import error:', error);
      showToast(error.message || 'Failed to import reviews', 'error');
      setParseError(error.message || 'Failed to import reviews');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setParseError('');
    setImportResults(null);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="fixed inset-x-0 top-1/2 -translate-y-1/2 z-50 mx-4 max-w-lg sm:mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="relative bg-gradient-to-br from-primary via-primary/90 to-primary/80 px-6 py-8 text-white">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <svg className="w-9 h-9" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-1">Import from Google</h2>
                <p className="text-white/90 text-sm">Bring your Google Reviews into Pachu</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">
            {/* Results Display */}
            {importResults ? (
              <div className="space-y-4">
                {/* Success Summary */}
                <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-5 flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-green-900 text-lg mb-1">Import Complete!</h3>
                    <p className="text-sm text-green-700">
                      {importResults.imported} review{importResults.imported !== 1 ? 's' : ''} imported successfully
                      {importResults.skipped > 0 && `, ${importResults.skipped} skipped`}
                    </p>
                  </div>
                </div>

                {/* Errors (if any) */}
                {importResults.errors.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-5 h-5 text-orange-600" />
                      <h4 className="font-semibold text-orange-900 text-sm">Some issues occurred:</h4>
                    </div>
                    <ul className="text-xs text-orange-700 space-y-1 pl-7">
                      {importResults.errors.slice(0, 3).map((error, i) => (
                        <li key={i} className="list-disc">{error}</li>
                      ))}
                      {importResults.errors.length > 3 && (
                        <li className="italic">... and {importResults.errors.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-blue-800">
                    ℹ️ Your imported reviews are saved as <strong>unpublished</strong>. 
                    Go to your profile to review and publish them.
                  </p>
                </div>

                <button
                  onClick={handleClose}
                  className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                {/* Instructions */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-100 rounded-2xl p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">How to export from Google</h3>
                      <ol className="text-sm text-gray-700 space-y-1.5 list-decimal list-inside">
                        <li>Visit <a href="https://takeout.google.com" target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline">Google Takeout</a></li>
                        <li>Select only "Maps (your places)"</li>
                        <li>Choose JSON format</li>
                        <li>Download and upload here</li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* Upload Area */}
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`
                    relative border-3 border-dashed rounded-2xl p-8 transition-all cursor-pointer
                    ${dragActive 
                      ? 'border-primary bg-primary/5 scale-[1.02]' 
                      : 'border-gray-300 bg-gray-50 hover:border-primary hover:bg-primary/5'
                    }
                    ${importing ? 'pointer-events-none opacity-50' : ''}
                  `}
                >
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileInput}
                    disabled={importing}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />

                  <div className="flex flex-col items-center text-center">
                    {importing ? (
                      <>
                        <Loader2 className="w-12 h-12 text-primary animate-spin mb-3" />
                        <p className="text-base font-semibold text-gray-900 mb-1">
                          Importing your reviews...
                        </p>
                        <p className="text-sm text-gray-600">
                          This may take a moment
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                          <Upload className="w-8 h-8 text-primary" />
                        </div>
                        <p className="text-base font-semibold text-gray-900 mb-1">
                          Drop your JSON file here
                        </p>
                        <p className="text-sm text-gray-600 mb-3">
                          or click to browse
                        </p>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700">
                          <Download className="w-4 h-4" />
                          Choose File
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Error Message */}
                {parseError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-red-900 text-sm mb-1">Error</h4>
                      <p className="text-sm text-red-700">{parseError}</p>
                    </div>
                  </div>
                )}

                {/* Info Note */}
                <div className="text-xs text-gray-500 text-center space-y-1">
                  <p>🔒 Your data is processed securely and never shared</p>
                  <p>✨ Reviews will be imported as unpublished drafts</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

