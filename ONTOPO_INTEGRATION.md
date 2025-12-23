# ONTOPO Integration

This document describes the ONTOPO reservation integration for Israeli restaurants.

## Overview

ONTOPO is an Israeli restaurant reservation service. We automatically detect Israeli restaurants and provide a "Reserve on ONTOPO" button that searches ONTOPO for the restaurant and opens their reservation page.

## How It Works

### 1. Detection
- When a restaurant card or page loads, we fetch place details from Google Places API
- We check if the country is "Israel" (supports both English and Hebrew: "ישראל")
- If the restaurant is in Israel, we show the ONTOPO reservation button

### 2. ONTOPO Link Generation
The system makes 3 API calls to ONTOPO:

1. **Search**: `/api/ontopo?name=Restaurant+Name&city=City`
   - Searches ONTOPO for the restaurant
   - Returns venue slug (e.g., `34794569`)

2. **Get Profile**: ONTOPO's venue_profile API
   - Fetches venue details using the slug
   - Returns page information including reservation pages

3. **Build URL**: `https://ontopo.com/he/il/page/{pageSlug}`
   - Constructs the final ONTOPO reservation URL
   - Example: `https://ontopo.com/he/il/page/44216694`

### 3. Caching
- Once an ONTOPO URL is fetched, it's cached in component state
- Subsequent clicks open the URL immediately without re-fetching

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
- Handles ONTOPO search and link generation
- Takes restaurant name and optional city
- Returns final ONTOPO URL or 404 if not found

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
3. System searches ONTOPO API for "Cafe 38 Tel Aviv"
4. ONTOPO returns venue slug `34794569`
5. System fetches venue profile with page slug `44216694`
6. Green calendar button appears in the card
7. User clicks → Opens `https://ontopo.com/he/il/page/44216694`
8. User can make a reservation on ONTOPO

## Error Handling

- If ONTOPO search fails: Button doesn't show (silent failure)
- If ONTOPO has no reservation page: Button doesn't show
- If API is slow: Shows loading spinner
- If country detection fails: Falls back to address text search for "israel" or "ישראל"

## Testing

To test with Israeli restaurants, search for:
- Cafe 38 (Tel Aviv)
- Taizu (Tel Aviv)
- Any restaurant in Israel

The green calendar button should appear automatically.

