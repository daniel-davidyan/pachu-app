# Quick Setup: Feed Dummy Data

## Step 1: Find Your User ID

Run this in Supabase SQL Editor:

```sql
SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL_HERE';
```

Copy the result (it looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

---

## Step 2: Copy This SQL and Replace YOUR_USER_ID

Open `database-migrations/03-feed-following-dummy-data.sql`, find all instances of `YOUR_USER_ID`, and replace with your actual user ID from Step 1.

**Quick Find & Replace:**
- Find: `'YOUR_USER_ID'`
- Replace with: `'a1b2c3d4-e5f6-7890-abcd-ef1234567890'` (your actual ID with quotes)

---

## Step 3: Run the SQL

1. Open Supabase Dashboard → SQL Editor
2. Paste the modified SQL
3. Click "Run"

---

## What This Creates:

### 5 Dummy Friends:
- 👤 **Daniel Davidyan** (danieldavidyan)
- 👤 **Rotem Cohen** (rotemcohen)
- 👤 **Nir Shvili** (nirshvili)
- 👤 **Amit Chimya** (amitchimya)
- 👤 **Aviv Samir** (avivsamir)

### 6 Restaurants in Tel Aviv:
- 🍽️ **Mela** - Mediterranean, Israeli (92% match)
- 🍻 **Shiner** - Bar, Pub (86% match)
- ☕ **Port Said** - Breakfast, Brunch (95% match)
- 🥘 **Taizu** - Asian Fusion (89% match)
- 🦐 **Ouzeria** - Greek, Seafood (91% match)
- 🌊 **Manta Ray** - Beachfront, Seafood (93% match)

### 20+ Reviews:
Reviews from your friends about these restaurants, just like in the image you shared!

---

## After Running:

Go to `http://localhost:3000/feed` and click the **"Following"** tab.

You should see all 6 restaurants with:
- ✅ Photos
- ✅ Match percentages
- ✅ Mutual friends (showing which friends reviewed each place)
- ✅ Review carousels
- ✅ Distance from you

---

## Example Result:

**Mela** - 92% match  
_"Daniel Davidyan, Rotem Cohen and 2 more mutual friends liked it"_
- 420m from you
- Reviews carousel with 5 reviews
- Wishlist button + Add Review button

---

## Verification:

After running the migration, you can verify with:

```sql
-- Check follows
SELECT * FROM follows WHERE follower_id = 'YOUR_USER_ID';
-- Should return 5 rows

-- Check restaurants
SELECT name FROM restaurants WHERE id LIKE '10000000%';
-- Should return 6 restaurants

-- Check reviews
SELECT COUNT(*) FROM reviews WHERE user_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555'
);
-- Should return 15+ reviews
```

---

## Troubleshooting:

**"No restaurants showing"**
- Make sure you replaced YOUR_USER_ID with your actual ID
- Check that the SQL ran without errors
- Verify you're logged in with the same account

**"Error: duplicate key value"**
- The data already exists! You're good to go.
- Just refresh the feed page

**"Can't find my user ID"**
- Make sure you're logged in
- Try: `SELECT * FROM auth.users;` to see all users
- Use the ID corresponding to your email

---

## 🎉 That's It!

Once completed, your "Following" feed will be populated with beautiful restaurant cards from your dummy friends!


