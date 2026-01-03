# Pachu Recommendation System

## Overview

The Pachu Recommendation System is an AI-powered restaurant recommendation engine that learns user preferences and provides highly personalized restaurant suggestions. It uses:

- **Local Restaurant Cache** (`restaurant_cache`) - All Israel restaurants (~30,000) with vector embeddings
- **User Taste Profile** (`user_taste_profiles`) - From onboarding with `taste_embedding`
- **Learning from Signals** (`user_taste_signals`) - Reviews, chats, likes, comments, wishlist
- **4-Step Search Algorithm** - SQL Filter → Vector Search → Reranking → LLM Selection
- **Personal Match Score** - Displayed everywhere a restaurant appears

## Database Setup

### 1. Run the SQL Migrations

Run these migrations in your Supabase SQL Editor in order:

```sql
-- 1. First, run the tables migration
-- File: database-migrations/200-recommendation-system-tables.sql

-- 2. Then, run the functions migration
-- File: database-migrations/201-vector-search-functions.sql
```

### 2. Create Vector Index (After Populating Data)

After populating the restaurant cache with data, create the vector index:

```sql
-- Create IVFFlat index for restaurant embeddings
CREATE INDEX idx_restaurant_cache_embedding 
  ON restaurant_cache USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create IVFFlat index for user taste embeddings
CREATE INDEX idx_user_taste_profiles_embedding 
  ON user_taste_profiles USING ivfflat (taste_embedding vector_cosine_ops) WITH (lists = 100);
```

## New API Endpoints

### User Taste Profile

#### GET /api/user/taste-profile
Returns the user's taste profile.

#### POST /api/user/taste-profile
Creates or updates the user's taste profile.

```typescript
// Request body
{
  isKosher?: boolean;
  isVegetarian?: boolean;
  isVegan?: boolean;
  glutenFree?: boolean;
  likes?: string[];       // ['Italian', 'Sushi', 'Burgers']
  dislikes?: string[];    // ['Spicy', 'Seafood']
  freeText?: string;      // Free form description
  dateRestaurants?: [{googlePlaceId: string, name: string}];
  friendsRestaurants?: [{googlePlaceId: string, name: string}];
  familyRestaurants?: [{googlePlaceId: string, name: string}];
  soloRestaurants?: [{googlePlaceId: string, name: string}];
  workRestaurants?: [{googlePlaceId: string, name: string}];
  dislikedRestaurants?: [{googlePlaceId: string, name: string}];
  onboardingCompleted?: boolean;
  onboardingStep?: number;
}
```

### User Taste Signals

#### GET /api/user/taste-signals
Returns recent taste signals for the user.

#### POST /api/user/taste-signals
Adds a new taste signal (called automatically by other APIs).

```typescript
// Request body
{
  signalType: 'review' | 'chat' | 'like' | 'comment' | 'wishlist' | 'click';
  signalStrength: 1 | 2 | 3 | 4 | 5;  // 5 = strongest
  isPositive: boolean;
  restaurantId?: string;
  googlePlaceId?: string;
  restaurantName?: string;
  cuisineTypes?: string[];
  content?: string;  // Human-readable description
  sourceId?: string;
}
```

### Rebuild Embedding

#### POST /api/user/taste-profile/rebuild-embedding
Rebuilds the user's taste embedding from profile data and signals.

### Match Score

#### POST /api/restaurants/match-score
Calculate match scores for multiple restaurants.

```typescript
// Request
{ restaurantIds: string[] }

// Response
{
  scores: [{
    restaurantId: string;
    matchScore: number;  // 0-100
  }]
}
```

### Agent Recommend (New 4-Step Algorithm)

#### POST /api/agent/recommend
Get personalized restaurant recommendations based on conversation.

```typescript
// Request
{
  conversationId?: string;
  messages: [{role: 'user' | 'assistant', content: string}];
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}

// Response
{
  recommendations: [{
    restaurant: RestaurantSearchResult;
    matchScore: number;
    explanation: string;
    contextMatch?: string;
  }];
  conversationId: string;
  language: 'en' | 'he';
  explanation?: string;
  extractedPreferences?: {
    positive: string[];
    negative: string[];
  };
}
```

### Restaurant Cache Population

#### POST /api/restaurants/cache/populate
Populates the restaurant cache (admin only).

```typescript
// Request
{
  region?: 'israel' | 'tel_aviv' | 'jerusalem' | 'haifa';
  forceUpdate?: boolean;
  batchSize?: number;
  maxRestaurants?: number;
}
```

