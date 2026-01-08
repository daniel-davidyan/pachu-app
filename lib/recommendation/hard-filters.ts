/**
 * Recommendation Pipeline V2 - Hard Filters
 * 
 * Filters restaurants by location and opening hours based on user preferences.
 * This is the first stage that reduces the search space significantly.
 */

import { createClient } from '@supabase/supabase-js';
import {
  ConversationContext,
  CachedRestaurant,
  UserLocation,
  OpeningHours,
  OpeningPeriod,
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const TEL_AVIV_CITIES = [
  'Tel Aviv',
  'Tel Aviv-Yafo',
  'Tel Aviv-Jaffa',
  'תל אביב',
  'תל אביב-יפו',
  'Jaffa',
  'יפו',
];

// ============================================================================
// OPENING HOURS HELPERS
// ============================================================================

/**
 * Parse time string (e.g., "1930" or "19:30") to minutes since midnight
 */
function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  
  // Handle "HHMM" format
  if (timeStr.length === 4 && !timeStr.includes(':')) {
    const hours = parseInt(timeStr.slice(0, 2), 10);
    const minutes = parseInt(timeStr.slice(2, 4), 10);
    return hours * 60 + minutes;
  }
  
  // Handle "HH:MM" format
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    return hours * 60 + minutes;
  }
  
  return 0;
}

/**
 * Check if restaurant is open at a specific day and time
 */
function isOpenAt(
  openingHours: OpeningHours | null,
  day: number,  // 0-6 (Sunday-Saturday)
  timeMinutes: number  // Minutes since midnight
): boolean {
  if (!openingHours) {
    // If no opening hours, assume open
    return true;
  }
  
  // Try periods first (more accurate)
  if (openingHours.periods && openingHours.periods.length > 0) {
    return isOpenAtFromPeriods(openingHours.periods, day, timeMinutes);
  }
  
  // Fallback to weekday_text parsing
  if (openingHours.weekday_text && openingHours.weekday_text.length > 0) {
    return isOpenAtFromWeekdayText(openingHours.weekday_text, day, timeMinutes);
  }
  
  // No data, assume open
  return true;
}

/**
 * Check opening from periods array
 */
