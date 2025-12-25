# Restaurant Reviews Display Priority Fix

## Problem
On the restaurant/place page, users were seeing:
1. Google reviews with "No photos yet" placeholder images
2. "No experiences yet" empty state even when Google reviews existed
3. No indication when they were seeing reviews from non-friends

## Requirements
1. **Priority 1**: Show reviews from users that the current user is following (friends) - BUT ONLY if friends have actually reviewed
2. **Priority 2**: If friends haven't reviewed, show Google reviews (with photos if available, with gradient placeholders if not)
3. **Priority 3**: If no Google reviews exist, show user's own reviews
4. **Never show "No experiences yet"** if Google reviews are available - always prefer showing something over nothing
5. **Inform users** when they're seeing Google/non-friend reviews because their friends haven't shared experiences yet

## Solution

### Changes Made

#### 1. Backend API: `app/api/restaurants/[id]/route.ts`
- Added smart priority system for review display
- Added flags `showingGoogleReviews` and `showingNonFriendReviews` to inform frontend
- Filter logic ensures users always see content when available

#### 2. Frontend Page: `app/restaurant/[id]/page.tsx`
- Added state management for review display flags
- Added informational banner to notify users when seeing Google/non-friend reviews
- Banner includes helpful messaging to encourage sharing their own experience

### API Response Structure

The API now returns additional flags:
```typescript
{
  restaurant: Restaurant,
  reviews: Review[],
  friendsWhoReviewed: Friend[],
  isWishlisted: boolean,
  showingGoogleReviews?: boolean,      // True when user has friends but they haven't reviewed
  showingNonFriendReviews?: boolean,   // True when showing non-friend reviews from database
}
```

### Frontend Info Banner

When `showingGoogleReviews` or `showingNonFriendReviews` is true, the page displays a helpful banner:

```
┌─────────────────────────────────────────────────────────┐
│ 👥  None of your friends have shared their experience   │
│     here yet                                            │
│                                                         │
│     We're showing reviews from Google to help you       │
│     discover this place. Be the first of your friends   │
│     to share your experience!                           │
└─────────────────────────────────────────────────────────┘
```

The banner:
- Uses a friendly blue color scheme (blue-50 background, blue-200 border)
- Shows a Users icon for visual clarity
- Provides context about why they're seeing these reviews
- Encourages them to be the first to share their experience

## Code Examples

### Backend Code (API)

**For Google Places (lines 217-296):**
```typescript
let reviewsToShow: any[] = [];
let showingGoogleReviews = false;
let hasFollowing = false;

// Check for friend reviews first
if (user && followingIds.length > 0) {
  hasFollowing = true;
  const friendReviews = ourReviews.filter(review => followingIds.includes(review.user.id));
  if (friendReviews.length > 0) {
    reviewsToShow = friendReviews;
  }
}

// If no friend reviews, try Google reviews
if (reviewsToShow.length === 0 && googleData.reviews && googleData.reviews.length > 0) {
  showingGoogleReviews = true;
  // Try Google reviews with photos first
  const googleReviewsWithPhotos = filterAndMapGoogleReviews(true);
  
  if (googleReviewsWithPhotos.length > 0) {
    reviewsToShow = googleReviewsWithPhotos;
  } else {
    // Show all Google reviews with gradient placeholders
    reviewsToShow = filterAndMapGoogleReviews(false);
  }
}

// Last resort: user's own reviews
if (reviewsToShow.length === 0 && ourReviews.length > 0) {
  reviewsToShow = ourReviews;
}

return {
  reviews: reviewsToShow,
  showingGoogleReviews: hasFollowing && showingGoogleReviews, // Only true if has friends who haven't reviewed
  // ... other data
};
```

