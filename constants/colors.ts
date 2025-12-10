/**
 * Color Constants
 * 
 * Primary color system for the application.
 * All colors derived from the main brand color: rgb(197, 69, 156)
 */

export const PRIMARY_COLOR = 'rgb(197, 69, 156)';
export const PRIMARY_HEX = '#C5459C';

// Theme colors
export const COLORS = {
  primary: PRIMARY_HEX,
  secondary: '#459CC5', // Complementary blue
  
  // Status colors
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  
  // Neutral colors
  background: '#FFFFFF',
  foreground: '#0A0A0A',
  muted: '#F5F5F5',
  border: '#E5E5E5',
} as const;

// Rating colors
export const RATING_COLORS = {
  5: '#10B981', // Excellent - Green
  4: '#84CC16', // Good - Light Green
  3: '#F59E0B', // Average - Orange
  2: '#F97316', // Below Average - Deep Orange
  1: '#EF4444', // Poor - Red
} as const;

// Price level colors
export const PRICE_LEVEL_COLORS = {
  1: '#10B981', // $ - Green (affordable)
  2: '#F59E0B', // $$ - Orange
  3: '#F97316', // $$$ - Deep Orange
  4: '#EF4444', // $$$$ - Red (expensive)
} as const;

