/**
 * Username validation utilities - Instagram/TikTok style rules
 * 
 * Rules:
 * - Only lowercase letters (a-z), numbers (0-9), underscores (_), and periods (.)
 * - No spaces allowed
 * - Length: 3-30 characters
 * - No consecutive periods (..)
 * - Cannot start or end with period
 * - Must be unique (case-insensitive) - checked via API
 */

export interface UsernameValidationResult {
  isValid: boolean;
  error?: string;
  sanitized?: string;
}

// Reserved usernames that cannot be used
const RESERVED_USERNAMES = [
  'admin',
  'administrator',
  'root',
  'support',
  'help',
  'pachu',
  'official',
  'moderator',
  'mod',
  'staff',
  'team',
  'system',
  'api',
  'www',
  'mail',
  'email',
  'test',
  'null',
  'undefined',
  'settings',
  'profile',
  'feed',
  'notifications',
  'search',
  'explore',
  'map',
  'restaurant',
  'review',
  'wishlist',
  'agent',
  'auth',
  'login',
  'signup',
  'logout',
  'onboarding',
  'privacy',
  'terms',
];

/**
 * Validates a username according to Instagram/TikTok style rules
 */
export function validateUsername(username: string): UsernameValidationResult {
  // Trim whitespace
  const trimmed = username.trim();
  
  // Check if empty
  if (!trimmed) {
    return { isValid: false, error: 'Username is required' };
  }
  
  // Check length
  if (trimmed.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters' };
  }
  
  if (trimmed.length > 30) {
    return { isValid: false, error: 'Username must be 30 characters or less' };
  }
  
  // Check for spaces
  if (/\s/.test(trimmed)) {
    return { isValid: false, error: 'Username cannot contain spaces' };
  }
  
  // Convert to lowercase for validation
  const lowercased = trimmed.toLowerCase();
  
  // Check for valid characters only (a-z, 0-9, _, .)
  if (!/^[a-z0-9_.]+$/.test(lowercased)) {
    return { 
      isValid: false, 
      error: 'Username can only contain letters, numbers, underscores, and periods' 
    };
  }
  
  // Check for consecutive periods
  if (/\.{2,}/.test(lowercased)) {
    return { isValid: false, error: 'Username cannot contain consecutive periods' };
  }
  
  // Check if starts with period
  if (lowercased.startsWith('.')) {
    return { isValid: false, error: 'Username cannot start with a period' };
  }
  
  // Check if ends with period
  if (lowercased.endsWith('.')) {
    return { isValid: false, error: 'Username cannot end with a period' };
  }
  
  // Check reserved usernames
  if (RESERVED_USERNAMES.includes(lowercased)) {
    return { isValid: false, error: 'This username is not available' };
  }
  
  return { isValid: true, sanitized: lowercased };
}

/**
 * Sanitizes a username by:
 * - Converting to lowercase
 * - Removing invalid characters
 * - Replacing spaces with underscores
 * - Removing consecutive periods
 * - Trimming periods from start/end
 */
export function sanitizeUsername(username: string): string {
  let sanitized = username
    .toLowerCase()
    .trim()
    // Replace spaces with underscores
    .replace(/\s+/g, '_')
    // Remove invalid characters (keep only a-z, 0-9, _, .)
    .replace(/[^a-z0-9_.]/g, '')
    // Replace consecutive periods with single period
    .replace(/\.{2,}/g, '.')
    // Remove leading periods
    .replace(/^\.+/, '')
    // Remove trailing periods
    .replace(/\.+$/, '');
  
  // Ensure minimum length (pad with underscores if too short after sanitization)
  if (sanitized.length < 3 && sanitized.length > 0) {
    sanitized = sanitized.padEnd(3, '_');
  }
  
  // Truncate if too long
  if (sanitized.length > 30) {
    sanitized = sanitized.substring(0, 30);
    // Remove trailing period if truncation created one
    sanitized = sanitized.replace(/\.+$/, '');
  }
  
  return sanitized;
}

/**
 * Formats validation error for display
 */
export function getValidationHint(username: string): string | null {
  const result = validateUsername(username);
  return result.error || null;
}
