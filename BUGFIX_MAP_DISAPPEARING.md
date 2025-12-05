# Bug Fix: Map Disappearing After 1 Second

## Issue
The map would appear briefly for about 1 second and then completely disappear.

## Root Cause
The map initialization `useEffect` had `loadRestaurantsInBounds` in its dependency array:

```typescript
useEffect(() => {
  // ... initialize map
  return () => {
    map.current?.remove(); // ❌ This was being called repeatedly!
  };
}, [accessToken, userLocation, loadRestaurantsInBounds]); // ❌ Problem here!
```

### What Was Happening:

1. **Map initializes** → Creates map instance
2. **`loadRestaurantsInBounds` changes** (because it depends on `isLoadingMore` state)
3. **Effect cleanup runs** → Calls `map.current.remove()` destroying the map
4. **Effect tries to re-run** → But guard `if (map.current)` prevents recreation
5. **Result**: Map is destroyed but never recreated = **Disappears!**

### The Vicious Cycle:
```
Initial render
   ↓
Create map ✅
   ↓
Set up event listeners
   ↓
State changes (isLoadingMore)
   ↓
loadRestaurantsInBounds updates
   ↓
Effect dependency changes
   ↓
Cleanup runs → map.remove() ❌
   ↓
Map disappears! 💥
```

## Solution Applied

### 1. Use Ref for Callback
Store the latest version of `loadRestaurantsInBounds` in a ref:

```typescript
const loadRestaurantsRef = useRef<((bounds: mapboxgl.LngLatBounds) => Promise<void>) | null>(null);

// Keep ref updated
useEffect(() => {
  loadRestaurantsRef.current = loadRestaurantsInBounds;
}, [loadRestaurantsInBounds]);
```

### 2. Remove from Dependencies
Remove `loadRestaurantsInBounds` from the map initialization dependencies:

```typescript
useEffect(() => {
  // ... initialize map
  return () => {
    if (map.current) {
      map.current.remove();
      map.current = null;
    }
  };
}, [accessToken, userLocation]); // ✅ Only stable dependencies!
```

### 3. Use Ref in Event Handlers
Update event handlers to use the ref instead of the direct function:

```typescript
currentMap.on('moveend', () => {
  if (map.current && loadRestaurantsRef.current) {
    const bounds = map.current.getBounds();
    loadRestaurantsRef.current(bounds); // ✅ Always uses latest version
  }
});
```

## Why This Works

### Before (Broken):
```
Map Effect Dependencies: [accessToken, userLocation, loadRestaurantsInBounds]
                                                      ↑
                                                      Changes frequently!
                                                      ↓
                                                  Map gets destroyed
```

### After (Fixed):
```
Map Effect Dependencies: [accessToken, userLocation]
                         ↑
                         Only change when truly needed (almost never)
                         ↓
                         Map stays stable ✅

Event Handlers: Use loadRestaurantsRef.current
                ↑
                Always has latest callback
                ↓
                Works perfectly! ✅
```

## Additional Improvements

### Better Cleanup
```typescript
return () => {
  if (map.current) {
    map.current.remove();
    map.current = null; // ✅ Explicitly null it out
  }
};
```

### Removed Unnecessary Check
Removed `!map.current` check from `loadRestaurantsInBounds` since it's now called via ref after map is guaranteed to exist.

## Files Modified
- `components/map/mapbox.tsx`

## Changes Summary
1. ✅ Added `loadRestaurantsRef` to store latest callback
2. ✅ Added effect to keep ref updated
3. ✅ Removed `loadRestaurantsInBounds` from map initialization dependencies
4. ✅ Updated event handlers to use ref
5. ✅ Improved cleanup to explicitly null out map reference

## Testing
- ✅ No linter errors
- ✅ TypeScript compilation successful
- ✅ Map now stays visible
- ✅ All features work (lazy loading, clustering, markers)

## Result
✅ **Map stays visible permanently**
✅ **Lazy loading works correctly**
✅ **Event handlers always use latest callback**
✅ **No unnecessary re-renders**
✅ **Stable map instance**

---
**Status**: ✅ FIXED
**Fixed**: December 5, 2025
**Impact**: Critical - Map now works as intended

