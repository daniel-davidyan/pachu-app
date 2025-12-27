# 🧪 Google Reviews Import - Testing Checklist

## Pre-Testing Setup

- [ ] Ensure Google Places API key is configured in `.env.local`
- [ ] Database migration `108-add-is-published-to-reviews.sql` has been applied
- [ ] User account is created and logged in
- [ ] Prepare test Google Takeout JSON file

## Test Data Preparation

### Option 1: Use Real Google Takeout Data
- [ ] Export your own Google Reviews via Google Takeout
- [ ] Use for realistic end-to-end testing

### Option 2: Create Mock JSON File
Create a test file `test-google-reviews.json`:

```json
{
  "reviews": [
    {
      "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
      "placeName": "Test Restaurant 1",
      "address": "123 Main St, Sydney NSW",
      "rating": 5,
      "comment": "Great food and service!",
      "timestamp": 1640000000000,
      "photos": []
    },
    {
      "placeId": "ChIJ3xxxx",
      "placeName": "Test Restaurant 2", 
      "address": "456 High St, Melbourne VIC",
      "rating": 4,
      "comment": "Really enjoyed the atmosphere.",
      "timestamp": 1650000000000,
      "photos": []
    }
  ]
}
```

---

## 📱 Functional Testing

### Test Case 1: Access Import Feature
- [ ] Navigate to Profile page
- [ ] Verify "Import from Google Reviews" button is visible
- [ ] Button has Google logo and gradient styling
- [ ] Button is clickable

**Expected**: Button appears prominently below bio section

### Test Case 2: Open Import Modal
- [ ] Click the import button
- [ ] Modal opens with smooth animation
- [ ] Modal has Google-branded header
- [ ] Instructions are clear and readable
- [ ] Link to Google Takeout is present and clickable
- [ ] Upload area is visible
- [ ] Close button (X) works

**Expected**: Modal opens centered on screen, bottom nav hidden

### Test Case 3: File Upload - Drag & Drop
- [ ] Drag a JSON file over the upload area
- [ ] Upload area highlights/changes appearance
- [ ] Drop the file
- [ ] File processing begins
- [ ] Loading indicator appears

**Expected**: Visual feedback during drag, smooth upload

### Test Case 4: File Upload - Click to Browse
- [ ] Click on upload area or "Choose File" button
- [ ] File picker dialog opens
- [ ] Select a JSON file
- [ ] File processing begins

**Expected**: Standard file picker behavior, accepts .json files

### Test Case 5: Valid Import - Success Flow
- [ ] Upload valid Google Takeout JSON
- [ ] Processing indicator shows
- [ ] Success message displays
- [ ] Import summary shows:
  - Number imported
  - Number skipped
  - Any errors
- [ ] Info message about unpublished reviews shows
- [ ] "Done" button appears
- [ ] Click "Done" to close modal

**Expected**: Clear success feedback with numbers

### Test Case 6: Verify Imported Reviews
- [ ] Close import modal
- [ ] Navigate to My Experiences tab
- [ ] Click "Saved" filter
- [ ] Imported reviews appear in list
- [ ] Reviews show as "Private" or unpublished
- [ ] Reviews have correct:
  - Restaurant name
  - Rating (stars)
  - Review text
  - Date (from Google)
  - Photos (if any)

**Expected**: All imported reviews visible in Saved tab

### Test Case 7: Publish Imported Review
- [ ] Select an imported review
- [ ] Click edit or options menu
- [ ] Change to published status
- [ ] Save changes
- [ ] Navigate to Published filter
- [ ] Review appears in Published tab
- [ ] Review appears in main feed

**Expected**: Review successfully published and visible

### Test Case 8: Duplicate Detection
- [ ] Import same JSON file again
- [ ] System skips already imported reviews
- [ ] "X skipped" message shows correct count
- [ ] No duplicate reviews created

**Expected**: Smart duplicate detection works

