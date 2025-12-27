# Fix: Restaurant Images in Chat

## Problem
User reported that restaurant images are not showing in the chat recommendations, but they do show on the restaurant detail pages.

## Root Cause Analysis

The code was already correct - the `photoUrl` field is included in the Restaurant interface and the search API returns it. However, there could be a few issues:

1. **Images might be failing to load** (network errors, CORS, invalid URLs)
2. **No error handling** - broken images just show as empty boxes
3. **No logging** - hard to debug what's happening

## Fixes Applied

### 1. Enhanced Logging in API (app/api/map-chat/route.ts)

Added detailed logging when restaurants are found:

```javascript
console.log(`✓ Found: ${restaurant.name}`, {
  hasPhoto: !!restaurant.photoUrl,
  photoUrl: restaurant.photoUrl?.substring(0, 100) + '...',
  rating: restaurant.rating,
  address: restaurant.address
});
```

Now you'll see in the console:
```
✓ Found: Mona Restaurant {
  hasPhoto: true,
  photoUrl: "https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=...",
  rating: 4.5,
  address: "38 Hillel St, Jerusalem"
}
```

### 2. Image Error Handling (components/map/ai-chat-sheet.tsx)

Added `onError` handler to catch failed image loads:

```javascript
<img
  src={restaurant.photoUrl}
  alt={restaurant.name}
  onError={(e) => {
    console.error(`Failed to load image for ${restaurant.name}:`, restaurant.photoUrl);
    // Show fallback icon instead
    const parent = e.currentTarget.parentElement;
    if (parent) {
      parent.innerHTML = `
        <div class="...">
          <span class="text-3xl">${getRestaurantIcon(restaurant)}</span>
        </div>
      `;
    }
  }}
/>
```

**What this does:**
- If image fails to load → logs error to console
- Automatically replaces broken image with emoji icon (🍣, 🍕, 🍔, etc.)
- User sees nice fallback instead of broken image box

## How to Debug

### Check Browser Console:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for messages:

**If images are loading:**
```
✓ Found: Mona Restaurant { hasPhoto: true, photoUrl: "https://..." }
```

**If images fail to load:**
```
Failed to load image for Mona Restaurant: https://maps.googleapis.com/...
```

### Check Network Tab:
1. Open DevTools → Network tab
2. Filter by "Img"
3. Look for requests to `maps.googleapis.com/maps/api/place/photo`
4. Check if they return 200 OK or errors (403, 404, etc.)

## Possible Issues & Solutions

### Issue 1: API Key Not Valid for Photo Requests
**Symptom:** Images return 403 Forbidden
**Solution:** Make sure `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` has "Places API" enabled in Google Cloud Console

### Issue 2: CORS Policy
**Symptom:** Browser console shows CORS errors
**Solution:** Google Photos API should work fine, but if there are issues, we'd need to proxy the images through our server

### Issue 3: No Photo Available
**Symptom:** `photoUrl` is undefined
**Solution:** Already handled - shows emoji icon fallback

### Issue 4: Photo Reference Expired
**Symptom:** 404 errors on photo URLs
**Solution:** Google photo references can expire. Need to refetch restaurant data periodically.

## Testing

Try the agent again and:
1. Check browser console for the new logs
2. See if images load this time
3. If images fail, check what error appears

**Example good log:**
```
🤖 Sending full conversation to OpenAI...
🎯 OpenAI recommended: Mona Restaurant, Eucalyptus, Machneyuda
🔍 Searching: "Mona Restaurant"
✓ Found: Mona Restaurant {
  hasPhoto: true,
  photoUrl: "https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=ABC123...",
  rating: 4.5
}
```

**If you see `hasPhoto: false`:**
→ The restaurant doesn't have photos in Google Places

**If you see `hasPhoto: true` but images don't show:**
→ Check Network tab for the actual image request errors

## Files Changed
- `app/api/map-chat/route.ts` - Added detailed logging for restaurant photos
- `components/map/ai-chat-sheet.tsx` - Added image error handling with fallback

