# Restaurant Reviews Display Priority Fix

## Problem
On the restaurant/place page, users were seeing Google reviews with "No photos yet" placeholder images, even when those reviews had no actual photos. This created a poor user experience.

## Requirements
1. **Priority 1**: Show reviews from users that the current user is following (friends)
2. **Priority 2**: If no friend reviews exist, show Google reviews BUT only those with actual photos
3. **Priority 3**: If no Google reviews with photos, show all user reviews (including the user's own)
4. The "No photos yet" placeholder should only appear for the user's own reviews when they haven't uploaded photos

## Solution

### Changes Made to `app/api/restaurants/[id]/route.ts`

#### 1. For Google Places (not yet in database)
- Added logic to prioritize friend reviews over Google reviews
- Filter Google reviews to only show those with actual photos
- Map Google photo references to proper photo URLs
- Fall back to all user reviews (including own) if no friend reviews or Google reviews with photos exist

**Key Code Section (lines 217-263):**
```typescript
// Determine which reviews to show
let reviewsToShow: any[] = [];

// If we have reviews from following users (friends), show only those
if (user && followingIds.length > 0) {
  const friendReviews = ourReviews.filter(review => followingIds.includes(review.user.id));
  if (friendReviews.length > 0) {
    reviewsToShow = friendReviews;
  }
}

// If no friend reviews or user not logged in, show Google reviews with photos only
if (reviewsToShow.length === 0 && googleData.reviews) {
  reviewsToShow = (googleData.reviews || [])
    .filter((review: any) => {
      // Only show Google reviews that have photos
      return review.photos && review.photos.length > 0;
    })
    .map((review: any) => ({
      // ... map Google review data
      // Map Google photos to photo URLs
      photos: (review.photos || []).map((photo: any) => 
        photo.photo_reference 
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`
          : null
      ).filter((url: string | null) => url !== null),
    }));
}

// If still no reviews to show, include all our reviews (including user's own)
if (reviewsToShow.length === 0) {
  reviewsToShow = ourReviews;
}
```

#### 2. For Restaurants in Database
- Added similar logic to prioritize friend reviews
- If logged in and following users, show only friend reviews when available
- Otherwise show all reviews

**Key Code Section (lines 356-381):**
```typescript
const allReviews = reviewsData?.map((review: any) => {
  // ... map review data
}) || [];

// Prioritize friend reviews if user is logged in
let reviews = allReviews;
if (user) {
  const { data: followingData } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id);

  const followingIds = followingData?.map(f => f.following_id) || [];
  
  if (followingIds.length > 0) {
    const friendReviews = allReviews.filter(review => followingIds.includes(review.user.id));
    // If there are friend reviews, show only those, otherwise show all
    if (friendReviews.length > 0) {
      reviews = friendReviews;
    }
  }
}
```

## User Experience Flow

### Scenario 1: User with Friends
1. User opens restaurant page
2. System checks if user is following anyone
3. If friends have reviewed this place → Show only friend reviews
4. If friends haven't reviewed → Show Google reviews with photos
5. If no Google reviews with photos → Show all reviews including user's own

### Scenario 2: User without Friends / Not Logged In
1. User opens restaurant page
2. System shows Google reviews with photos only
3. If no Google reviews with photos → Show all user reviews

### Scenario 3: User's Own Review Without Photos
1. User sees their own review with the nice gradient placeholder from the feed
2. This only happens when:
   - No friend reviews exist for this restaurant
   - No Google reviews with photos exist
   - User has created a review without uploading photos

## Visual Treatment

### Google Reviews (with photos)
- Display actual Google photos from the API
- Transform photo references to full URLs using Google Places API

### User Reviews from Friends (with photos)
- Display uploaded photos from our database
- Use nice gradient placeholders if friend's review has no photos

### User's Own Review (no photos)
- Display the same beautiful gradient placeholders used in the feed
- Gradients include: orange→pink, purple→indigo, blue→cyan, violet→purple, fuchsia→pink
- Each includes an icon (utensils, chef hat, sparkles, star)

## Testing Checklist

- [ ] Logged in user with friends who reviewed → See friend reviews only
- [ ] Logged in user without friends who reviewed → See Google reviews with photos
- [ ] Not logged in user → See Google reviews with photos
- [ ] Restaurant with no reviews → Empty state
- [ ] User's own review without photos → See gradient placeholder
- [ ] Google reviews without photos → Should not appear in feed

## Notes

- Google reviews always come with `photos: []` in our previous implementation
- Now we properly fetch and map Google photo references to URLs
- The placeholder logic in `PostCard` and `FeedExperienceCard` already handles the gradient placeholders correctly
- This fix ensures "No photos yet" only shows for user's own reviews, not Google reviews

