/**
 * Component-specific Types and Props
 */

import { RestaurantFilters } from './api';

// Chat Component Types
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  suggestions?: string[];
  restaurants?: Array<{ id: string; name: string; }>;
}

export interface AIChatProps {
  onFilterChange?: (filters: RestaurantFilters) => void;
  onRestaurantsFound?: (restaurants: Array<{ id: string; name: string; }>) => void;
  matchedCount?: number;
  userLocation?: { lat: number; lng: number } | null;
}

// Map Component Types
export interface MapRestaurant {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  rating?: number;
  imageUrl?: string;
}

export interface MapMarker {
  id: string;
  longitude: number;
  latitude: number;
  restaurant: MapRestaurant;
}

// Review Component Types
export interface ReviewFormData {
  rating: number;
  title?: string;
  content: string;
  visitDate?: string;
  photos: File[];
}

// Navigation Types
export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

// Location Types
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationState {
  coordinates: Coordinates | null;
  loading: boolean;
  error: string | null;
}

// UI State Types
export interface ModalState {
  isOpen: boolean;
  data?: any;
}

export interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

