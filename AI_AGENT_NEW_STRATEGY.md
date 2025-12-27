# AI Agent - New Strategy: AI-Powered Recommendations

## New Approach

Instead of filtering and scoring Google results ourselves, we now use OpenAI's knowledge to recommend 3 specific restaurants, then look them up on Google Places.

## How It Works

### Phase 1: Information Gathering (1-4 Questions)
The agent asks questions to understand:
- 🍽️ **Cuisine type**: What food do they want?
- 💰 **Budget**: Low, moderate, high, luxury
- 📍 **Location/Distance**: Walking distance, short ride, willing to drive
- 👥 **Occasion**: Solo, date, friends, family, business
- ⏰ **Timing**: Now, tonight, weekend
- ✨ **Vibe**: Romantic, loud, quiet, trendy, etc.

### Phase 2: AI Recommendation Request
Once enough information is collected, we ask OpenAI:

**Example prompt (Hebrew):**
```
הלקוח שלי רוצה מסעדה בתל אביב, קרוב למיקום הנוכחי שלו (GPS: 32.08, 34.78).
הם רוצים סושי.
יש להם תקציב גבוה.
הם הולכים דייט ראשון.
מרחק: הליכה קצרה.
אווירה: רומנטי, שקט.

אנא המלץ על בדיוק 3 מסעדות ספציפיות שמתאימות לדרישות האלה.
עבור כל מסעדה, תן רק את השם המדויק של המסעדה.

פורמט התשובה:
1. [שם מסעדה מדויק]
2. [שם מסעדה מדויק]
3. [שם מסעדה מדויק]
```

**OpenAI response:**
```
1. Yoshi Sushi Bar
2. Taka Sushi
3. Messa Restaurant
```

### Phase 3: Google Places Lookup
For each recommended restaurant name:
1. Search Google Places API for the exact name
2. Get full details (address, rating, photos, etc.)
3. Add to results list

### Phase 4: Display Results
Show the 3 restaurants with:
- Match percentage: 95% (high since AI recommended)
- All Google Places details
- Source: "ai" recommended

## Benefits

### ✅ Pros:
1. **AI knows real restaurants** - GPT has knowledge of actual restaurants in cities
2. **Context-aware recommendations** - AI understands nuance (e.g., "romantic sushi" vs "trendy sushi")
3. **No complex filtering logic** - No need to score and filter Google results
4. **Accurate matching** - AI understands what "עוף סיני" means, what "romantic" means, etc.
5. **Specific to user needs** - AI considers ALL factors (budget + vibe + occasion + cuisine)

### ⚠️ Potential Issues & Solutions:

**Issue 1: Restaurant name doesn't match Google Places**
- AI might say "Yoshi Sushi" but Google knows it as "Yoshi Sushi Bar & Grill"
- **Solution**: Google's fuzzy search usually finds it anyway
- **Fallback**: If we find < 3 restaurants, fill with cuisine-based search

**Issue 2: AI recommends closed/outdated restaurants**
- **Solution**: Google Places will return nothing, we skip it
- **Fallback**: Fill remaining slots with cuisine search

**Issue 3: Wrong city/location**
- User says "תל אביב" but we don't extract city
- **Current**: Uses GPS location + mentions city in prompt
- **TODO**: Extract city name and geocode to coordinates

## Implementation Details

### Log Output Example:
```
🤖 Asking OpenAI for restaurant recommendations...
Context: {
  cuisineTypes: ["סושי"],
  priceLevel: 3,
  occasion: "דייט ראשון",
  distance: "הליכה קצרה",
  specialPreferences: ["רומנטי"]
}

📝 Recommendation prompt: הלקוח שלי רוצה מסעדה בתל אביב...

🎯 OpenAI recommendations:
1. Yoshi Sushi Bar
2. Taka Sushi
3. Messa Restaurant

✅ Parsed 3 restaurant names: ["Yoshi Sushi Bar", "Taka Sushi", "Messa Restaurant"]

🔍 Searching Google Places for: "Yoshi Sushi Bar"
✓ Found: Yoshi Sushi Bar (4.5★, tel aviv)

🔍 Searching Google Places for: "Taka Sushi"
✓ Found: Taka Sushi (4.7★, tel aviv)

🔍 Searching Google Places for: "Messa Restaurant"
✓ Found: Messa (4.3★, tel aviv)

📍 Final recommendations: 3 restaurants
```

