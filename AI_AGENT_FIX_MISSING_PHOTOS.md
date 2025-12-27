# Fix: Missing Restaurant Photos in AI Recommendations

## Problem
Some restaurants in AI recommendations (like "MeatBar" and "Segev Diner") were showing without photos, even though photos exist on Google.

**What was happening:**
```
User asks for recommendations
→ OpenAI returns: "MeatBar", "Hudson Brasserie", "Segev Diner"
→ System searches Google Places Text Search for each
→ Text Search returns basic info but sometimes no photos
→ Restaurant cards show without images ❌
```

## Root Cause
The `/api/restaurants/search` endpoint was using **Google Places Text Search API only**, which sometimes doesn't return complete information, especially photos. We needed to also use the **Place Details API** to get full restaurant information.

## Solution

### Enhanced Search Flow

**New Flow:**
```
1. Text Search finds restaurant by name
   ↓
2. Get place_id from Text Search
   ↓
3. IF no photo in Text Search results:
   → Call Place Details API with place_id
   → Get complete info (photos, price, hours, etc.)
   ↓
4. Return enriched data with photos
```

### Code Changes

#### File: `app/api/restaurants/search/route.ts`

**Before:**
```typescript
const restaurants = data.results?.slice(0, 10).map((place: any) => ({
  googlePlaceId: place.place_id,
  name: place.name,
  address: place.formatted_address,
  photoUrl: place.photos?.[0] ? `...photo URL...` : undefined,
  rating: place.rating || 0,
})) || [];
```

**After:**
```typescript
const restaurants = await Promise.all(
  (data.results?.slice(0, 10) || []).map(async (place: any) => {
    let enrichedData = {
      googlePlaceId: place.place_id,
      name: place.name,
      address: place.formatted_address,
      photoUrl: place.photos?.[0] ? `...` : undefined,
      rating: place.rating || 0,
      priceLevel: place.price_level,
      cuisineTypes: place.types?.filter(...) || [],
    };

    // If no photo from Text Search, try Place Details API
    if (!enrichedData.photoUrl && place.place_id) {
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,photos,formatted_phone_number,opening_hours,website,price_level,types&key=${apiKey}`;
        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();
        
        if (detailsData.status === 'OK' && detailsData.result) {
          const details = detailsData.result;
          
          // Get photo from details
          if (details.photos?.[0]) {
            enrichedData.photoUrl = `...photo URL...`;
          }
          
          // Add additional details
          if (details.price_level) enrichedData.priceLevel = details.price_level;
          if (details.types) enrichedData.cuisineTypes = details.types.filter(...);
        }
      } catch (detailsError) {
        console.error('Error fetching place details:', detailsError);
      }
    }

    return enrichedData;
  })
);
```

### Additional Improvements

#### Enhanced Logging (`app/api/map-chat/route.ts`)

Added better logging to track photo issues:

```typescript
console.log(`✓ Found: ${restaurant.name}`, {
  hasPhoto: !!restaurant.photoUrl,
  photoUrl: restaurant.photoUrl ? restaurant.photoUrl.substring(0, 100) + '...' : 'NO PHOTO',
  rating: restaurant.rating,
  address: restaurant.address?.substring(0, 50),
  placeId: restaurant.googlePlaceId
});

if (!restaurant.photoUrl) {
  console.warn(`⚠️ "${restaurant.name}" has no photo! Place ID: ${restaurant.googlePlaceId}`);
}
```

## Benefits

1. **Better Photo Coverage**: Now fetches photos from Place Details API if Text Search doesn't have them
2. **More Complete Data**: Also gets price level, cuisine types, and other details
3. **Better Debugging**: Enhanced logging shows exactly which restaurants have photos and which don't
4. **Graceful Degradation**: If Place Details fails, still returns the restaurant with whatever data Text Search provided

## Expected Result

**Now:**
```
OpenAI recommends: "MeatBar", "Hudson Brasserie", "Segev Diner"
                          ↓
Text Search: MeatBar (no photo), Hudson (has photo), Segev (no photo)
                          ↓
Place Details: MeatBar → fetch photo ✅
                          ↓
Result:
✅ MeatBar      [Photo from Details API]
✅ Hudson       [Photo from Text Search]
✅ Segev Diner  [Photo from Details API]
```

## Testing

Watch the console logs:
```
🔍 Searching Google Places for: "MeatBar"
✓ Found: MeatBar { hasPhoto: true, photoUrl: 'https://maps...', placeId: 'ChIJ...' }
```

If you see:
```
⚠️ "MeatBar" has no photo! Place ID: ChIJ...
```

That means Google Places doesn't have a photo for this restaurant at all (rare, but possible).

## Notes

- Google Places has rate limits, but the additional Place Details calls only happen when Text Search doesn't return photos
- Most restaurants should now have photos
- If a restaurant truly has no photos on Google, the fallback emoji icon will still show

