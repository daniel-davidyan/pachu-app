# Google Reviews Import Feature

## Overview

The Google Reviews Import feature allows users to seamlessly import their existing Google Reviews into Pachu, automatically populating their "My Experiences" with past restaurant reviews.

## 🌟 Features

- **One-Click Import**: Beautiful, modern UI for importing Google Reviews
- **Automatic Restaurant Matching**: Intelligently matches Google Places to restaurants in our database
- **Smart Duplicate Detection**: Skips reviews for restaurants you've already reviewed in Pachu
- **Photo Preservation**: Imports up to 5 photos per review
- **Privacy First**: Reviews are imported as **unpublished** by default for user privacy
- **Rating & Date Preservation**: Maintains original ratings and review dates

## 📱 User Flow

### 1. Export from Google

Users need to export their Google Reviews data using Google Takeout:

1. Visit [Google Takeout](https://takeout.google.com)
2. Click "Deselect all"
3. Scroll down and select only **"Maps (your places)"**
4. Click "Next step"
5. Choose delivery method (email link recommended)
6. Select format: **JSON** (not HTML)
7. Click "Create export"
8. Wait for email notification (can take minutes to hours)
9. Download the ZIP file
10. Extract and locate the JSON file (usually in `Takeout/Maps (your places)/Reviews.json`)

### 2. Import to Pachu

1. Go to **Profile** page in Pachu
2. Click the **"Import from Google Reviews"** button (colorful Google-branded button)
3. Upload the JSON file (drag & drop or click to browse)
4. Wait for processing (automatically handles all reviews)
5. View import results:
   - Number of reviews imported
   - Number of reviews skipped (duplicates)
   - Any errors that occurred

### 3. Review and Publish

- All imported reviews are saved as **unpublished** (visible only to you)
- Go to **Profile → My Experiences → Saved** tab to see imported reviews
- Review each experience and publish the ones you want to share
- Edit or delete any imported reviews as needed

## 🏗️ Technical Implementation

### Components

#### 1. API Route: `/api/google-reviews/import`
**File**: `app/api/google-reviews/import/route.ts`

Handles the import process:
- Validates user authentication
- Parses Google Reviews JSON format
- Fetches detailed place information from Google Places API
- Creates/matches restaurants in database
- Creates reviews with proper timestamps
- Handles photo imports
- Returns detailed import results

**Key Features**:
- Async processing of multiple reviews
- Error handling per review (doesn't fail entire batch)
- Duplicate detection (skips existing user-restaurant combinations)
- Automatic restaurant creation with Google Place ID

#### 2. Import Modal Component
**File**: `components/profile/google-import-modal.tsx`

Beautiful, modern UI featuring:
- Drag & drop file upload
- Step-by-step instructions
- Real-time import progress
- Detailed success/error reporting
- Responsive design with animations

#### 3. Profile Integration
**File**: `app/profile/page.tsx`

- Prominent Google-branded import button
- Modal state management
- Automatic data refresh after import
- Hide bottom navigation during import

### Database Schema

The import uses existing database tables:

```sql
-- Restaurants
restaurants (
  id, google_place_id, name, address, 
  latitude, longitude, image_url, cuisine_types
)

-- Reviews
reviews (
  id, user_id, restaurant_id, rating, 
  content, created_at, is_published
)

-- Review Photos
review_photos (
  id, review_id, photo_url, sort_order
)
```

**Key Column**: `is_published` (default: `false` for imports)

## 📊 Supported Google Takeout Formats

The importer supports multiple Google Takeout JSON formats:

### Format 1: Direct Array
```json
[
  {
    "placeId": "ChIJ...",
    "placeName": "Restaurant Name",
    "rating": 5,
    "comment": "Great food!",
    "timestamp": 1640000000000,
    "photos": ["https://..."]
  }
]
```

### Format 2: Wrapped Object
```json
{
  "reviews": [
    {
      "place_id": "ChIJ...",
      "name": "Restaurant Name",
      "starRating": 5,
      "reviewText": "Great food!",
      "publishedTime": 1640000000000
    }
  ]
}
```

### Format 3: Locations Format
```json
{
  "locations": [
    {
      "placeId": "ChIJ...",
      "name": "Restaurant Name",
      "review": {
        "starRating": 5,
        "comment": "Great food!",
        "publishedTime": 1640000000000
      }
    }
  ]
}
```

## 🔒 Privacy & Security

- ✅ Reviews imported as **unpublished** by default
- ✅ User maintains full control over what to publish
- ✅ JSON file processed server-side, never stored
- ✅ Authentication required for all operations
- ✅ User can only import to their own account

## 🎨 UI/UX Design

### Import Button
- Gradient border with Google brand colors
- White background for contrast
- Google logo icon
- Clear call-to-action text
- Smooth hover and click animations

### Modal Design
- Gradient header with Google colors
- Step-by-step instructions with link to Google Takeout
- Large drag & drop upload area
- Clear loading states
- Detailed success/error reporting
- Beautiful success card with emoji
- Info callouts for user guidance

## 🚀 Future Enhancements

Potential improvements:
- [ ] Batch photo downloads from Google URLs
- [ ] Import Google photos directly (currently expects URLs)
- [ ] Schedule periodic auto-imports
- [ ] Import from other platforms (Yelp, TripAdvisor)
- [ ] AI-powered review enrichment
- [ ] Sentiment analysis on imported reviews
- [ ] Automatic tagging of cuisines/features

## 🐛 Troubleshooting

### Common Issues

**Issue**: "Unrecognized file format"
- **Solution**: Ensure you selected JSON format in Google Takeout, not HTML

**Issue**: "No valid reviews found"
- **Solution**: Check that your Google account has restaurant reviews

**Issue**: Some reviews skipped
- **Solution**: Normal! These are likely:
  - Reviews for places you've already reviewed in Pachu
  - Reviews for non-restaurant places
  - Reviews with missing required data (place ID, rating)

**Issue**: Photos not importing
- **Solution**: Google photo URLs may expire or be private. Feature works best with public review photos.

## 📝 Notes

- Import is additive (doesn't overwrite existing reviews)
- One review per restaurant per user (database constraint)
- Maximum 5 photos per review
- Reviews maintain original Google timestamp
- Cuisine types extracted from Google Place types
- Restaurant photos fetched from Google Places API

## 🔗 Related Files

- API Route: `app/api/google-reviews/import/route.ts`
- Modal Component: `components/profile/google-import-modal.tsx`
- Profile Page: `app/profile/page.tsx`
- Toast Component: `components/ui/toast.tsx`
- Supabase Client: `lib/supabase/server.ts`

---

**Built with** ❤️ **for Pachu users to easily bring their food history into one place!**

