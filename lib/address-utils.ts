/**
 * Format address to show: City, Street, Number
 * Removes country and postal codes
 * 
 * Example: "Ibn Gabirol St 12, Tel Aviv-Yafo, 6203854, Israel"
 * Returns: "Tel Aviv-Yafo, Ibn Gabirol St 12"
 */
export function formatAddress(address?: string): string {
  if (!address) return '';
  
  // Remove postal codes (5-6 digit numbers like 65468, 12345)
  let cleaned = address.replace(/\b\d{5,6}\b/g, '').trim();
  
  // Split by commas
  const parts = cleaned.split(',').map(p => p.trim()).filter(p => p);
  
  // Typical format from Google: "street number, city, state/region, country"
  // We want: "City, Street, Number"
  if (parts.length >= 2) {
    // First part is street + number, second part is city
    const streetAndNumber = parts[0];
    const city = parts[1];
    return `${city}, ${streetAndNumber}`;
  }
  
  // Fallback: return cleaned address without postal codes and country
  if (parts.length === 1) {
    return parts[0];
  }
  
  return cleaned;
}

/**
 * Extract city from address for search purposes
 */
export function extractCityFromAddress(address?: string): string {
  if (!address) return '';
  
  // Remove postal codes first
  let cleaned = address.replace(/\b\d{5,6}\b/g, '').trim();
  
  // Split by commas
  const parts = cleaned.split(',').map(p => p.trim()).filter(p => p);
  
  // Second part is usually the city
  if (parts.length >= 2) {
    return parts[1];
  }
  
  return parts.length > 0 ? parts[parts.length - 1] : '';
}