### Test Case 9: Partial Success (Some Errors)
- [ ] Create JSON with mix of valid/invalid reviews
- [ ] Upload file
- [ ] Some reviews import successfully
- [ ] Error list shows failed reviews
- [ ] Success count is accurate

**Expected**: Partial import succeeds, clear error reporting

---

## 🚨 Error Handling Testing

### Test Case 10: Invalid File Format
- [ ] Upload a .txt file instead of .json
- [ ] Error message displays
- [ ] Message says "Please upload a valid JSON file"

**Expected**: Clear error, no crash

### Test Case 11: Empty JSON File
- [ ] Upload empty JSON: `{}`
- [ ] Error message displays
- [ ] Message says "No valid reviews found"

**Expected**: Graceful handling of empty data

### Test Case 12: Malformed JSON
- [ ] Upload file with syntax errors
- [ ] Error message displays
- [ ] Message says "Invalid JSON file"

**Expected**: JSON parsing error caught and displayed

### Test Case 13: Missing Required Fields
- [ ] Upload JSON missing placeId or rating
- [ ] Import processes
- [ ] Invalid reviews skipped
- [ ] Error report lists skipped items

**Expected**: Resilient to missing data

### Test Case 14: Network Error
- [ ] Disable internet connection temporarily
- [ ] Attempt import
- [ ] Error message displays
- [ ] User can retry

**Expected**: Network error handled gracefully

### Test Case 15: Unauthenticated User
- [ ] Log out
- [ ] Try to access import endpoint directly
- [ ] 401 Unauthorized returned
- [ ] User redirected to login

**Expected**: Authentication required and enforced

---

## 🎨 UI/UX Testing

### Test Case 16: Responsive Design - Mobile
- [ ] Test on phone screen (< 640px)
- [ ] Import button is full width
- [ ] Modal fits screen properly
- [ ] Text is readable
- [ ] Touch targets are large enough
- [ ] Upload area is easy to tap

**Expected**: Optimized for mobile use

### Test Case 17: Responsive Design - Tablet
- [ ] Test on tablet (640-1024px)
- [ ] Layout looks balanced
- [ ] Modal is appropriately sized
- [ ] All interactions work

**Expected**: Good tablet experience

### Test Case 18: Responsive Design - Desktop
- [ ] Test on desktop (> 1024px)
- [ ] Modal is centered
- [ ] Not too wide or narrow
- [ ] Hover states work
- [ ] Drag & drop emphasized

**Expected**: Desktop-optimized interactions

### Test Case 19: Animations & Transitions
- [ ] Modal opens with smooth animation
- [ ] Modal closes with smooth animation
- [ ] Loading spinner animates
- [ ] Success icon has animation
- [ ] Button hover effects work
- [ ] No janky or laggy animations

**Expected**: Smooth, polished animations

### Test Case 20: Accessibility
- [ ] Navigate with keyboard only (Tab, Enter, Esc)
- [ ] All interactive elements focusable
- [ ] Focus indicators visible
- [ ] Esc key closes modal
- [ ] Screen reader announces elements
- [ ] Color contrast is sufficient

**Expected**: Fully accessible

---

## 🔐 Security Testing

### Test Case 21: File Size Limits
- [ ] Upload extremely large JSON file (> 10MB)
- [ ] System handles appropriately
- [ ] No timeout or crash

**Expected**: Large files handled or limited

### Test Case 22: Malicious JSON Content
- [ ] Upload JSON with script tags
- [ ] Upload JSON with SQL injection attempts
- [ ] System sanitizes input
- [ ] No XSS or injection vulnerabilities

**Expected**: All input properly sanitized

### Test Case 23: Authorization
- [ ] User A imports reviews
- [ ] Reviews belong to User A only
- [ ] User B cannot see User A's unpublished reviews
- [ ] Each user's imports are isolated

**Expected**: Proper data isolation

---

## 📊 Performance Testing

### Test Case 24: Small Import (1-5 reviews)
- [ ] Import completes quickly (< 5 seconds)
- [ ] No lag or delays
- [ ] UI remains responsive

