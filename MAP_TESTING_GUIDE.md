# Map Tab Testing Guide

## 🧪 How to Test the New Features

### Prerequisites
- Dev server running (`npm run dev`)
- Valid Google Places API key in `.env.local`
- Valid Mapbox token in `.env.local`

### Test 1: Lazy Loading ✅

**Steps:**
1. Navigate to `/map`
2. Wait for initial restaurants to load
3. Pan the map to a new area
4. Watch for "Loading places..." indicator
5. Verify new markers appear

**Expected:**
- Loading indicator appears when moving to new areas
- New restaurants load automatically
- No duplicate restaurants
- Grid-based loading (same area won't reload)

### Test 2: Clustering System ✅

**Steps:**
1. Zoom out to level 8-10 (city view)
2. Observe large colorful circles with numbers
3. Click a cluster
4. Zoom in automatically
5. Watch cluster expand into smaller clusters
6. Keep zooming until you see individual markers

**Expected:**
- **Zoom < 10**: Large clusters (~50+ restaurants)
- **Zoom 10-12**: Medium clusters (~10-20 restaurants)
- **Zoom 12-14**: Small clusters (~2-5 restaurants)
- **Zoom ≥ 14**: Individual colorful markers
- Smooth transitions between states
- Clusters have gradient colors

### Test 3: Icon System ✅

**Steps:**
1. Zoom in to see individual markers (zoom ≥ 14)
2. Look for different colored icons
3. Verify icons match cuisine types:
   - ☕ Brown/cream for coffee shops
   - 🍕 Red for pizza/Italian
   - 🍣 Red for sushi/Japanese
   - 🥡 Orange for Chinese/Asian
   - 🍔 Yellow for burgers
   - 🌮 Orange for Mexican
   - 🍛 Yellow for Indian
   - 🧁 Pink for bakeries/desserts
   - 🍺 Orange for bars
   - 🦐 Cyan for seafood
   - 🥩 Dark red for steakhouses
   - 🍜 Red for Thai
   - 🥙 Green for Mediterranean
   - 🥐 Brown for French
   - 🍲 Amber for Vietnamese
   - 🍱 Red for Korean
   - 🥞 Amber for breakfast
   - 🥗 Green for vegan

**Expected:**
- Each marker has appropriate emoji
- Rating displayed next to emoji
- Color-coded backgrounds
- White border with shadow

### Test 4: Visual Design ✅

**Steps:**
1. Check category pills at top
2. Hover over category pills
3. Click active category (Restaurants)
4. Hover over markers
5. Click location button
6. Observe loading states

**Expected:**
- Category pills are colorful with themed colors
- Hover effects: scale + shadow
- Active category has colored background/border
- Markers lift on hover
- Location button has gradient (pink to orange)
- Loading indicators have gradients
- Smooth animations throughout

### Test 5: Marker Interactions ✅

**Steps:**
1. Click an individual marker
2. View restaurant card
3. Close card
4. Hover over markers
5. Click cluster marker

**Expected:**
- Individual markers open restaurant card
- Smooth card slide-up animation
- Hover shows lift + scale effect
- Cluster markers zoom in on click
- All interactions smooth (60fps)

### Test 6: Performance ✅

**Steps:**
1. Pan map rapidly
2. Zoom in/out multiple times
3. Open/close restaurant cards
4. Check console for errors
5. Monitor network tab

**Expected:**
- No lag or stuttering
- Efficient API calls (no duplicates)
- Markers render smoothly
- Transitions are fluid
- No memory leaks

## 🎨 Visual Checklist

### Map Elements
- [ ] Map uses `streets-v12` style (more colorful)
- [ ] Background has subtle gradient
- [ ] Category pills are colorful
- [ ] Location button has gradient
- [ ] Loading indicators have gradients

### Markers
- [ ] Individual markers are colorful pills
- [ ] Clusters are gradient circles
- [ ] Icons match cuisine types
- [ ] Ratings displayed correctly
- [ ] Shadows and borders visible
- [ ] Animations smooth

### Interactions
- [ ] Hover effects work
- [ ] Click handlers work
- [ ] Zoom transitions smooth
- [ ] Pan updates markers
- [ ] Loading states show

## 🐛 Common Issues

### Issue: No markers appearing
**Solution:** Check Google Places API key and quota

### Issue: Markers not clustering
**Solution:** Zoom out further (< 14)

### Issue: Lazy loading not working
**Solution:** Check console for API errors, verify network connection

### Issue: Wrong icons
**Solution:** Check cuisineTypes data from API

### Issue: Performance issues
**Solution:** Clear browser cache, check for console errors

## 📊 Success Metrics

### Functionality
- ✅ Lazy loading works on pan
- ✅ Clustering based on zoom
- ✅ 18+ icon types display
- ✅ Color coding works
- ✅ Animations smooth

### Performance
- ✅ < 500ms API response
- ✅ 60fps animations
- ✅ No duplicate loads
- ✅ Efficient rendering

### UX
- ✅ Clear visual feedback
- ✅ Intuitive interactions
- ✅ Beautiful design
- ✅ Consistent theming

## 🎯 Browser Compatibility

Test in:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile Safari (iOS)
- ✅ Mobile Chrome (Android)

## 📱 Mobile Testing

Special focus on:
- Touch interactions
- Pinch to zoom
- Pan gestures
- Performance on slower devices
- Loading states on slow network

---

**Testing Status**: Ready for QA
**Last Updated**: December 5, 2025

