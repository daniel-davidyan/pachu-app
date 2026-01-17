# 🚀 Quick Start - Remove Dummy Data & Test Real Features

## Step 1: Remove Dummy Data (5 minutes)

### Open Supabase Dashboard
1. Go to your Supabase project: https://supabase.com/dashboard
2. Click on your project
3. Click **SQL Editor** in the left sidebar

### Run the Cleanup Script
1. Open this file in your code editor: `database-migrations/99-remove-dummy-data.sql`
2. Copy **ALL** the SQL code (Ctrl+A, Ctrl+C)
3. Paste it into Supabase SQL Editor
4. Click **Run** button (or press Ctrl+Enter)
5. Wait for it to finish (should take 2-3 seconds)

### Verify It Worked
At the bottom of the SQL script output, you should see:
```
Remaining dummy users: 0
Remaining dummy restaurants: 0
Remaining dummy reviews: 0
Remaining dummy follows: 0
```

If all numbers are 0, you're done! ✅

---

## Step 2: Test with Real Accounts (10 minutes)

### Create Test Accounts
1. Open your app: http://localhost:3000
2. Click **Sign Up**
3. Create Account #1:
   - Email: `test1@example.com`
   - Password: `testpass123`
   - Name: `Test User 1`
4. Log out (Settings → Log out)
5. Create Account #2:
   - Email: `test2@example.com`
   - Password: `testpass123`
   - Name: `Test User 2`

---

## Step 3: Test Following (2 minutes)

### From Account #2:
1. Click **Search** tab (bottom nav)
2. Click **Users** tab (top)
3. Search for "Test User 1"
4. Click on Test User 1's profile
5. Click **Follow** button
6. Button should change to "Following" (gray)
7. Follower count should show 1

### Verify:
- ✅ Follow button changes to "Following"
- ✅ Follower count increments
- ✅ No errors in console

---

## Step 4: Test Reviews (5 minutes)

### From Account #1:
1. Click **Map** tab (bottom nav)
2. Click on any restaurant marker
3. Click **Write Review** button
4. Select star rating (e.g., 5 stars)
5. Write review text: "Great place! Love the food."
6. (Optional) Click camera icon to add photos
7. Click **Post Review**
8. Modal should close
9. Go to **Profile** tab
10. You should see your review!

### From Account #2:
1. Repeat steps 1-10 with a different restaurant
2. Go to **Profile** tab
3. You should see your review!

---

## Step 5: Test Following Feed (2 minutes)

### From Account #2:
1. Click **Feed** tab (bottom nav)
2. Click **Following** tab at top
3. You should see Test User 1's review!
4. The card should show:
   - Restaurant name and photo
   - Test User 1's name and avatar
   - 5 star rating
   - Review text: "Great place! Love the food."

### Verify:
- ✅ Following feed shows friend's review
- ✅ Can see restaurant details
- ✅ Can see star rating
- ✅ Can see review text and photos

---

## 🎉 Success!

If all the above worked, your app is ready for real users!

### What's Working:
- ✅ Real user accounts (no dummy data)
- ✅ Follow/unfollow functionality
- ✅ Write reviews with photos
- ✅ Following feed shows friends' reviews
- ✅ Profile stats (followers, following, reviews)

---

## Next Steps

### Option A: Test More Features
- [ ] Add more test accounts
- [ ] Write more reviews
- [ ] Upload photos to reviews
- [ ] Like reviews (click heart icon)
- [ ] Search for restaurants
- [ ] Use AI chat for recommendations
- [ ] Save restaurants to wishlist

### Option B: Deploy to Production
1. Push code to GitHub
2. Deploy to Vercel (or your hosting platform)
3. Set environment variables in hosting dashboard
4. Test production deployment
5. Invite real users!

### Option C: Invite Beta Users
1. Share app URL with 5-10 friends
2. Ask them to:
   - Sign up with real email
   - Follow each other
   - Write at least 2 reviews
   - Test all features
3. Collect feedback
4. Fix any issues
5. Launch publicly!

---

## Troubleshooting

### "No restaurants found" in feed
**Solution:** Make sure location permission is granted. If still no results, increase the distance filter or disable location filter.

### "Following" tab is empty
**Solution:** Your friends need to write reviews first. Write a review from Account #1, then check Account #2's following feed.

### Can't upload photos
**Solution:** Check that `review-photos` storage bucket exists in Supabase. Go to Supabase Dashboard → Storage → Verify bucket exists.

### Follow button not working
**Solution:** Check browser console for errors. Make sure you're logged in. Try refreshing the page.

---

## Getting Help

### Check These First:
1. Browser console (F12) for JavaScript errors
2. Supabase logs for API errors
3. `DATABASE_SCHEMA.md` for database structure
4. `SETUP_REAL_DATA.md` for detailed setup guide
5. `FRIENDS_AND_REVIEWS_GUIDE.md` for feature documentation

### Still Having Issues?
- Check that all environment variables are set in `.env.local`
- Verify Supabase project is active
- Verify Google Maps API key is valid
- Try clearing browser cache
- Try in incognito/private window

---

## 📚 More Documentation

- **Detailed Setup Guide:** `SETUP_REAL_DATA.md`
- **Feature Reference:** `FRIENDS_AND_REVIEWS_GUIDE.md`
- **Database Schema:** `DATABASE_SCHEMA.md`
- **Changes Made:** `CHANGES_SUMMARY.md`

---

## ⏱️ Total Time: ~25 minutes

- Remove dummy data: 5 min
- Create test accounts: 10 min
- Test following: 2 min
- Test reviews: 5 min
- Test following feed: 2 min
- Celebrate: 1 min 🎉

---

**Status:** Ready to use with real data only!  
**Last Updated:** December 10, 2025

