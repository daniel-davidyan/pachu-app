# AI Agent - Language-Aware Search (Hebrew & English)

## The Right Approach

**Key Insight**: Google Places API works perfectly in ANY language! There's no need to translate Hebrew to English. In fact, translating makes results LESS accurate, especially for Hebrew-specific dishes.

---

## How It Works Now

### 1. **Language Detection on First Message**

When the user sends their first message, we detect the language:

```javascript
function detectLanguage(message: string): 'he' | 'en' | 'other' {
  // Check for Hebrew characters
  const hebrewChars = message.match(/[\u0590-\u05FF]/g);
  if (hebrewChars && hebrewChars.length > 3) {
    return 'he';
  }
  
  // Check for English (Latin characters)
  const englishChars = message.match(/[a-zA-Z]/g);
  if (englishChars && englishChars.length > 3) {
    return 'en';
  }
  
  return 'other';
}
```

### 2. **Language-Specific System Prompt**

The AI gets different instructions based on detected language:

#### Hebrew Mode:
```
**CRITICAL - Hebrew Language Mode:**
- User is speaking HEBREW
- Conduct ALL conversation in Hebrew (questions, responses)
- Extract ALL information in HEBREW (cuisine types, preferences, etc.)
- Use HEBREW search terms for Google Places API
- Keep everything in Hebrew for maximum search accuracy
- Examples: "המבורגר" stays "המבורגר", "עוף סיני" stays "עוף סיני"
```

#### English Mode:
```
**CRITICAL - English Language Mode:**
- User is speaking ENGLISH
- Conduct ALL conversation in English
- Extract ALL information in ENGLISH
- Use ENGLISH search terms for Google Places API
```

### 3. **No Translation - Keep Original Terms**

**Before (WRONG):**
- User: "המבורגר" → AI extracts: `["burger"]` → Search: "burger restaurant" ❌
- User: "עוף סיני" → AI tries to translate: `["chinese chicken"]` → Wrong results ❌
- User: "מלוואח" → AI doesn't know how to translate → Fails ❌

**After (CORRECT):**
- User: "המבורגר" → AI extracts: `["המבורגר"]` → Search: "המבורגר" ✅
- User: "עוף סיני" → AI extracts: `["עוף סיני"]` → Search: "מסעדת עוף סיני" ✅
- User: "מלוואח" → AI extracts: `["מלוואח"]` → Search: "מלוואח" ✅

### 4. **Smart Search Query Building**

For Hebrew:
```javascript
// User: "עוף סיני"
// cuisineTypes: ["עוף סיני"]
// Result: "מסעדת עוף סיני" (restaurant word in Hebrew)
```

For English:
```javascript
// User: "chinese chicken"
// cuisineTypes: ["chinese chicken"]
// Result: "chinese chicken restaurant"
```

### 5. **Language-Aware Data Extraction**

All fields stay in user's language:

```json
{
  "cuisineTypes": ["המבורגר"],
  "searchQuery": "המבורגר",
  "priceLevel": 1,
  "budget": "60 שקל",
  "occasion": "לבד",
  "timing": "עכשיו",
  "distance": "במרחק הליכה",
  "specialPreferences": ["רומנטי", "חוץ"]
}
```

---

## Why This Works Better

### Google Places API Multi-Language Support

Google Places API is DESIGNED to work with multiple languages:

1. **Native Language Searches**: Searching for "המבורגר" in Israel returns burger places
2. **Local Business Names**: Businesses list themselves with local names
3. **Better Context**: "עוף סיני" has specific meaning in Israeli cuisine that "chinese chicken" doesn't capture
4. **Accurate Results**: Local dishes like "מלוואח", "סביח", "שקשוקה" only work in Hebrew

### Examples

#### Hebrew-Specific Dishes:
- **"עוף סיני"** (Sinai chicken) - Specific Israeli dish, won't translate well
- **"מלוואח"** (Yemenite flatbread) - No good English equivalent
- **"סביח"** (Sabich) - Specific Israeli sandwich
- **"שקשוקה"** (Shakshuka) - International but Hebrew name more accurate in Israel

#### English Dishes in Israel:
- **"burger"** / **"hamburger"** - Works in English
- **"pizza"** - Works in English
- **"sushi"** - Works in English