### Fallback Logic:
```
If restaurants.length < 3:
  → Search Google Places for cuisine type (e.g., "סושי")
  → Add unique restaurants to fill 3 slots
  → Mark as matchPercentage: 85%
```

## Code Flow

```javascript
// 1. Collect information through 1-4 questions
extractedData = {
  cuisineTypes: ["סושי"],
  priceLevel: 3,
  occasion: "דייט",
  distance: "הליכה קצרה",
  specialPreferences: ["רומנטי"]
}

// 2. Build natural language prompt
prompt = "הלקוח שלי רוצה מסעדה בתל אביב... הם רוצים סושי. יש להם תקציב גבוה..."

// 3. Ask OpenAI for recommendations
response = openai.chat.completions.create(prompt)
// → "1. Yoshi Sushi Bar\n2. Taka Sushi\n3. Messa"

// 4. Parse restaurant names
restaurantNames = parseNames(response)
// → ["Yoshi Sushi Bar", "Taka Sushi", "Messa"]

// 5. Search each on Google Places
for (name of restaurantNames) {
  results = googlePlaces.search(name, location)
  restaurants.push(results[0])
}

// 6. Return to user
return { restaurants, message: "" }
```

## Comparison: Old vs New

### Old Approach:
```
1. Extract cuisine type
2. Search Google Places for cuisine
3. Get 10-20 results
4. Score each based on:
   - Rating
   - Cuisine match in name
   - Cuisine match in types
   - Price level
   - Special preferences
5. Filter by score > threshold
6. Sort and take top 3
```

**Problems:**
- Complex scoring logic
- Hard to match "vibe" (romantic, loud, etc.)
- Google doesn't always tag restaurants properly
- Filtering was too strict or too loose

### New Approach:
```
1. Collect ALL preferences
2. Ask AI: "Recommend 3 restaurants for this context"
3. Look up each recommendation on Google Places
4. Return results
```

**Benefits:**
- AI understands context better
- AI knows real restaurant names
- Simple implementation
- More accurate recommendations

## Testing

### Test Case 1: Hebrew User
```
User: "באלי סושי טוב ויקר בתל אביב"
Agent: "איזה כיף! כמה אתה רוצה להוציא?"
User: "יקר"
Agent: "עם מי אתה הולך?"
User: "דייט ראשון"
Agent: "מרחק?"
User: "הליכה קצרה"

→ AI gets: {
  cuisine: "סושי",
  priceLevel: 4,
  occasion: "דייט ראשון",
  distance: "הליכה קצרה",
  city: "תל אביב"
}

→ AI recommends: Yoshi Sushi Bar, Taka Sushi, Messa

→ User sees: 3 actual sushi restaurants ✅
```

### Test Case 2: English User
```
User: "I want a loud burger place with friends"
Agent: "Nice! What's your budget?"
User: "cheap"
Agent: "How far?"
User: "walking distance"

→ AI gets: {
  cuisine: "burger",
  priceLevel: 1,
  occasion: "friends",
  distance: "walking distance",
  specialPreferences: ["loud"]
}

→ AI recommends: The Burger Joint, Diner 24, Urban Burger

→ User sees: 3 casual burger places ✅
```

## Future Enhancements

1. **City extraction**: Parse "תל אביב", "חיפה", etc. and geocode
2. **Learning**: Remember which AI recommendations users clicked
3. **Personalization**: "Based on restaurants you liked..."
4. **Fallback improvement**: If AI can't find good matches, tell user honestly

## Files Changed
- `app/api/map-chat/route.ts` - Replaced scoring algorithm with AI recommendation system

