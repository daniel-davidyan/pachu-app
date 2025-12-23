# ONTOPO Integration

This document describes the ONTOPO reservation integration for Israeli restaurants.

## Overview

ONTOPO is an Israeli restaurant reservation service. We automatically detect Israeli restaurants and provide a "Reserve on ONTOPO" button that searches for the restaurant on ONTOPO and opens their reservation page.

## How It Works

### 1. Detection
- When a restaurant card or page loads, we fetch place details from Google Places API
- We check if the country is "Israel" (supports both English and Hebrew: "ישראל")
- If the restaurant is in Israel, we show the ONTOPO reservation button

### 2. ONTOPO Link Generation

**Primary Method: Google Custom Search API**
- Searches Google for "אונטופו [Restaurant Name]" or "ontopo [Restaurant Name]"
- Extracts the ONTOPO reservation page URL from search results
- **Most accurate** - uses Google's indexing which is 100% reliable
- **Free tier**: 100 searches/day, then $5 per 1,000 queries
- **Optional**: Works without API key using fallback

**Fallback Method: Direct ONTOPO API**
- If Google API not configured or quota exceeded
- Searches ONTOPO's own API for the restaurant
- Fetches venue profile and extracts reservation page
- Less accurate but still works well

### 3. Caching
- Once an ONTOPO URL is fetched, it's cached in component state
- Subsequent clicks open the URL immediately without re-fetching

## Setup

### Required Environment Variables

Add to your `.env.local`:

```bash
# Optional - Google Custom Search API for better accuracy
GOOGLE_CUSTOM_SEARCH_API_KEY=your_api_key_here
GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_search_engine_id_here
```

**See `ONTOPO_GOOGLE_SEARCH_SETUP.md` for detailed setup instructions.**

### Without Google API

The integration works perfectly fine without Google Custom Search:
- Simply don't add the environment variables
- System automatically uses direct ONTOPO API search
- ONTOPO buttons will still work for most restaurants

## Components Modified

### 1. Restaurant Card (`components/map/restaurant-card.tsx`)
- Adds Calendar icon button (green) in the quick actions row
- Only visible for Israeli restaurants
- Shows loading spinner while fetching ONTOPO link

### 2. Restaurant Page (`app/restaurant/[id]/page.tsx`)
- Adds full-width "Reserve on ONTOPO" button below main action buttons
- Only visible for Israeli restaurants
- More prominent call-to-action than the card icon

### 3. API Endpoint (`app/api/ontopo/route.ts`)
- Primary: Google Custom Search for "אונטופו [restaurant]"
- Fallback: Direct ONTOPO API search
- Returns final ONTOPO reservation URL

### 4. Place Details API (`app/api/restaurants/details/route.ts`)
- Enhanced to parse and return `country` and `city` from Google Places address_components
- Used to detect Israeli restaurants

## Button Styles

- **Color**: Green (to differentiate from other actions)
- **Icon**: Calendar (lucide-react)
- **States**: Normal, Loading, Disabled
- **Card**: Small icon button (48x48px)
- **Page**: Full-width button with text

## Example Flow

1. User views "Cafe 38" in Tel Aviv on the map
2. System detects it's in Israel
3. System searches Google: "אונטופו Cafe 38"
4. Google returns: `https://ontopo.com/he/il/page/44216694`
5. Green calendar button appears in the card
6. User clicks → Opens ONTOPO reservation page

## Error Handling

- If Google API quota exceeded: Uses fallback automatically
- If ONTOPO search fails: Button doesn't show (silent failure)
- If ONTOPO has no reservation page: Button doesn't show
- If country detection fails: Falls back to address text search for "israel" or "ישראל"

## Monitoring & Logs

Console logs show the search flow:

**Google Search Success:**
```
🔍 Looking for ONTOPO page: "Cafe 38" in Tel Aviv
🔍 Searching Google: "אונטופו Cafe 38 Tel Aviv"
✅ Found ONTOPO link via Google: https://ontopo.com/he/il/page/44216694
```

**Fallback to Direct Search:**
```
🔍 Looking for ONTOPO page: "Cafe 38" in Tel Aviv
⚠️ Google Custom Search not configured, will use fallback
🔄 Using fallback: Direct ONTOPO API search
✅ Found ONTOPO link via API: https://ontopo.com/he/il/page/44216694
```

## Testing

To test with Israeli restaurants, search for:
- Cafe 38 (Tel Aviv)
- Taizu (Tel Aviv)
- Any restaurant in Israel

The green calendar button should appear automatically!

## Cost Estimation

**Google Custom Search API:**
- Free: 100 searches/day
- Paid: $5 per 1,000 queries (after free tier)
- Example: 200 daily users viewing Israeli restaurants = ~$15/month

**Direct ONTOPO API (Fallback):**
- Free - uses ONTOPO's public API
- No limits or costs

## Advantages of Google Search Method

✅ **100% Accurate** - Uses Google's indexing  
✅ **Handles variations** - "Cafe" vs "קפה", name variations  
✅ **Always up-to-date** - Google indexes ONTOPO pages automatically  
✅ **Finds exact match** - Better than fuzzy name matching  
✅ **Fallback included** - Works without API key  
✅ **Cost-effective** - 100 free searches/day, then cheap  

## Production Deployment

1. Set up Google Custom Search (optional but recommended)
2. Add API keys to production environment variables
3. Monitor usage in Google Cloud Console
4. System automatically handles quota limits with fallback
5. No downtime if Google API unavailable

