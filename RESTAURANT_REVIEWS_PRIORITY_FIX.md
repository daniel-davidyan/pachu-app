# Restaurant Reviews Display Priority Fix

## Problem
On the restaurant/place page, users were seeing Google reviews with "No photos yet" placeholder images, even when those reviews had no actual photos. This created a poor user experience.

## Requirements
1. **Priority 1**: Show reviews from users that the current user is following (friends) - BUT ONLY if friends have actually reviewed
2. **Priority 2**: If friends haven't reviewed, show Google reviews (with photos if available, with gradient placeholders if not)
3. **Priority 3**: If no Google reviews exist, show user's own reviews
4. **Never show "No experiences yet"** if Google reviews are available - always prefer showing something over nothing

## Solution

### Changes Made to `app/api/restaurants/[id]/route.ts`

#### 1. For Google Places (not yet in database)
- Added logic to prioritize friend reviews over Google reviews
- Filter Google reviews to only show those with actual photos
- Map Google photo references to proper photo URLs
- Fall back to all user reviews (including own) if no friend reviews or Google reviews with photos exist

**Key Code Section (lines 217-290):**
```typescript
// Determine which reviews to show - Priority system:
// 1. Friend reviews (if they exist)
// 2. Google reviews with photos (if friend reviews don't exist)
// 3. User's own reviews (if nothing else exists)
let reviewsToShow: any[] = [];

// Check for friend reviews first
if (user && followingIds.length > 0) {
  const friendReviews = ourReviews.filter(review => followingIds.includes(review.user.id));
  if (friendReviews.length > 0) {
    // Friends have reviewed - show only their reviews
    reviewsToShow = friendReviews;
  }
}

// If no friend reviews (or user not logged in), try Google reviews with photos
if (reviewsToShow.length === 0 && googleData.reviews && googleData.reviews.length > 0) {
  const googleReviewsWithPhotos = (googleData.reviews || [])
    .filter((review: any) => review.photos && review.photos.length > 0)
    .map((review: any) => ({
      // ... map with actual photos
    }));
  
  if (googleReviewsWithPhotos.length > 0) {
    reviewsToShow = googleReviewsWithPhotos;
  } else {
    // No Google reviews with photos - show all Google reviews with gradient placeholders
    reviewsToShow = (googleData.reviews || [])
      .map((review: any) => ({
        // ... map with photos: [] for gradient placeholders
      }));
  }
}

// Last resort: show user's own reviews if they exist
if (reviewsToShow.length === 0 && ourReviews.length > 0) {
  reviewsToShow = ourReviews;
}
```

#### 2. For Restaurants in Database
- Added similar logic to prioritize friend reviews
- If logged in and following users, show only friend reviews when available
- Otherwise show all reviews

**Key Code Section (lines 356-386):**
```typescript
const allReviews = reviewsData?.map((review: any) => {
  // ... map review data
}) || [];

// Prioritize friend reviews if user is logged in
// But if friends haven't reviewed, show all reviews (don't leave empty)
let reviews = allReviews;
if (user && allReviews.length > 0) {
  const { data: followingData } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id);

  const followingIds = followingData?.map(f => f.following_id) || [];
  
  if (followingIds.length > 0) {
    const friendReviews = allReviews.filter(review => followingIds.includes(review.user.id));
    // Only show friend reviews if they exist, otherwise show all reviews
    if (friendReviews.length > 0) {
      reviews = friendReviews;
    }
    // If friendReviews.length === 0, keep showing all reviews (don't filter)
  }
}
```

## User Experience Flow

### Scenario 1: User with Friends Who Reviewed
1. User opens restaurant page
2. System checks if user is following anyone
3. Friends have reviewed this place → **Show ONLY friend reviews**

### Scenario 2: User with Friends Who Haven't Reviewed
1. User opens restaurant page
2. System checks if user is following anyone
3. Friends exist but haven't reviewed this place
4. → **Show Google reviews** (with photos if available, with gradient placeholders if not)
5. → **Never show "No experiences yet"** if Google reviews exist

### Scenario 3: User without Friends / Not Logged In
1. User opens restaurant page
2. → **Show Google reviews** (prefer those with photos, but show all if needed)
3. If no Google reviews → Show user's own reviews
4. If nothing exists → Show empty state

### Scenario 4: Restaurant with No Reviews at All
1. User opens restaurant page
2. No friend reviews, no Google reviews, no user reviews
3. → **Show "No experiences yet" empty state**

## Visual Treatment

### Google Reviews (with or without photos)
- **With photos**: Display actual Google photos from the API (transform photo references to full URLs)
- **Without photos**: Display beautiful gradient placeholders (same as user reviews)
- **Key point**: Google reviews are ALWAYS shown if friends haven't reviewed, never "No experiences yet"

### User Reviews from Friends (with photos)
- Display uploaded photos from our database
- Use nice gradient placeholders if friend's review has no photos

### User's Own Review (no photos)
- Display the same beautiful gradient placeholders used in the feed
- Gradients include: orange→pink, purple→indigo, blue→cyan, violet→purple, fuchsia→pink
- Each includes an icon (utensils, chef hat, sparkles, star)

## Testing Checklist

- [ ] Logged in user with friends who reviewed → See friend reviews only ✅
- [ ] Logged in user with friends who HAVEN'T reviewed → See Google reviews (not "No experiences yet") ✅
- [ ] Not logged in user → See Google reviews ✅
- [ ] Restaurant with no reviews at all → Empty state "No experiences yet" ✅
- [ ] Google reviews with photos → See actual photos ✅
- [ ] Google reviews without photos → See gradient placeholders ✅
- [ ] User's own review without photos → See gradient placeholder ✅

## Notes

- The key insight: **"No experiences yet" should ONLY appear when there are truly no reviews from any source**
- Google reviews can have photos (show them) or no photos (show gradient placeholders)
- Friend reviews take priority ONLY when they actually exist
- If friends haven't reviewed, we fall back to Google reviews to keep the page populated
- The placeholder logic in `PostCard` and `FeedExperienceCard` already handles the gradient placeholders correctly
- This fix ensures users always see content when it's available, rather than empty states

