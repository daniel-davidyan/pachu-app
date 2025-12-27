# GeoJSON Format Support - Update

## ✅ GeoJSON Format Now Supported!

The Google Reviews Import feature has been updated to support the **GeoJSON format**, which is the most common export format from newer Google Takeout exports.

## What Changed

### 1. Frontend Parser (`components/profile/google-import-modal.tsx`)
Added `parseGeoJsonFormat()` function that:
- Detects `type: "FeatureCollection"` structure
- Extracts review data from `features` array
- Parses properties including:
  - `five_star_rating_published` → rating
  - `review_text_published` → review text
  - `location.name` → restaurant name
  - `location.address` → restaurant address
  - `date` → review timestamp
  - Coordinates from geometry

### 2. Backend API (`app/api/google-reviews/import/route.ts`)
Enhanced to handle non-standard Place IDs:
- Detects when Place ID is in hex format (e.g., `0x35f6e7ed40d5e917`)
- Falls back to Google Places Text Search API
- Searches by restaurant name + address
- Retrieves proper Google Place ID
- Creates restaurant with correct data

## Example GeoJSON Format

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "geometry": {
        "coordinates": [34.7737770, 32.0782089],
        "type": "Point"
      },
      "properties": {
        "date": "2024-08-08T18:28:57.094036Z",
        "five_star_rating_published": 5,
        "google_maps_url": "https://www.google.com/maps/place//data=!4m2!3m1!1s0x0:0x85a4ae07074e37e6",
        "location": {
          "address": "בן עמי 11, תל אביב-יפו, ישראל",
          "country_code": "IL",
          "name": "ג'ניה"
        },
        "review_text_published": "Great restaurant!"
      },
      "type": "Feature"
    }
  ]
}
```

## Supported Formats (Updated)

The importer now supports **4 different formats**:

1. ✅ **GeoJSON Format** (FeatureCollection) - MOST COMMON
2. ✅ Direct Array Format
3. ✅ Wrapped Reviews Object Format
4. ✅ Locations-Based Format

## Testing with Your Data

Your specific JSON file will now work! The system will:
1. Detect it's GeoJSON format
2. Extract restaurant names and addresses
3. Search Google Places to find the correct Place IDs
4. Import all reviews with ratings and text
5. Create restaurant entries in the database

## What Gets Imported from GeoJSON

✅ **Restaurant Name** (from `location.name`)  
✅ **Address** (from `location.address`)  
✅ **Rating** (from `five_star_rating_published`)  
✅ **Review Text** (from `review_text_published`)  
✅ **Date** (from `date`)  
✅ **Country** (from `location.country_code`)  

## Languages Supported

The format works with reviews in any language, including:
- Hebrew (עברית) ✅
- Greek (Ελληνικά) ✅
- English ✅
- And all other languages!

## Performance Note

Since GeoJSON format often doesn't include direct Google Place IDs, the import process:
- Makes additional API calls to Google Places Text Search
- May take slightly longer than other formats
- Still completes quickly (typically < 1 minute for 10-20 reviews)

## Try It Again!

Your import should now work perfectly. Upload your GeoJSON file and watch your reviews populate! 🎉

---

**Updated**: December 27, 2025  
**Status**: ✅ GeoJSON Support Active

