/**
 * Application Constants
 */

export const APP_NAME = 'Pachu';
export const APP_TAGLINE = 'the taste signature';
export const APP_DESCRIPTION = 'A mobile-optimized social restaurant discovery platform';

export const THEME_COLOR = '#C5459C'; // Primary brand color

// Pagination
export const DEFAULT_PAGE_SIZE = 10;
export const FEED_PAGE_SIZE = 5;
export const REVIEWS_PAGE_SIZE = 20;

// Location
export const DEFAULT_LOCATION = {
  latitude: 32.0853, // Tel Aviv
  longitude: 34.7818,
};

export const DEFAULT_SEARCH_RADIUS = 5000; // meters (5km)
export const MAX_SEARCH_RADIUS = 50000; // meters (50km)

// Ratings
export const MIN_RATING = 1;
export const MAX_RATING = 5;

// Price Levels
export const MIN_PRICE_LEVEL = 1; // $
export const MAX_PRICE_LEVEL = 4; // $$$$

export const PRICE_LEVEL_LABELS = {
  1: '$',
  2: '$$',
  3: '$$$',
  4: '$$$$',
} as const;

// File Upload
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
export const MAX_REVIEW_PHOTOS = 10;

// Languages
export const SUPPORTED_LOCALES = ['en', 'he'] as const;
export const DEFAULT_LOCALE = 'en';

// Social
export const MAX_BIO_LENGTH = 160;
export const MAX_USERNAME_LENGTH = 30;
export const MAX_REVIEW_CONTENT_LENGTH = 2000;

// API Timeouts
export const API_TIMEOUT = 30000; // 30 seconds
export const CHAT_API_TIMEOUT = 60000; // 60 seconds

// Cache
export const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