function isOpenAtFromPeriods(
  periods: OpeningPeriod[],
  day: number,
  timeMinutes: number
): boolean {
  for (const period of periods) {
    // Check if this period applies to the requested day
    if (period.open.day !== day) continue;
    
    const openTime = parseTimeToMinutes(period.open.time);
    
    // If no close time, it means open 24 hours
    if (!period.close) {
      return true;
    }
    
    let closeTime = parseTimeToMinutes(period.close.time);
    
    // Handle overnight closing (e.g., open 18:00, close 02:00)
    if (period.close.day !== period.open.day) {
      // If we're checking on the opening day
      if (timeMinutes >= openTime) {
        return true;
      }
    } else {
      // Same day closing
      if (timeMinutes >= openTime && timeMinutes <= closeTime) {
        return true;
      }
    }
  }
  
  // Check if previous day's period extends into this day
  const previousDay = (day + 6) % 7;
  for (const period of periods) {
    if (period.open.day !== previousDay) continue;
    if (!period.close) continue;
    
    // Check if close time is on the next day
    if (period.close.day === day) {
      const closeTime = parseTimeToMinutes(period.close.time);
      if (timeMinutes <= closeTime) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Check opening from weekday_text array (less accurate but fallback)
 */
function isOpenAtFromWeekdayText(
  weekdayText: string[],
  day: number,
  timeMinutes: number
): boolean {
  // weekday_text is typically: ["Monday: 9:00 AM – 10:00 PM", ...]
  // Day mapping: Google uses Monday=0, but JS Date uses Sunday=0
  // So we need to convert: our day 0 (Sunday) = Google index 6
  const googleDayIndex = day === 0 ? 6 : day - 1;
  
  if (googleDayIndex >= weekdayText.length) {
    return true; // No data for this day
  }
  
  const dayText = weekdayText[googleDayIndex];
  
  // Check for "Closed"
  if (dayText.toLowerCase().includes('closed') || dayText.includes('סגור')) {
    return false;
  }
  
  // Check for "Open 24 hours"
  if (dayText.toLowerCase().includes('24 hours') || dayText.includes('24 שעות')) {
    return true;
  }
  
  // Try to parse time range (e.g., "9:00 AM – 10:00 PM")
  const timeMatch = dayText.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM|am|pm)?\s*[–-]\s*(\d{1,2}):?(\d{2})?\s*(AM|PM|am|pm)?/);
  
  if (!timeMatch) {
    // Can't parse, assume open
    return true;
  }
  
  let openHour = parseInt(timeMatch[1], 10);
  const openMinute = parseInt(timeMatch[2] || '0', 10);
  const openAmPm = timeMatch[3]?.toUpperCase();
  
  let closeHour = parseInt(timeMatch[4], 10);
  const closeMinute = parseInt(timeMatch[5] || '0', 10);
  const closeAmPm = timeMatch[6]?.toUpperCase();
  
  // Convert to 24-hour format
  if (openAmPm === 'PM' && openHour !== 12) openHour += 12;
  if (openAmPm === 'AM' && openHour === 12) openHour = 0;
  if (closeAmPm === 'PM' && closeHour !== 12) closeHour += 12;
  if (closeAmPm === 'AM' && closeHour === 12) closeHour = 0;
  
  const openMinutes = openHour * 60 + openMinute;
  let closeMinutes = closeHour * 60 + closeMinute;
  
  // Handle overnight
  if (closeMinutes < openMinutes) {
    closeMinutes += 24 * 60;
    if (timeMinutes < openMinutes) {
      return timeMinutes + 24 * 60 <= closeMinutes;
    }
  }
  
  return timeMinutes >= openMinutes && timeMinutes <= closeMinutes;
}

/**
 * Get time range for timing preference
 */
function getTimeRangeForTiming(timing: string, specificTime?: string): {
  startMinutes: number;
  endMinutes: number;
} {
  if (specificTime) {
    const minutes = parseTimeToMinutes(specificTime);
    return {
      startMinutes: minutes,
      endMinutes: minutes + 120, // 2 hour window
    };
  }
  
  switch (timing) {
    case 'now':
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      return {
        startMinutes: nowMinutes,
        endMinutes: nowMinutes + 60,
      };
    
    case 'tonight':
      return {
        startMinutes: 18 * 60,  // 6 PM
        endMinutes: 23 * 60,    // 11 PM
      };
    
    case 'tomorrow':
    case 'weekend':
      return {
        startMinutes: 12 * 60,  // Noon
        endMinutes: 23 * 60,    // 11 PM
      };
    
    default:
      // 'anytime' - don't filter by time
      return {
        startMinutes: 0,
        endMinutes: 24 * 60,
      };
  }
}

// ============================================================================
// DISTANCE CALCULATION
// ============================================================================

/**
 * Calculate distance between two points using Haversine formula
 */
export function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

// ============================================================================
// MAIN FILTER FUNCTION
// ============================================================================

export async function applyHardFilters(
  context: ConversationContext,
  userLocation: UserLocation,
  supabaseUrl: string,
  supabaseKey: string
): Promise<CachedRestaurant[]> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🔧 Applying hard filters:', {
    location: context.locationPreference,
    timing: context.timing,
    specificCity: context.specificCity,
  });
  
  // Build base query
  let query = supabase
    .from('restaurant_cache')
    .select('*');
  
  // =========================================================================
  // LOCATION FILTER
  // =========================================================================
  
  if (context.locationPreference === 'nearby' && context.maxDistanceMeters) {
    // Convert meters to approximate degrees (1 degree ≈ 111km at equator)
    const radiusDegrees = context.maxDistanceMeters / 111000;
    
    query = query
      .gte('latitude', userLocation.lat - radiusDegrees)
      .lte('latitude', userLocation.lat + radiusDegrees)
      .gte('longitude', userLocation.lng - radiusDegrees)
      .lte('longitude', userLocation.lng + radiusDegrees);
    
    console.log(`📍 Location filter: ${context.maxDistanceMeters}m radius around user`);
  } else if (context.locationPreference === 'tel_aviv') {
    // Filter to Tel Aviv area using city field
    query = query.or(TEL_AVIV_CITIES.map(c => `city.ilike.%${c}%`).join(','));
    console.log('📍 Location filter: Tel Aviv area');
  } else if (context.locationPreference === 'specific_city' && context.specificCity) {
    // Filter to specific city
    query = query.ilike('city', `%${context.specificCity}%`);
    console.log(`📍 Location filter: ${context.specificCity}`);
  } else {
    // 'anywhere' - no location filter
    console.log('📍 Location filter: None (anywhere)');
  }
  
  // Execute query
  const { data: restaurants, error } = await query;
  
  if (error) {
    console.error('Error fetching restaurants:', error);
    return [];
  }
  
  if (!restaurants || restaurants.length === 0) {
    console.log('⚠️ No restaurants found after location filter');
    return [];
  }
  
  console.log(`📊 After location filter: ${restaurants.length} restaurants`);
  
  // =========================================================================
  // DISTANCE CALCULATION (for nearby filter, more precise)
  // =========================================================================
  
  let filteredByDistance = restaurants;
  
  if (context.locationPreference === 'nearby' && context.maxDistanceMeters) {
    filteredByDistance = restaurants.filter(r => {
      if (!r.latitude || !r.longitude) return false;
      
      const distance = calculateDistanceMeters(
        userLocation.lat,
        userLocation.lng,
        r.latitude,
        r.longitude
      );
      
      return distance <= context.maxDistanceMeters!;
    });
    
    console.log(`📊 After precise distance filter: ${filteredByDistance.length} restaurants`);
  }
  
  // =========================================================================
  // OPENING HOURS FILTER
  // =========================================================================
  
  if (context.timing === 'anytime') {
    console.log('⏰ Time filter: None (anytime)');
    return filteredByDistance as CachedRestaurant[];
  }
  
  const day = context.specificDay ?? new Date().getDay();
  const timeRange = getTimeRangeForTiming(context.timing, context.specificTime);
  
  const filteredByTime = filteredByDistance.filter(r => {
    // Check if open at the start of the time range
    const isOpen = isOpenAt(r.opening_hours, day, timeRange.startMinutes);
    return isOpen;
  });
  
  console.log(`📊 After time filter (${context.timing}, day ${day}): ${filteredByTime.length} restaurants`);
  
  return filteredByTime as CachedRestaurant[];
}
