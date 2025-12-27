# 📋 Google Takeout JSON Format Examples

This document shows the different JSON formats that the Google Reviews importer supports.

---

## Format 1: Standard Google Takeout Format (Most Common)

This is the most common format you'll get from Google Takeout.

```json
[
  {
    "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
    "placeName": "Uchi Dallas",
    "placeAddress": "2817 Maple Ave, Dallas, TX 75201",
    "rating": 5,
    "comment": "Amazing sushi experience! The hamachi was incredibly fresh, and the service was impeccable. The ambiance is perfect for a special occasion. Highly recommend the omakase tasting menu - every course was a delightful surprise. Will definitely return!",
    "timestamp": 1703030400000,
    "photos": [
      "https://lh3.googleusercontent.com/xxx",
      "https://lh3.googleusercontent.com/yyy"
    ]
  },
  {
    "placeId": "ChIJrTLr-GyuEmsRBfy61i59si0",
    "placeName": "The French Room",
    "placeAddress": "1321 Commerce St, Dallas, TX 75202",
    "rating": 5,
    "comment": "Exceptional fine dining experience. Every dish was perfectly executed with beautiful presentation. The wine pairing was spot on. Worth every penny!",
    "timestamp": 1700438400000,
    "photos": []
  }
]
```

---

## Format 2: Alternative Field Names

Google sometimes uses different field names in their exports.

```json
{
  "reviews": [
    {
      "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
      "name": "Uchi Dallas",
      "address": "2817 Maple Ave, Dallas, TX 75201",
      "starRating": 5,
      "reviewText": "Amazing sushi experience!",
      "publishedTime": 1703030400000,
      "images": [
        "https://lh3.googleusercontent.com/xxx"
      ]
    }
  ]
}
```

---

## Format 3: Locations-Based Format

Older Google Takeout format with nested structure.

```json
{
  "locations": [
    {
      "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
      "name": "Uchi Dallas",
      "address": "2817 Maple Ave, Dallas, TX 75201",
      "review": {
        "starRating": 5,
        "comment": "Amazing sushi experience!",
        "publishedTime": 1703030400000,
        "photos": [
          "https://lh3.googleusercontent.com/xxx"
        ]
      }
    }
  ]
}
```

---

## Format 4: Minimal Format (For Testing)

Simplest possible format that will still work.

```json
[
  {
    "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
    "placeName": "Test Restaurant",
    "rating": 5
  }
]
```

---

## Field Mapping

The importer is flexible and supports various field names:

| Our Field | Google Format 1 | Google Format 2 | Google Format 3 |
|-----------|-----------------|-----------------|-----------------|
| Place ID | `placeId` | `place_id` | `placeId` |
| Name | `placeName` | `name` | `name` |
| Address | `placeAddress` | `address` | `address` |
| Rating | `rating` | `starRating` | `starRating` |
| Text | `comment` | `reviewText` | `comment` |
| Date | `timestamp` | `publishedTime` | `publishedTime` |
| Photos | `photos` | `images` | `photos` |

---

## Field Requirements

### Required Fields ✅
- **placeId**: Google Place ID (essential for restaurant matching)
- **rating**: Number from 1-5

### Optional Fields 📝
- **placeName**: Restaurant name (helpful but not required)
- **placeAddress**: Restaurant address (fetched from Google if missing)
- **comment/reviewText**: Your review text (can be empty)
- **timestamp**: Review date (uses current date if missing)
- **photos**: Array of photo URLs (can be empty array)

---

## Complete Example with All Features

