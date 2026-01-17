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
  AGENT: '/agent',
  WISHLIST: '/wishlist',
  SEARCH: '/search',
  NOTIFICATIONS: '/notifications',
  SETTINGS: '/settings',
  ONBOARDING: '/onboarding',
  
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
  FEED_REVIEWS: '/api/feed/reviews',
  
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
  PROFILE_ME: '/api/profile/me',
  
  // Users
  USERS_SEARCH: '/api/users/search',
  USERS_FOLLOW: '/api/users/follow',
  
  // Agent (Pachu AI)
  AGENT_CHAT: '/api/agent/chat',
  AGENT_RECOMMEND: '/api/agent/recommend',
  
  // Wishlist
  WISHLIST: '/api/wishlist',
  
  // Collections
  COLLECTIONS: '/api/collections',
  
  // Notifications
  NOTIFICATIONS: '/api/notifications',
} as const;

// Navigation Items (matches BottomNav)
export const NAV_ITEMS = [
  { href: ROUTES.FEED, label: 'Home', icon: 'Home' },
  { href: ROUTES.SEARCH, label: 'Search', icon: 'Plus' },
  { href: ROUTES.AGENT, label: 'Pachu', icon: 'MagicWand' },
  { href: ROUTES.MAP, label: 'Map', icon: 'MapPin' },
  { href: ROUTES.PROFILE, label: 'Profile', icon: 'User' },
] as const;
