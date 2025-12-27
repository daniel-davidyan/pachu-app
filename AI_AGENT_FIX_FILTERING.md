# Critical Fix: Filtering Non-Matching Restaurants

## Problem
User asked for "סושי טוב ויקר בתל אביב" (good expensive sushi in Tel Aviv) but got:
1. Nincasa (bar) - 100% match
2. Cafe Icy Spicy (cafe) - 99% match  
3. The Custom Bakers (bakery) - 96% match

**No sushi restaurants at all!**

## Root Cause Analysis

Looking at the logs:
```
Restaurant: Nincasa, Score: 112.6, Match: 100%, Reasons: 
Restaurant: Cafe Icy Spicy, Score: 111.2, Match: 99%, Reasons:
Restaurant: The Custom Bakers, Score: 107.6, Match: 96%, Reasons:
```

### Issues Identified:

1. **Empty matchReasons** - These restaurants got NO cuisine match bonus
2. **AI didn't extract cuisineTypes** - The extraction failed, so `cuisineTypes: []`
3. **Fell back to nearby API** - Without searchQuery, it just got nearby restaurants
4. **Weak filtering** - Old filter only checked score > 50, but high ratings alone = 90 points
5. **Wrong location** - User's actual GPS is Pune, India, not Tel Aviv (location override needed)

## Fixes Applied

### 1. Enhanced Debugging (Lines 385-395)
```javascript
console.log('📊 Extracted data:', JSON.stringify(extractedData, null, 2));
// Now we can see what the AI actually extracted
```

### 2. Fallback Cuisine Extraction (Lines 402-422)
If AI fails to extract cuisineTypes, we scan all user messages for food keywords:

```javascript
if (extractedData.readyToShow && (!extractedData.cuisineTypes || extractedData.cuisineTypes.length === 0)) {
  console.warn('⚠️ AI did not extract cuisineTypes, attempting fallback...');
  
  const allUserText = [...userMessages.map(m => m.content), message].join(' ');
  
  // Hebrew terms: 'סושי', 'פיצה', 'המבורגר', 'עוף סיני', etc.
  // English terms: 'sushi', 'pizza', 'burger', etc.
  
  for (const term of foodTerms) {
    if (allUserText.includes(term)) {
      extractedData.cuisineTypes = [term];
      console.log(`✅ Fallback extracted cuisine: "${term}"`);
      break;
    }
  }
}
```

### 3. Strict Cuisine-Based Filtering (Lines 618-640)
**Before**: Kept restaurants with score > 50 (but rating alone = up to 90!)

**After**: Only keeps restaurants that actually got cuisine match bonuses:

```javascript
relevantRestaurants = scoredRestaurants.filter((r: any) => {
  // Has cuisine match reasons? Keep it!
  if (r.matchReasons && r.matchReasons.length > 0) {
    return true;
  }
  
  // Score significantly higher than rating alone? Keep it!
  const expectedBaseScore = r.rating * 18;
  if (r.matchScore > expectedBaseScore + 20) {
    return true;
  }
  
  // Otherwise, filter it out!
  return false;
});
```

### Example:
- **Sushi Restaurant** (4.0 rating, has "sushi" in name):
  - Base: 72 points
  - Name match: +40 points
  - Total: 112 points
  - matchReasons: ['cuisine-in-name']
  - **✅ KEPT**

- **Random Cafe** (4.5 rating, no sushi match):
  - Base: 81 points
  - No cuisine match: 0 bonus
  - Total: 81 points
  - matchReasons: []
  - **❌ FILTERED OUT**

## What You'll See Now

### Better Logs:
```
📊 Extracted data: {
  "cuisineTypes": ["סושי"],
  "searchQuery": "סושי",
  "priceLevel": 3,
  "occasion": "דייט",
  "distance": "הליכה קצרה"
}

🔍 Searching for (he): סושי
Found 10 restaurants for "סושי"
Filtered from 10 to 3 cuisine-matched restaurants

Restaurant: Sushi Bar, Score: 145, Match: 100%, Reasons: cuisine-in-name
Restaurant: Tokyo Sushi, Score: 138, Match: 95%, Reasons: cuisine-in-name, cuisine-type-match
Restaurant: Sakura, Score: 125, Match: 86%, Reasons: cuisine-type-match
```

### If Extraction Fails:
```
⚠️ AI did not extract cuisineTypes, attempting fallback extraction...
✅ Fallback extracted cuisine: "סושי"
```

### If No Matches Found:
```
⚠️ No cuisine matches found! Keeping top-rated restaurants as fallback.
```

## Testing

Try the same query again:
```
"באלי סושי טוב ויקר בתל אביב"
```

Expected behavior:
1. AI extracts: `cuisineTypes: ["סושי"]`
2. Searches Google for: "סושי"
3. Filters to keep ONLY sushi restaurants
4. Shows top 3 sushi places

If AI fails to extract, fallback kicks in and finds "סושי" from the message.

## Remaining Issue: Location

The user asked for "תל אביב" but the search uses GPS location (currently Pune, India).

**Future Enhancement Needed**: 
- Extract city name from query ("תל אביב", "Tel Aviv", etc.)
- Geocode city name to coordinates
- Use those coordinates instead of user's GPS location

For now, the system will search near the user's actual location but with correct cuisine filtering.

## Files Changed
- `app/api/map-chat/route.ts` - Added debugging, fallback extraction, and strict filtering

