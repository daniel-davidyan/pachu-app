/**
 * Application Routes
 */

// Public Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/auth/login',
  SIGNUP: '/auth/signup',
  FORGOT_PASSWORD: '/auth/forgot-password',
  
  // Main App Routes
  FEED: '/feed',
  MAP: '/map',
  CHAT: '/chat',
  WISHLIST: '/wishlist',
  SEARCH: '/search',
  NOTIFICATIONS: '/notifications',
  SETTINGS: '/settings',
  
  // Profile Routes
  PROFILE: '/profile',
  PROFILE_EDIT: '/profile/edit',
  PROFILE_VIEW: (id: string) => `/profile/${id}`,
  
  // Restaurant Routes
  RESTAURANT: (id: string) => `/restaurant/${id}`,
  
  // Review Routes
  REVIEW: (id: string) => `/review/${id}`,
} as const;

// API Routes
export const API_ROUTES = {
  // Feed
  FEED_FOLLOWING: '/api/feed/following',
  FEED_NEARBY: '/api/feed/nearby',
  
  // Restaurants
  RESTAURANTS_SEARCH: '/api/restaurants/search',
  RESTAURANTS_NEARBY: '/api/restaurants/nearby',
  RESTAURANTS_DETAILS: '/api/restaurants/details',
  RESTAURANT_BY_ID: (id: string) => `/api/restaurants/${id}`,
  RESTAURANT_FRIENDS_REVIEWS: '/api/restaurants/friends-reviews',
  
  // Reviews
  REVIEWS: '/api/reviews',
  REVIEW_BY_ID: (id: string) => `/api/review/${id}`,
  REVIEW_LIKE: '/api/reviews/like',
  
  // Profile
  PROFILE_BY_ID: (id: string) => `/api/profile/${id}`,
  
  // Users
  USERS_SEARCH: '/api/users/search',
  
  // Chat
  CHAT: '/api/chat',
  MAP_CHAT: '/api/map-chat',
} as const;

// Navigation Items
export const NAV_ITEMS = [
  { href: ROUTES.FEED, label: 'Feed', icon: 'Home' },
  { href: ROUTES.MAP, label: 'Map', icon: 'Map' },
  { href: ROUTES.CHAT, label: 'Chat', icon: 'MessageCircle' },
  { href: ROUTES.WISHLIST, label: 'Wishlist', icon: 'Heart' },
  { href: ROUTES.PROFILE, label: 'Profile', icon: 'User' },
] as const;