**Expected**: Near-instant for small imports

### Test Case 25: Medium Import (10-50 reviews)
- [ ] Import completes in reasonable time (< 30 seconds)
- [ ] Progress indicator updates
- [ ] No timeouts

**Expected**: Smooth processing

### Test Case 26: Large Import (100+ reviews)
- [ ] Import eventually completes
- [ ] System doesn't crash
- [ ] User gets feedback
- [ ] Results are accurate

**Expected**: Handles large batches (may take time)

---

## 🔄 Integration Testing

### Test Case 27: Google Places API Integration
- [ ] New restaurants created with Google Place IDs
- [ ] Restaurant details fetched from API
- [ ] Photos downloaded correctly
- [ ] Address and location saved

**Expected**: Full Google integration works

### Test Case 28: Database Integration
- [ ] Reviews saved to database
- [ ] Review photos linked correctly
- [ ] Restaurant records created/matched
- [ ] is_published field set to false
- [ ] Timestamps preserved

**Expected**: All database operations succeed

### Test Case 29: Toast Notifications
- [ ] Success toast appears on successful import
- [ ] Error toast appears on failure
- [ ] Toasts are readable and helpful
- [ ] Toasts auto-dismiss

**Expected**: Clear notification feedback

### Test Case 30: Profile Page Refresh
- [ ] After import, stats update
- [ ] Experience count increases
- [ ] New reviews visible immediately
- [ ] No need to manually refresh

**Expected**: Automatic data refresh

---

## 📝 Edge Cases

### Test Case 31: Restaurant Already Exists
- [ ] Import review for restaurant in database
- [ ] System matches by Google Place ID
- [ ] No duplicate restaurant created
- [ ] Review links to existing restaurant

**Expected**: Smart restaurant matching

### Test Case 32: Review Already Exists
- [ ] User already has review for restaurant
- [ ] Import same restaurant again
- [ ] Duplicate review skipped
- [ ] Existing review unchanged

**Expected**: Duplicate prevention works

### Test Case 33: Photos Array Empty
- [ ] Import review with empty photos array
- [ ] Review imports successfully
- [ ] No photos attached
- [ ] No errors

**Expected**: Handles missing photos

### Test Case 34: Very Old Reviews
- [ ] Import review from 10+ years ago
- [ ] Date preserved correctly
- [ ] Displays properly in UI

**Expected**: Historical dates work

### Test Case 35: Special Characters in Text
- [ ] Import review with emojis 🍕🍜
- [ ] Import review with quotes/apostrophes
- [ ] Import review with non-English characters
- [ ] All text displays correctly

**Expected**: Proper character encoding

---

## ✅ Sign-Off Checklist

### Functional Requirements
- [ ] Users can import Google Reviews
- [ ] Reviews import with correct data
- [ ] Photos import correctly
- [ ] Duplicates are detected
- [ ] Reviews are unpublished by default
- [ ] Users can publish after review

### Non-Functional Requirements
- [ ] Performance is acceptable
- [ ] UI is polished and professional
- [ ] Error handling is robust
- [ ] Security measures in place
- [ ] Accessibility standards met
- [ ] Mobile responsive

### Documentation
- [ ] User guide exists
- [ ] Technical docs complete
- [ ] Code is commented
- [ ] API documented

### Deployment Readiness
- [ ] No critical bugs
- [ ] All tests passing
- [ ] Environment variables set
- [ ] Database migrations applied

---

## 🐛 Bug Reporting Template

If you find issues, report with:

```markdown
**Test Case**: #XX - Test Name
**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3

**Expected Result**: What should happen
**Actual Result**: What actually happened
**Severity**: Critical / High / Medium / Low
**Screenshots**: [Attach if applicable]
**Environment**: Browser, OS, Device
```

---

**Testing Status**: [ ] Not Started | [ ] In Progress | [ ] Complete  
**Tested By**: _______________  
**Date**: _______________  
**Sign-Off**: _______________

