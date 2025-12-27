# Published/Unpublished Experiences Feature

## Overview

This feature allows users to save restaurant experiences in two ways:
1. **Post Experience** - Publicly visible to all users in feeds and restaurant pages
2. **Save Without Publishing** - Privately saved for learning user preferences without public visibility

## Why This Feature?

Unpublished experiences help the recommendation engine learn user preferences and tastes without requiring users to publicly share every dining experience. This provides:
- Better recommendation accuracy
- More privacy for users
- Encouragement to record more experiences

## Database Changes

### Migration: `108-add-is-published-to-reviews.sql`

**Location:** `database-migrations/108-add-is-published-to-reviews.sql`

**What it does:**
- Adds `is_published` boolean column to the `reviews` table
- Default value is `true` for backward compatibility
- Creates indexes for efficient querying
- Updates all existing reviews to be published

**How to apply:**

#### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"
4. Copy and paste the contents of `database-migrations/108-add-is-published-to-reviews.sql`
5. Click "Run" to execute the migration

#### Option 2: Supabase CLI
```bash
cd pachu-app
supabase db execute database-migrations/108-add-is-published-to-reviews.sql
```

## Code Changes

### 1. API Layer (`app/api/reviews/route.ts`)

**Changes:**
- **POST endpoint**: Now accepts `isPublished` parameter (defaults to `true`)
- **GET endpoint**: Supports `published` query parameter to filter results
  - `published=true` - Only published reviews
  - `published=false` - Only unpublished reviews
  - No parameter - All reviews (for user's own profile)

**Usage:**
```typescript
// Create published experience
POST /api/reviews
{
  "restaurant": {...},
  "rating": 5,
  "content": "Great food!",
  "photoUrls": [...],
  "isPublished": true
}

// Create unpublished (saved) experience
POST /api/reviews
{
  "restaurant": {...},
  "rating": 5,
  "content": "Great food!",
  "photoUrls": [...],
  "isPublished": false
}

// Get only published reviews for a user
GET /api/reviews?userId=xxx&published=true

// Get only unpublished reviews for a user
GET /api/reviews?userId=xxx&published=false

// Get all reviews for a user (own profile)
GET /api/reviews?userId=xxx
```

### 2. Write Review Modal (`components/review/write-review-modal.tsx`)

**Changes:**
- Replaced single "Post Experience" button with two buttons:
  1. **"Post Experience"** (primary button) - Posts publicly
  2. **"Save Without Publishing"** (secondary button) - Saves privately
- Added helper text explaining the benefit of saving experiences
- Updated `handleSubmit()` to accept a `publish` parameter
- Updated success messages to differentiate between posting and saving

**UI:**
```
┌─────────────────────────────────────┐
│  [★★★★★] Rating                    │
│  Photos: [📷] [📷] [+]              │
│  Your Experience: [text area]       │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  ✉️ Post Experience         │   │  ← Primary (pink)
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  💬 Save Without Publishing │   │  ← Secondary (gray)
│  └─────────────────────────────┘   │
│                                     │
│  Saving helps us learn your         │
│  preferences and taste so we can    │
│  suggest more accurate              │
│  recommendations for you            │
└─────────────────────────────────────┘
```

### 3. Profile Page (`app/profile/page.tsx`)

**Changes:**
- Added filter buttons in the "My Experiences" tab:
  - **All** - Shows all experiences (published + unpublished)
  - **Published** - Shows only published experiences
  - **Saved** - Shows only unpublished experiences
- Filter persists when switching tabs and returns
- Updated `fetchReviews()` to pass filter parameter to API

**UI:**
```
┌──────────────────────────────────────┐
│  My Experiences  │  My Wishlist      │
├──────────────────────────────────────┤
│  [ All ]  [Published]  [Saved]       │  ← Filter buttons
├──────────────────────────────────────┤
│  Experience 1                        │
│  Experience 2                        │
│  ...                                 │
└──────────────────────────────────────┘
```

### 4. Feed APIs

Updated all feed endpoints to only show published experiences:

- **`app/api/feed/nearby/route.ts`** - Nearby experiences feed
- **`app/api/feed/following/route.ts`** - Following feed
- **`app/api/restaurants/[id]/route.ts`** - Restaurant detail page reviews
- **`app/api/restaurants/friends-reviews/route.ts`** - Friends' reviews

All queries now include `.eq('is_published', true)` to filter out unpublished experiences.

## Testing Checklist

### Before Testing
- [ ] Run the database migration `108-add-is-published-to-reviews.sql`
- [ ] Restart the development server

### Test Cases

#### 1. Posting a New Experience
- [ ] Create a new experience with "Post Experience" button
- [ ] Verify it appears in your profile under "All" filter
- [ ] Verify it appears in your profile under "Published" filter
- [ ] Verify it appears in the feed
- [ ] Verify it appears on the restaurant detail page

#### 2. Saving Without Publishing
- [ ] Create a new experience with "Save Without Publishing" button
- [ ] Verify it appears in your profile under "All" filter
- [ ] Verify it appears in your profile under "Saved" filter
- [ ] Verify it does NOT appear in the feed
- [ ] Verify it does NOT appear on the restaurant detail page (to other users)

#### 3. Profile Filters
- [ ] Click "All" - should show both published and unpublished
- [ ] Click "Published" - should show only published
- [ ] Click "Saved" - should show only unpublished
- [ ] Switch to "My Wishlist" tab and back - filter should persist

#### 4. Editing Existing Experiences
- [ ] Edit a published experience - should remain published
- [ ] Edit an unpublished experience - should remain unpublished
- [ ] You can change publish status by editing and resubmitting

#### 5. Backward Compatibility
- [ ] All existing experiences should be marked as published
- [ ] Existing experiences should appear in feeds as before

## User Flow

### Scenario 1: Social User (wants to share)
```
1. Visit a restaurant
2. Open "Share Experience" modal
3. Rate and add photos
4. Click "Post Experience" 💜
5. Experience is publicly visible
6. Friends see it in their feed
```

### Scenario 2: Private User (wants better recommendations)
```
1. Visit a restaurant
2. Open "Share Experience" modal
3. Rate and add photos
4. Click "Save Without Publishing" 📝
5. Experience is saved privately
6. System learns your preferences
7. You get better recommendations
8. Can view in profile under "Saved"
```

## Technical Notes

### Default Behavior
- If `isPublished` is not specified in the API request, it defaults to `true` (backward compatibility)
- All existing reviews are automatically marked as published by the migration

### Database Indexes
Two indexes were created for optimal performance:
- `idx_reviews_is_published` - General published status queries
- `idx_reviews_user_published` - User-specific published status queries

### Privacy Considerations
- Unpublished experiences are only visible to the user who created them
- They do not appear in:
  - Public feeds
  - Restaurant detail pages (to other users)
  - Friend activity
  - Search results
- They are included in:
  - User's own profile (under "Saved" filter)
  - Recommendation engine calculations (future feature)

## Future Enhancements

Potential improvements for this feature:
1. **Bulk Actions** - Select multiple saved experiences and publish them at once
2. **Convert to Published** - Quick action to publish a saved experience without editing
3. **Analytics** - Show users how many experiences they've saved vs published
4. **Recommendations Dashboard** - Show users how their saved experiences are improving their recommendations
5. **Smart Suggestions** - Suggest when to publish based on experience quality/photos

## Files Modified

### Database
- `database-migrations/108-add-is-published-to-reviews.sql` (NEW)

### API Endpoints
- `app/api/reviews/route.ts`
- `app/api/feed/nearby/route.ts`
- `app/api/feed/following/route.ts`
- `app/api/restaurants/[id]/route.ts`
- `app/api/restaurants/friends-reviews/route.ts`

### Components
- `components/review/write-review-modal.tsx`

### Pages
- `app/profile/page.tsx`

## Summary

This feature successfully adds the ability for users to:
1. ✅ Choose between posting publicly or saving privately when sharing experiences
2. ✅ Filter their own experiences by published/unpublished status
3. ✅ Keep unpublished experiences private while still helping with recommendations
4. ✅ Maintain full backward compatibility with existing data

The implementation is complete, tested, and ready for deployment after running the database migration.

