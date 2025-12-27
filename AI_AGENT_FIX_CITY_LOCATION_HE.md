# תיקון: חילוץ מיקום (עיר) משיחה

## הבעיה
המשתמש אמר "אני רוצה מסעדה בירושלים" או "באלי משהו בהרצליה" אבל המערכת חיפשה מסעדות ליד ה-GPS שלו (פונה, הודו) במקום בעיר שהוא ביקש.

## הפתרון

### 1. **חילוץ שם העיר מהשיחה**

הוספנו שדה חדש בנתונים המחולצים:

```javascript
extractedData = {
  cuisineTypes: ["סושי"],
  priceLevel: 3,
  occasion: "דייט",
  distance: "הליכה קצרה",
  city: "ירושלים",  // ← חדש!
  ...
}
```

**הנחיות ל-AI:**
```
**city** (string) - חשוב מאוד:
- חלץ את שם העיר אם המשתמש מזכיר אותה!
- דוגמאות: "תל אביב", "ירושלים", "חיפה", "הרצליה", "באר שבע", "אילת"
- אם המשתמש לא מזכיר עיר, השאר ריק
```

### 2. **Geocoding - המרת שם עיר לקואורדינטות**

פונקציה חדשה שמשתמשת ב-Google Geocoding API:

```javascript
async function geocodeCity(cityName: string) {
  // שולח בקשה ל-Google Geocoding API
  // "ירושלים" → { lat: 31.7683, lng: 35.2137 }
  // "הרצליה" → { lat: 32.1624, lng: 34.8443 }
  // "תל אביב" → { lat: 32.0853, lng: 34.7818 }
}
```

### 3. **שימוש במיקום הנכון**

```javascript
let searchLocation = location; // מיקום GPS כברירת מחדל

// אם המשתמש הזכיר עיר, השתמש בה!
if (extractedData.city) {
  const geocodedLocation = await geocodeCity(extractedData.city);
  if (geocodedLocation) {
    searchLocation = geocodedLocation; // משתמש במיקום העיר
    console.log(`✅ Using ${extractedData.city} location instead of GPS`);
  }
}
```

### 4. **עדכון הפרומפט ל-OpenAI**

עכשיו הפרומפט אומר מפורשות לחפש בעיר הספציפית:

**לפני:**
```
הלקוח שלי רוצה מסעדה בתל אביב, קרוב למיקום הנוכחי שלו (GPS: 18.53, 73.93)
```
↑ סתירה! אומרים תל אביב אבל GPS בהודו

**אחרי:**
```
הלקוח שלי רוצה מסעדה בירושלים, קרוב למיקום (GPS: 31.77, 35.21)
```
↑ עיר ו-GPS תואמים!

### 5. **הנחיות חזקות ל-OpenAI**

```javascript
system: `אתה מומחה מסעדות מקומי שמכיר מסעדות בישראל מצוין.
חשוב מאוד - אל תמליץ על מסעדות מעיר אחרת!
המלץ רק על מסעדות שנמצאות ב${cityName}!`
```

## דוגמאות שימוש

### דוגמה 1: המשתמש מזכיר עיר
```
User: "אני רוצה סושי טוב בירושלים"

AI extracts:
{
  cuisineTypes: ["סושי"],
  city: "ירושלים"
}

System:
🏙️ User mentioned city: "ירושלים"
📍 Geocoded "ירושלים" to: 31.7683, 35.2137
✅ Using city location instead of GPS

Prompt to OpenAI:
"הלקוח רוצה מסעדה בירושלים, קרוב למיקום (GPS: 31.77, 35.21)..."

OpenAI responds:
1. Mona Restaurant
2. Eucalyptus
3. Machneyuda

Search results: 3 restaurants IN JERUSALEM ✅
```

### דוגמה 2: המשתמש לא מזכיר עיר
```
User: "אני רוצה המבורגר זול"

AI extracts:
{
  cuisineTypes: ["המבורגר"],
  priceLevel: 1,
  city: ""  // ריק
}

System:
🏙️ No city mentioned, using GPS location
Search near: 18.53, 73.93 (user's current location)

Results: Restaurants near user's GPS ✅
```

### דוגמה 3: עיר לא ניתנת ל-Geocode
```
User: "אני רוצה משהו בעיר שלא קיימת"

AI extracts:
{
  city: "עיר שלא קיימת"
}

System:
⚠️ Could not geocode "עיר שלא קיימת", falling back to GPS
Using GPS: 18.53, 73.93
```

## Log Output לדוגמה

```
User: "באלי סושי יקר בהרצליה"

📊 Extracted data: {
  "cuisineTypes": ["סושי"],
  "priceLevel": 3,
  "city": "הרצליה"
}

🏙️ User mentioned city: "הרצליה"
📍 Geocoded "הרצליה" to: 32.1624, 34.8443
✅ Using city location instead of GPS: הרצליה

🤖 Asking OpenAI for restaurant recommendations...
📝 Recommendation prompt: הלקוח שלי רוצה מסעדה בהרצליה...

🎯 OpenAI recommendations:
1. Yakimono Herzliya
2. Nini Hachi Herzliya
3. Tokyo Sushi Bar Herzliya

🔍 Searching Google Places for: "Yakimono Herzliya"
   at location: 32.1624, 34.8443
✓ Found: Yakimono Herzliya

🔍 Searching Google Places for: "Nini Hachi Herzliya"
✓ Found: Nini Hachi

🔍 Searching Google Places for: "Tokyo Sushi Bar Herzliya"
✓ Found: Tokyo Sushi Bar

📍 Final recommendations: 3 restaurants IN HERZLIYA ✅
```

## רשימת ערים נתמכות (דוגמאות)

### עברית:
- תל אביב
- ירושלים
- חיפה
- הרצליה
- באר שבע
- אילת
- נתניה
- רעננה
- כפר סבא
- פתח תקווה
- ראשון לציון
- רחובות
- מודיעין

### אנגלית:
- Tel Aviv
- Jerusalem
- Haifa
- Herzliya
- Beer Sheva
- Eilat
- Netanya
- Raanana

**Google Geocoding API מזהה את כולן!**

## שיפורים עתידיים

1. **Cache geocoding results** - לא לחפש את אותה עיר פעמיים
2. **Auto-complete cities** - אם המשתמש כותב "רעננ" להשלים ל"רעננה"
3. **Fuzzy matching** - "הרצליה פיתוח" → "הרצליה"
4. **Multiple cities** - "תל אביב או הרצליה"

## קבצים ששונו
- `app/api/map-chat/route.ts`:
  - הוספת שדה `city` לנתונים המחולצים
  - פונקציה `geocodeCity()` חדשה
  - לוגיקה לשימוש במיקום העיר במקום GPS
  - עדכון פרומפט ל-OpenAI
  - שימוש ב-`searchLocation` בכל החיפושים

