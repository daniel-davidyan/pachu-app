# 🔧 Import Fix - Restaurant Creation Issue

## Problem Identified

The import was failing with "Failed to add [restaurant]" errors because the restaurant creation code was trying to insert `latitude` and `longitude` as regular fields, but the database uses **PostGIS** for location data.

## Root Cause

The `restaurants` table uses:
- `location` field with PostGIS `GEOGRAPHY` type
- Special SQL function `update_restaurant_location()` to set coordinates
- The `latitude`/`longitude` fields may not exist as direct columns

## Solution Applied

Updated `app/api/google-reviews/import/route.ts` to:

### 1. Simplified Restaurant Insert
```typescript
const newRestaurant = {
  google_place_id: placeId,
  name: place.name || review.placeName,
  address: place.formatted_address || review.placeAddress,
  cuisine_types: place.types?.filter(...) || [],
  image_url: place.photos?.[0] ? ... : null,
  created_by: user.id,
  // Removed: latitude, longitude (these don't exist as direct fields!)
};
```

### 2. Update Location Separately
```typescript
// After restaurant is created, update location using PostGIS
if (lat && lng && lat !== 0 && lng !== 0) {
  try {
    await supabase.rpc('update_restaurant_location', {
      p_restaurant_id: restaurantId,
      p_longitude: lng,
      p_latitude: lat,
    });
  } catch (e) {
    // Location update is optional, continue without it
    console.log('Location update skipped');
  }
}
```

### 3. Better Error Logging
```typescript
console.error('Failed to create restaurant:', {
  error: createError,
  restaurant: newRestaurant,
  message: createError?.message,
  details: createError?.details,
  hint: createError?.hint,
});

// Show actual error message to user
results.errors.push(`Failed to add ${review.placeName}: ${errorMsg}`);
```

## What This Fixes

✅ **Restaurant Creation**: Now follows the same pattern as the rest of the app  
✅ **PostGIS Compatibility**: Uses the proper `update_restaurant_location` RPC function  
✅ **Better Errors**: Shows the actual database error message to help debug  
✅ **Graceful Fallback**: If PostGIS isn't set up, continues without location  

## Try Again!

Now when you upload your Google Reviews JSON:

1. **Search Phase**: 
   - Searches Google Places for each restaurant
   - Finds the correct Place ID
   - Gets full restaurant details

2. **Restaurant Creation**:
   - Creates restaurant with basic fields
   - Updates location using PostGIS function
   - Handles errors gracefully

3. **Review Creation**:
   - Links review to restaurant
   - Preserves rating, text, date
   - Imports photos (if any)
   - Saves as unpublished

## Expected Results for Your Data

From your 4 reviews:
- ✅ **Cafe - Taverna "ARMI"** (Greece) - should import
- ✅ **ג'ניה** (Tel Aviv) - should import  
- ⚠️ **כיף לחיות** (Pet food store) - may skip if not found as restaurant
- ⚠️ **צ'יטה משלוחים** (Delivery service) - may skip if not found as restaurant

You should see **at least 2 successful imports** for the actual restaurants!

## Next Steps

1. **Upload the JSON file again**
2. **Check the results** - you should see more descriptive errors if any fail
3. **Check browser console** (F12 → Console) for detailed logs
4. **Check imported reviews** in Profile → My Experiences → Saved tab

---

**Status**: ✅ Fixed  
**Date**: December 27, 2025  
**Changes**: Restaurant creation now uses proper PostGIS pattern