```json
[
  {
    "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
    "placeName": "Uchi Dallas",
    "placeAddress": "2817 Maple Ave, Dallas, TX 75201",
    "rating": 5,
    "comment": "Amazing sushi experience! The hamachi was incredibly fresh, and the service was impeccable. The ambiance is perfect for a special occasion. Highly recommend the omakase tasting menu - every course was a delightful surprise. Will definitely return!",
    "timestamp": 1703030400000,
    "photos": [
      "https://lh3.googleusercontent.com/photo1.jpg",
      "https://lh3.googleusercontent.com/photo2.jpg",
      "https://lh3.googleusercontent.com/photo3.jpg"
    ]
  },
  {
    "placeId": "ChIJrTLr-GyuEmsRBfy61i59si0",
    "placeName": "The French Room",
    "placeAddress": "1321 Commerce St, Dallas, TX 75202",
    "rating": 4,
    "comment": "Excellent food and service. The duck was cooked perfectly. A bit pricey but worth it for special occasions.",
    "timestamp": 1700438400000,
    "photos": [
      "https://lh3.googleusercontent.com/photo4.jpg"
    ]
  },
  {
    "placeId": "ChIJ3yyyyyyyyyyyyyyyyyyyy",
    "placeName": "Local Taco Shop",
    "placeAddress": "123 Main St, Austin, TX 78701",
    "rating": 3,
    "comment": "Decent tacos, nothing special. Quick service though.",
    "timestamp": 1698019200000,
    "photos": []
  }
]
```

---

## Timestamp Format

Google uses Unix timestamps in milliseconds:

```javascript
// JavaScript example
const date = new Date(1703030400000);
console.log(date); // 2023-12-19T16:00:00.000Z

// To convert a date to timestamp:
const timestamp = new Date('2023-12-19').getTime();
console.log(timestamp); // 1703030400000
```

**Common dates in timestamp format:**
- `1703030400000` = December 19, 2023
- `1700438400000` = November 19, 2023
- `1698019200000` = October 22, 2023

---

## Photo URLs

Google photo URLs typically look like:
```
https://lh3.googleusercontent.com/p/AF1QipN...
https://lh5.googleusercontent.com/p/AF1QipM...
```

**Note**: Some Google photo URLs may expire or be private. The importer will include them, but they may not display if expired.

---

## Test Data Generator

Need test data? Use this template:

```json
[
  {
    "placeId": "ChIJ_REPLACE_WITH_REAL_PLACE_ID",
    "placeName": "Restaurant Name Here",
    "placeAddress": "123 Street Name, City, State ZIP",
    "rating": 5,
    "comment": "Your review text here...",
    "timestamp": 1700000000000,
    "photos": []
  }
]
```

**How to find a real Google Place ID:**
1. Go to [Google Maps](https://maps.google.com)
2. Search for a restaurant
3. Look at the URL: `...place/...@...!1s**ChIJ...**!...`
4. The `ChIJ...` part is the Place ID

---

## Common Issues & Solutions

### ❌ "Unrecognized file format"
**Problem**: JSON structure doesn't match any expected format  
**Solution**: Check that your JSON has one of the structures shown above

### ❌ "No valid reviews found"
**Problem**: Reviews are missing required fields  
**Solution**: Ensure each review has at least `placeId` and `rating`

### ✅ "X reviews skipped"
**Normal**: Reviews were skipped because:
- You already reviewed that restaurant in Pachu
- The review is for a non-restaurant place
- Missing required data (placeId or rating)

---

## Validation Script

Want to validate your JSON before importing? Use this JavaScript:

```javascript
function validateGoogleReviews(json) {
  const reviews = Array.isArray(json) ? json : json.reviews || json.locations;
  
  if (!reviews || !Array.isArray(reviews)) {
    return { valid: false, error: 'No reviews array found' };
  }
  
  const validReviews = reviews.filter(review => {
    const placeId = review.placeId || review.place_id;
    const rating = review.rating || review.starRating || review.review?.starRating;
    return placeId && rating >= 1 && rating <= 5;
  });
  
  return {
    valid: true,
    total: reviews.length,
    validCount: validReviews.length,
    invalidCount: reviews.length - validReviews.length
  };
}

// Usage:
const result = validateGoogleReviews(yourJsonData);
console.log(result);
// { valid: true, total: 25, validCount: 23, invalidCount: 2 }
```

---

## API Response Format

After importing, the API returns:

```json
{
  "success": true,
  "imported": 23,
  "skipped": 2,
  "errors": [
    "Could not fetch details for Unknown Place",
    "Failed to import review for Closed Restaurant"
  ],
  "message": "Successfully imported 23 review(s). 2 skipped."
}
```

---

**Need help?** Check the full guide in `GOOGLE_REVIEWS_IMPORT_GUIDE.md`