**For Database Restaurants (lines 402-432):**
```typescript
let reviews = allReviews;
let showingNonFriendReviews = false;

if (user && allReviews.length > 0) {
  const followingIds = await getFollowingIds();
  
  if (followingIds.length > 0) {
    const friendReviews = allReviews.filter(review => followingIds.includes(review.user.id));
    
    if (friendReviews.length > 0) {
      reviews = friendReviews;
    } else {
      // Friends haven't reviewed, showing all reviews
      showingNonFriendReviews = true;
    }
  }
}

return {
  reviews,
  showingNonFriendReviews,
  // ... other data
};
```

### Frontend Code (UI)

**Restaurant Page Banner:**
```tsx
{(showingGoogleReviews || showingNonFriendReviews) && reviews.length > 0 && (
  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
        <Users className="w-5 h-5 text-blue-600" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-blue-900 mb-1">
          None of your friends have shared their experience here yet
        </p>
        <p className="text-xs text-blue-700">
          {showingGoogleReviews 
            ? "We're showing reviews from Google to help you discover this place. Be the first of your friends to share your experience!"
            : "We're showing all available reviews to help you discover this place. Be the first of your friends to share your experience!"
          }
        </p>
      </div>
    </div>
  </div>
)}
```

## User Experience Flow

### Scenario 1: User with Friends Who Reviewed
1. User opens restaurant page
2. System checks if user is following anyone
3. Friends have reviewed this place → **Show ONLY friend reviews**
4. **No banner** is shown (seeing friend content)

### Scenario 2: User with Friends Who Haven't Reviewed
1. User opens restaurant page
2. System checks if user is following anyone
3. Friends exist but haven't reviewed this place
4. → **Show info banner** explaining why they're seeing Google/non-friend reviews
5. → **Show Google reviews** (with photos if available, with gradient placeholders if not)
6. → **Never show "No experiences yet"** if Google reviews exist

### Scenario 3: User without Friends / Not Logged In
1. User opens restaurant page
2. → **Show Google reviews** (prefer those with photos, but show all if needed)
3. **No banner** is shown (no friends to notify about)
4. If no Google reviews → Show user's own reviews
5. If nothing exists → Show empty state

### Scenario 4: Restaurant with No Reviews at All
1. User opens restaurant page
2. No friend reviews, no Google reviews, no user reviews
3. → **Show "No experiences yet" empty state**

## Visual Treatment

### Info Banner (New Feature!)
- **Background**: Blue-50 with blue-200 border
- **Icon**: Users icon in blue-100 circle
- **Title**: "None of your friends have shared their experience here yet"
- **Message**: Contextual based on review type (Google vs database reviews)
- **Call-to-action**: Encourages user to be first to share

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

- [ ] Logged in user with friends who reviewed → See friend reviews only, no banner ✅
- [ ] Logged in user with friends who HAVEN'T reviewed → See banner + Google reviews ✅
- [ ] Banner text is clear and encouraging ✅
- [ ] Not logged in user → See Google reviews, no banner ✅
- [ ] Restaurant with no reviews at all → Empty state "No experiences yet" ✅
- [ ] Google reviews with photos → See actual photos ✅
- [ ] Google reviews without photos → See gradient placeholders ✅
- [ ] User's own review without photos → See gradient placeholder ✅

## Benefits

1. **User Transparency**: Users understand why they're seeing certain reviews
2. **Encouragement**: Banner encourages users to be first among friends to review
3. **Social Discovery**: Emphasizes the social aspect of the app
4. **Never Empty**: Users always see content when available, improving experience
5. **Context**: Clear explanation prevents confusion about review sources

## Notes

- The key insight: **"No experiences yet" should ONLY appear when there are truly no reviews from any source**
- Google reviews can have photos (show them) or no photos (show gradient placeholders)
- Friend reviews take priority ONLY when they actually exist
- If friends haven't reviewed, we fall back to Google reviews to keep the page populated
- The banner only shows when user has following but friends haven't reviewed (providing meaningful context)
- This fix ensures users always see content when it's available, rather than empty states
- The social context encourages engagement and sharing
