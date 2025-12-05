# Feed Testing Guide

## Quick Start Testing

Follow these steps to test the new Instagram-like feed with real data.

## Prerequisites

1. ✅ Database schema is set up (see `DATABASE_SCHEMA.md`)
2. ✅ Feed functions are created (run `database-migrations/02-feed-functions.sql`)
3. ✅ You have at least one user account

## Step 1: Create Sample Data

Run this SQL in your Supabase SQL Editor to create test data:

```sql
-- Step 1: Get your user ID
-- Replace 'your-email@example.com' with your actual email
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
-- Copy the UUID from the result - you'll use it below

-- Step 2: Create a test restaurant near Tel Aviv (or your location)
INSERT INTO restaurants (
  name,
  address,
  location,
  image_url,
  average_rating,
  total_reviews,
  price_level,
  cuisine_types,
  google_place_id
) VALUES (
  'Pasta Paradise',
  '123 Dizengoff St, Tel Aviv',
  ST_SetSRID(ST_MakePoint(34.7818, 32.0853), 4326), -- Tel Aviv coordinates
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80', -- Sample pasta image
  4.5,
  0, -- Will be updated by trigger
  2,
  ARRAY['Italian', 'Pasta', 'Mediterranean'],
  'test_place_id_001'
);

-- Step 3: Get the restaurant ID
SELECT id, name FROM restaurants WHERE name = 'Pasta Paradise';
-- Copy the UUID from the result

-- Step 4: Create a review
-- Replace YOUR_USER_ID and YOUR_RESTAURANT_ID with the UUIDs from above
INSERT INTO reviews (
  user_id,
  restaurant_id,
  rating,
  content
) VALUES (
  'YOUR_USER_ID', -- Replace with your user ID from Step 1
  'YOUR_RESTAURANT_ID', -- Replace with restaurant ID from Step 3
  5,
  'Amazing pasta! The carbonara was perfectly creamy and the atmosphere was fantastic. Highly recommend for a romantic dinner. The service was impeccable and the wine selection was impressive.'
);

-- Step 5: Add a photo to the review (optional)
-- First get the review ID
SELECT id FROM reviews WHERE user_id = 'YOUR_USER_ID' AND restaurant_id = 'YOUR_RESTAURANT_ID';

-- Then add a photo
INSERT INTO review_photos (
  review_id,
  photo_url,
  sort_order
) VALUES (
  'YOUR_REVIEW_ID', -- Replace with review ID from above
  'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800&q=80',
  0
);

-- Step 6: Create more test restaurants for variety
INSERT INTO restaurants (name, address, location, image_url, average_rating, price_level, cuisine_types) VALUES
  ('Sushi Master', '45 Ben Yehuda St, Tel Aviv', ST_SetSRID(ST_MakePoint(34.7720, 32.0809), 4326), 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80', 4.8, 3, ARRAY['Japanese', 'Sushi']),
  ('Burger Joint', '78 Rothschild Blvd, Tel Aviv', ST_SetSRID(ST_MakePoint(34.7740, 32.0668), 4326), 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 4.2, 1, ARRAY['American', 'Burgers']),
  ('Vegan Delight', '12 Allenby St, Tel Aviv', ST_SetSRID(ST_MakePoint(34.7750, 32.0692), 4326), 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80', 4.6, 2, ARRAY['Vegan', 'Healthy']),
  ('Hummus Heaven', '89 King George St, Tel Aviv', ST_SetSRID(ST_MakePoint(34.7771, 32.0746), 4326), 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80', 4.9, 1, ARRAY['Middle Eastern', 'Israeli']);

-- Step 7: Create reviews for these restaurants
-- Get restaurant IDs first
SELECT id, name FROM restaurants ORDER BY created_at DESC LIMIT 5;

-- Add a review for each (replace IDs accordingly)
INSERT INTO reviews (user_id, restaurant_id, rating, content) VALUES
  ('YOUR_USER_ID', (SELECT id FROM restaurants WHERE name = 'Sushi Master'), 5, 'Best sushi in Tel Aviv! Fresh fish, creative rolls, and excellent presentation.'),
  ('YOUR_USER_ID', (SELECT id FROM restaurants WHERE name = 'Burger Joint'), 4, 'Great burgers at a good price. The fries are amazing!'),
  ('YOUR_USER_ID', (SELECT id FROM restaurants WHERE name = 'Vegan Delight'), 5, 'Even as a meat-eater, I was blown away. The mushroom burger is incredible.'),
  ('YOUR_USER_ID', (SELECT id FROM restaurants WHERE name = 'Hummus Heaven'), 5, 'The best hummus I have ever had. Period. Go early because it gets crowded!');
```

## Step 2: Test Location-Based Filtering

### Option A: Use Your Real Location
1. Open the app in a browser
2. Navigate to `/feed`
3. Grant location permissions when prompted
4. The feed should show restaurants within 10km of your location

### Option B: Use Tel Aviv Test Location
If you're not in Tel Aviv, modify the default location in `app/feed/page.tsx`:

```typescript
// Around line 61
setUserLocation({ latitude: 32.0853, longitude: 34.7818 });
```

## Step 3: Test Core Features

### ✅ Infinite Scroll
1. Scroll down to the bottom of the feed
2. You should see a loading spinner
3. More reviews should load automatically
4. If you have < 10 reviews, try adding more test data

