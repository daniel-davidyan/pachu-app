# 🚀 Quick Start - Instagram-like Feed

## ⚡ 3-Minute Setup

### Step 1: Run Database Migration (30 seconds)
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `database-migrations/02-feed-functions.sql`
3. Click "Run"

### Step 2: Add Test Data (1 minute)
```sql
-- Quick test restaurant (Tel Aviv)
INSERT INTO restaurants (name, address, location, image_url, average_rating, price_level, cuisine_types)
VALUES (
  'Test Restaurant',
  'Dizengoff St, Tel Aviv',
  ST_SetSRID(ST_MakePoint(34.7818, 32.0853), 4326),
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
  4.5, 2, ARRAY['Italian']
);

-- Quick test review (replace YOUR_USER_ID)
INSERT INTO reviews (user_id, restaurant_id, rating, content)
SELECT 
  'YOUR_USER_ID',
  id,
  5,
  'Great food and atmosphere!'
FROM restaurants WHERE name = 'Test Restaurant';
```

### Step 3: Start App (30 seconds)
```bash
npm run dev
```

### Step 4: Test Feed (1 minute)
1. Navigate to `http://localhost:3000/feed`
2. Grant location permission
3. Click a review card → Opens full-screen
4. **Swipe right** → Returns to feed
5. **Swipe left** → Next review

## ✅ What You Get

✨ **Real Data** - Reviews from your database  
🔄 **Infinite Scroll** - Loads more as you scroll  
📱 **Full-Screen View** - Instagram-style viewer  
👆 **Swipe Gestures** - Right=close, Left=next  
❤️ **Like/Unlike** - Syncs with database  
📍 **Location-Based** - Shows nearby restaurants  
👥 **Friend Priority** - Friends' reviews first  

## 🎮 Controls

### Mobile
- **Tap** card → Open full-screen
- **Swipe Right** → Close viewer
- **Swipe Left** → Next review
- **Tap** heart → Like/unlike
- **Scroll** down → Load more

### Desktop
- **Click** card → Open full-screen
- **Escape** → Close viewer
- **Arrow Left** → Previous review
- **Arrow Right** → Next review
- **Click** heart → Like/unlike

## 📁 Key Files

| File | Purpose |
|------|---------|
| `app/feed/page.tsx` | Main feed page |
| `components/feed/full-screen-review-viewer.tsx` | Full-screen viewer |
| `app/api/feed/nearby/route.ts` | Feed API endpoint |
| `app/api/reviews/like/route.ts` | Like/unlike API |
| `database-migrations/02-feed-functions.sql` | PostGIS functions |

## 🎯 Quick Customization

### Change Search Radius
```typescript
// app/api/feed/nearby/route.ts (line 17)
const radius = parseInt(searchParams.get('radius') || '10000'); // 10km
```

### Change Page Size
```typescript
// app/api/feed/nearby/route.ts (line 16)
const limit = parseInt(searchParams.get('limit') || '10'); // reviews per page
```

### Change Swipe Sensitivity
```typescript
// components/feed/full-screen-review-viewer.tsx (line 43)
const minSwipeDistance = 50; // pixels
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| No reviews showing | Add test data (see Step 2 above) |
| Location error | Check browser permissions |
| Swipe not working | Use DevTools device emulation |
| "Unauthorized" | Make sure you're logged in |
| Images broken | Verify image URLs are valid |

## 📚 Full Documentation

- **Setup Guide**: `FEED_IMPROVEMENTS_GUIDE.md`
- **Testing Guide**: `FEED_TESTING_GUIDE.md`
- **Full Summary**: `FEED_IMPLEMENTATION_SUMMARY.md`

## 🎉 That's It!

You now have an Instagram-like feed with:
- ✅ Real restaurant reviews
- ✅ Infinite scroll loading
- ✅ Full-screen swipeable view
- ✅ Location-based filtering
- ✅ Like/unlike functionality

**Enjoy your new feed!** 🚀