#### GET /api/restaurants/cache/populate
Returns cache status and statistics.

## Signal Types & Weights

| Signal | Strength | When | What We Learn |
|--------|----------|------|---------------|
| Review | 5 | User writes a review | Rating 4-5 = positive, 1-3 = negative |
| Chat | 4 | User expresses preference | "I like Italian" → positive |
| Like | 3 | User likes a review | Interest in that restaurant type |
| Comment | 3 | User comments on review | Interest in the restaurant |
| Wishlist | 2 | User adds to wishlist | Wants to visit |
| Click | 1 | User clicks restaurant | Basic interest |

## The 4-Step Search Algorithm

### Step 1: SQL Pre-Filter (Hard Criteria)
```sql
WHERE location within radius
  AND (is_kosher = user.is_kosher OR user.is_kosher = FALSE)
  AND (is_vegetarian_friendly = TRUE OR user.is_vegetarian = FALSE)
```
Result: 300-500 restaurants

### Step 2: Vector Search (Semantic)
```javascript
combined_query = 0.65 × conversation_embedding + 0.35 × user_taste_embedding
```
Result: 100 restaurants

### Step 3: Reranking (Complex Scoring)
```javascript
rerank_score =
  0.30 × conversation_similarity +
  0.20 × taste_similarity +
  0.20 × context_match +
  0.15 × google_rating/5 +
  0.15 × friends_score
```
Result: 15-20 restaurants

### Step 4: LLM Final Selection
Sends top 15 to GPT-4o-mini to select 3 best matches with explanations.

## Match Score Formulas

### Passive Match Score (Map/Feed)
```javascript
match_score =
  0.50 × cosine_similarity(user_taste_embedding, restaurant_embedding) +
  0.25 × (google_rating / 5) +
  0.25 × friends_score
```

### Active Match Score (After Conversation)
```javascript
combined_query = 0.65 × conversation_embedding + 0.35 × user_taste_embedding
match_score =
  0.30 × cosine_similarity(combined_query, restaurant_embedding) +
  0.20 × cosine_similarity(user_taste_embedding, restaurant_embedding) +
  0.20 × context_match +
  0.15 × (google_rating / 5) +
  0.15 × friends_score
```

## Language Handling

| Component | Language | Notes |
|-----------|----------|-------|
| Restaurant summaries | English | From Google + LLM |
| Onboarding | English | User fills in English |
| Agent conversations | Hebrew OR English | First message determines |
| Reviews in Pachu | Hebrew OR English | User's choice |
| Comments | Hebrew OR English | User's choice |
| Embeddings | Multilingual | text-embedding-3-small works with both |

## Implementation Checklist

### Database
- [x] Create `restaurant_cache` table
- [x] Create `user_taste_profiles` table  
- [x] Create `user_taste_signals` table
- [x] Create `search_restaurants_by_embedding` function
- [x] Create `calculate_match_scores` function
- [ ] Create vector indexes (after data population)

### APIs
- [x] `/api/user/taste-profile` (GET, POST, PUT)
- [x] `/api/user/taste-signals` (GET, POST, DELETE)
- [x] `/api/user/taste-profile/rebuild-embedding` (POST)
- [x] `/api/restaurants/match-score` (GET, POST)
- [x] `/api/agent/recommend` (POST)
- [x] `/api/restaurants/cache/populate` (GET, POST)

### Signal Integration
- [x] Add signals on review creation
- [x] Add signals on review like
- [x] Add signals on comment
- [x] Add signals on wishlist add

### Match Score Integration
- [x] Update feed API to use calculated scores
- [ ] Update map API to use calculated scores
- [ ] Update restaurant details to show score

## Costs Estimate

### Initial Setup (~$560)
- Google Places Israel scan: ~$550
- LLM for summaries: ~$5
- Embeddings: ~$0.30

### Monthly (~$270 for 1,000 users)
- Supabase Pro: $25
- Cache update: ~$120
- OpenAI for Agent: ~$95
- Ongoing embeddings: ~$10
- Searches outside Israel: ~$20

## Next Steps

1. **Run the SQL migrations** in Supabase SQL Editor
2. **Populate the restaurant cache** using `/api/restaurants/cache/populate`
3. **Create vector indexes** after data is populated
4. **Build onboarding UI** to collect user preferences
5. **Integrate new Agent** in the chat interface
6. **Test the complete flow** with real users