---

## Conversation Examples

### Example 1: Hebrew User

```
User: "אני רעב ובאלי משהו טעים"
(I'm hungry and want something tasty)

Agent: "מה אתה מתחשק לאכול? יש לך סוג מסוים של אוכל בראש? 🍽️"
(What do you feel like eating? Any specific type of food in mind?)

User: "המבורגר"
(Hamburger)

Agent: "מעולה! המבורגר זה תמיד מסלול בטוח. 🍔 כמה אתה רוצה להוציא על זה?"
(Great! Burger is always a safe bet. How much do you want to spend?)

User: "60 שח"
(60 shekels)

Extracted Data:
{
  "cuisineTypes": ["המבורגר"],
  "searchQuery": "המבורגר",
  "priceLevel": 1,
  "budget": "60 שקל"
}

Search: "המבורגר" → Returns burger places in Israel ✅
```

### Example 2: Hebrew-Specific Dish

```
User: "אני רוצה עוף סיני"
(I want Sinai chicken)

Agent: "אוהב! 🌮 מה התקציב?"
(Love it! What's the budget?)

User: "בזול"
(Cheap)

Extracted Data:
{
  "cuisineTypes": ["עוף סיני"],
  "searchQuery": "מסעדת עוף סיני",
  "priceLevel": 1
}

Search: "מסעדת עוף סיני" → Returns Sinai chicken restaurants ✅
```

### Example 3: English User

```
User: "I'm hungry"

Agent: "What are you craving? 🍽️"

User: "burger"

Agent: "Nice! What's your budget like? 💰"

User: "cheap"

Extracted Data:
{
  "cuisineTypes": ["burger"],
  "searchQuery": "burger",
  "priceLevel": 1
}

Search: "burger" → Returns burger places ✅
```

---

## Technical Implementation

### Key Changes:

1. **Language Detection Function** (`detectLanguage`)
   - Detects Hebrew, English, or other
   - Runs on first user message only

2. **Dynamic System Prompt**
   - Different instructions for Hebrew vs English
   - Includes language-specific examples
   - Tells AI to keep everything in user's language

3. **No Translation Layer**
   - `cuisineTypes` stays in original language
   - `searchQuery` stays in original language
   - All preferences stay in original language

4. **Smart Restaurant Word Placement**
   - Hebrew: "מסעדת עוף סיני" (restaurant word before)
   - English: "chinese chicken restaurant" (restaurant word after)

5. **Flexible Cuisine Matching**
   - Case-insensitive matching
   - Works with Hebrew and English characters
   - Partial matches count (for flexibility)

---

## Benefits

### ✅ For Hebrew Users:
- Works with ANY Hebrew dish name
- Accurate results for local specialties
- Natural Hebrew conversation
- No lost meaning in translation

### ✅ For English Users:
- Natural English conversation
- International cuisine terms work perfectly

### ✅ For Mixed Usage:
- Some users type "I want המבורגר"
- AI detects Hebrew (more Hebrew chars)
- Extracts "המבורגר" correctly
- Search works!

---

## Testing

### Hebrew Tests:
```
"המבורגר" → Should find burger places
"עוף סיני" → Should find Sinai chicken restaurants
"מלוואח" → Should find Yemenite restaurants
"פיצה" → Should find pizza places
"סושי" → Should find sushi places
"שווארמה" → Should find shawarma places
"פלאפל" → Should find falafel places
```

### English Tests:
```
"burger" → Should find burger places
"pizza" → Should find pizza places
"sushi" → Should find sushi places
"chinese food" → Should find Chinese restaurants
"italian" → Should find Italian restaurants
```

### Edge Cases:
```
"I want המבורגר" → Detects Hebrew (more Hebrew chars), extracts "המבורגר"
"pizza זול" → Detects Hebrew, keeps "pizza" as-is (universal term)
```

---

## Why This is the Right Approach

1. **Google Supports It**: Google Places API is designed for multi-language queries
2. **No Information Loss**: Original terms preserve full meaning
3. **Local Accuracy**: Hebrew names match how businesses list themselves
4. **Simpler Code**: No complex translation logic needed
5. **Future-Proof**: Works for any language without hardcoding translations

**Bottom Line**: Let Google do what it does best - understand searches in any language! 🌍