### ✅ Full-Screen Viewer
1. Click on any review card
2. It should open in full-screen mode
3. Verify:
   - User info at the top
   - Restaurant image fills the screen
   - Restaurant details at the bottom
   - Like/Comment/Share buttons work
   - Progress dots show at the bottom

### ✅ Swipe Gestures (Mobile or DevTools)
1. Open DevTools (F12)
2. Enable device emulation (toggle device toolbar)
3. Select a mobile device
4. Reload the page
5. Click a review to open full-screen
6. Try swiping:
   - **Swipe Right**: Should close the viewer
   - **Swipe Left**: Should go to next review
7. Verify swipe hint at the bottom

### ✅ Keyboard Navigation (Desktop)
1. Click a review to open full-screen
2. Press:
   - **Escape**: Close viewer
   - **Arrow Left**: Previous review
   - **Arrow Right**: Next review

### ✅ Like/Unlike
1. Click the heart icon on any review
2. Heart should turn red and fill
3. Like count should increment
4. Click again to unlike
5. Heart should turn gray
6. Like count should decrement
7. Verify in Supabase that `review_likes` table is updated

## Step 4: Test Edge Cases

### Empty State
1. Delete all reviews from database:
   ```sql
   DELETE FROM reviews WHERE user_id = 'YOUR_USER_ID';
   ```
2. Reload the feed
3. Should show "No reviews yet" message

### No Location Permission
1. Block location in browser settings
2. Reload the feed
3. Should fall back to Tel Aviv location (32.0853, 34.7818)

### Single Review
1. Have only 1 review in database
2. Open in full-screen
3. Verify:
   - No "next" button shows
   - Only 1 progress dot
   - Swipe left does nothing

### Network Error
1. Open DevTools → Network tab
2. Set to "Offline"
3. Reload the feed
4. Should show loading state indefinitely or error message

## Step 5: Test with Friends' Reviews

### Add a Friend
```sql
-- Create another test user (or use an existing one)
-- Get their user ID
SELECT id, email FROM auth.users LIMIT 5;

-- Follow them (replace YOUR_USER_ID and FRIEND_USER_ID)
INSERT INTO follows (follower_id, following_id) VALUES
  ('YOUR_USER_ID', 'FRIEND_USER_ID');

-- Have your friend create a review (or create one as them)
INSERT INTO reviews (user_id, restaurant_id, rating, content) VALUES
  ('FRIEND_USER_ID', (SELECT id FROM restaurants LIMIT 1), 4, 'Had a great time here!');
```

### Verify Friend Prioritization
1. Reload the feed
2. Friends' reviews should appear first
3. Look for the "Friend" badge on review cards

## Step 6: Performance Testing

### Load Time
1. Open DevTools → Network tab
2. Clear cache (hard refresh)
3. Reload the feed
4. Check load times:
   - Initial API call should be < 500ms
   - Images should lazy load
   - Subsequent pages should load quickly

### Memory Usage
1. Open DevTools → Performance Monitor
2. Scroll through the feed multiple times
3. Monitor memory usage
4. Should not have memory leaks

### Smooth Animations
1. Scroll through the feed
2. Open/close full-screen viewer
3. Swipe between reviews
4. All animations should be smooth (60fps)

## Common Issues & Solutions

### Issue: "No reviews near you"
**Solution**: 
- Check that restaurants have valid `location` data
- Try increasing the radius in API call
- Verify your current location in browser console

### Issue: Images not loading
**Solution**:
- Check that image URLs are valid
- Verify CORS settings if using external images
- Use Unsplash or similar for test images

### Issue: Swipe not working
**Solution**:
- Use a touch device or DevTools device emulation
- Check browser console for errors
- Verify touch events are not being blocked

### Issue: "Unauthorized" error
**Solution**:
- Make sure you're logged in
- Check that JWT token is valid
- Clear cookies and re-login

### Issue: Infinite scroll not triggering
**Solution**:
- Add more reviews (need > 10 for pagination)
- Check that `hasMore` is true in API response
- Verify IntersectionObserver is working

## Success Criteria

Your feed is working correctly if:

- ✅ Reviews load based on your location
- ✅ You can scroll infinitely and more reviews load
- ✅ Clicking a review opens full-screen viewer
- ✅ You can swipe right to close, left to next
- ✅ Likes sync with the database
- ✅ Friends' reviews appear first
- ✅ All animations are smooth
- ✅ Works on mobile and desktop
- ✅ Keyboard navigation works

## Next Steps

Once testing is complete, consider:

1. **Add more test data** - The more reviews, the better the experience
2. **Invite friends** - Have real users test the app
3. **Monitor performance** - Check Supabase logs for slow queries
4. **Gather feedback** - Get UX feedback from beta testers
5. **Implement comments** - The placeholder is already there
6. **Add filters** - By cuisine, rating, price level, etc.

## Sample Test Checklist

```
□ Database migrations run successfully
□ Sample restaurants created with valid locations
□ Sample reviews created for restaurants
□ Photos added to reviews
□ Feed loads without errors
□ Location permission handled properly
□ Reviews display correctly
□ Infinite scroll works
□ Full-screen viewer opens on click
□ Swipe gestures work (mobile)
□ Keyboard navigation works (desktop)
□ Like/unlike syncs with database
□ Friend badge shows for friends' reviews
□ Empty state shows when no reviews
□ Loading states work properly
□ No console errors
□ Smooth animations throughout
□ Works on mobile browsers
□ Works on desktop browsers
```

Happy testing! 🎉

