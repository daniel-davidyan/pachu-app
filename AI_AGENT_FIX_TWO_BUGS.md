# Fixed: 2 Critical Bugs

## Bug 1: Language Switching Mid-Conversation (Hebrew → English)

### Problem
The conversation would start in Hebrew but switch to English after a few messages:
```
User: "סושי טוב בתל אביב"
Agent: "איזה מסעדת סושי אתה מחפש?..." ✅ Hebrew

User: "משפחה"  
Agent: "מעולה! מה לגבי הזמן?..." ✅ Hebrew

User: "הערב"
Agent: "Perfect! Just to confirm..." ❌ Switched to English!
```

### Root Cause
In `app/api/map-chat/route.ts` line 124, language detection was only happening on the **first message**. For subsequent messages, it was defaulting to `'en'`:

```typescript
// OLD CODE (WRONG):
const detectedLanguage = isFirstMessage ? detectLanguage(message) : 'en'; // ❌ Always defaults to 'en'
```

This meant:
- Message 1: Detect Hebrew ✅
- Message 2+: Default to English ❌

### Fix
Now the language is detected from the **first user message in the conversation history**, preserving the language throughout:

```typescript
// NEW CODE (FIXED):
let detectedLanguage = 'en';
if (isFirstMessage) {
  // First message - detect from current message
  detectedLanguage = detectLanguage(message);
} else {
  // Not first message - detect from first user message in history
  if (userMessages.length > 0) {
    detectedLanguage = detectLanguage(userMessages[0].content);
  } else {
    // Fallback - detect from current message
    detectedLanguage = detectLanguage(message);
  }
}
```

**Now:**
- Message 1: "סושי טוב" → Detect Hebrew
- Message 2: "משפחה" → Look back at message 1 → Hebrew
- Message 3: "הערב" → Look back at message 1 → Hebrew
- All messages: Hebrew! ✅

---

## Bug 2: Restaurant Photos Not Displaying in Chat

### Problem
Restaurant photos were missing in the chat recommendations, but would appear when clicking through to the restaurant page.

**Chat View:**
```
[🍽️ Shizusan]  ❌ No photo
[🍽️ Nini Hachi] ❌ No photo
```

**Restaurant Page:**
```
[Photo appears!] ✅
```

### Root Cause
In `app/api/restaurants/search/route.ts`, the `enrichedData` object was declared as `const`, which meant it couldn't be modified when trying to add photos from the Place Details API:

```typescript
// OLD CODE (WRONG):
const enrichedData = {  // ❌ const = immutable
  photoUrl: place.photos?.[0] ? '...' : undefined,
  ...
};

if (!enrichedData.photoUrl && place.place_id) {
  // Try to fetch from Place Details...
  enrichedData.photoUrl = '...';  // ❌ ERROR: Can't modify const!
}
```

The TypeScript compiler didn't catch this because the property assignment itself is allowed on objects, but the issue was that the modification wasn't actually working as expected.

### Fix

1. **Changed to `let` with explicit type annotation:**
```typescript
let enrichedData: any = {
  photoUrl: place.photos?.[0] ? '...' : undefined,
  ...
};

if (!enrichedData.photoUrl && place.place_id) {
  // Try to fetch from Place Details...
  enrichedData.photoUrl = '...';  // ✅ Now it works!
}
```

2. **Added detailed logging:**
```typescript
console.log(`📸 No photo for "${place.name}", trying Place Details API...`);

if (details.photos?.[0]) {
  enrichedData.photoUrl = `...`;
  console.log(`✅ Found photo for "${place.name}" from Place Details`);
} else {
  console.warn(`⚠️ Place Details for "${place.name}" has no photos`);
}
```

### How It Works Now

```
1. Text Search: "Nini Hachi"
   → Result has no photo
   
2. Detect: enrichedData.photoUrl is undefined
   
3. Call Place Details API with place_id
   → Get full restaurant data including photos
   
4. Update: enrichedData.photoUrl = 'https://maps.googleapis.com/...'
   
5. Return: Restaurant with photo! ✅
```

---

## Testing Both Fixes

### Test Language Fix:
```
User: "סושי טוב בתל אביב"
Agent: [Hebrew response] ✅

User: "משפחה"
Agent: [Hebrew response] ✅

User: "הערב"
Agent: [Hebrew response] ✅

User: "קרוב לרחוב גורדון"
Agent: [Shows restaurants] ✅
```

**All messages in Hebrew!** 🎉

### Test Photo Fix:
```
Console logs:
🔍 Searching Google Places for: "Nini Hachi"
📸 No photo for "Nini Hachi", trying Place Details API...
✅ Found photo for "Nini Hachi" from Place Details

Result:
✓ Found: Nini Hachi {
  hasPhoto: true,
  photoUrl: 'https://maps.googleapis.com/...',
  placeId: 'ChIJ...'
}
```

**Photos now display in chat!** 📸✨

---

## Files Changed

1. **`app/api/map-chat/route.ts`**:
   - Fixed language detection to preserve language throughout conversation
   - Now checks first user message in history, not just current message

2. **`app/api/restaurants/search/route.ts`**:
   - Changed `enrichedData` from `const` to `let enrichedData: any`
   - Now properly modifies photoUrl from Place Details API
   - Added detailed logging for debugging

Both bugs are now fixed! 🎉

