# Pachu App - Complete Supabase Database Schema

## Overview

This document describes the **actual** database structure for the Pachu application, exported directly from Supabase. The database uses **PostgreSQL** with the **PostGIS extension** for geospatial queries.

---

## Core Tables

### 1. **profiles** (User Profiles)
Extends Supabase `auth.users` with additional profile information.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public profiles are viewable by everyone" 
  ON profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);
```

**Fields:**
- `id` - UUID, references auth.users(id)
- `username` - Unique username (NOT NULL)
- `full_name` - User's display name
- `avatar_url` - Profile picture URL
- `bio` - User bio/description
- `created_at` - Account creation timestamp
- `updated_at` - Last update timestamp

---

### 2. **venue_categories** (Categories for Venues)
Categories for different types of venues (restaurants, hotels, movies, books, etc.)

```sql
CREATE TABLE venue_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  is_active BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE venue_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Categories are viewable by everyone" 
  ON venue_categories FOR SELECT 
  USING (true);
```

**Fields:**
- `id` - UUID, primary key
- `name` - Category name (e.g., "Restaurants", "Hotels")
- `slug` - URL-friendly slug (e.g., "restaurants", "hotels")
- `icon` - Icon name/identifier
- `is_active` - Whether category is currently active
- `sort_order` - Display order
- `created_at` - Creation timestamp

**Example Categories:**
- Restaurants (active)
- Hotels (future)
- Movies (future)
- Books (future)
- Professionals (future)

---

### 3. **restaurants** (Restaurant/Venue Data)
Stores restaurant information with geospatial location data.

```sql
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES venue_categories(id),
  google_place_id TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  location GEOGRAPHY(POINT, 4326), -- PostGIS geography point
  phone TEXT,
  website TEXT,
  price_level INTEGER CHECK (price_level BETWEEN 1 AND 4),
  cuisine_types TEXT[],
  image_url TEXT,
  average_rating NUMERIC(3,1) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Indexes
CREATE INDEX idx_restaurants_location ON restaurants USING GIST(location);
CREATE INDEX idx_restaurants_google_place_id ON restaurants(google_place_id);
CREATE INDEX idx_restaurants_name ON restaurants(name);
CREATE INDEX idx_restaurants_category_id ON restaurants(category_id);

-- Enable RLS
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Restaurants are viewable by everyone" 
  ON restaurants FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can create restaurants" 
  ON restaurants FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');
```

**Fields:**
- `id` - UUID, primary key
- `category_id` - References venue_categories(id) (for future expansion)
- `google_place_id` - Unique identifier from Google Places API
- `name` - Restaurant name
- `description` - Restaurant description
- `address` - Full street address
- `city` - City name
- `country` - Country name
- `location` - PostGIS geography point (for spatial queries)
- `phone` - Phone number
- `website` - Website URL
- `price_level` - Price range (1-4, where 1=$ and 4=$$$$)
- `cuisine_types` - Array of cuisine types (e.g., ['Italian', 'Pizza'])
- `image_url` - Main restaurant image
- `average_rating` - Average rating (0.0-5.0)
- `total_reviews` - Total number of reviews
- `created_by` - User who added this restaurant
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

---

### 4. **reviews** (User Reviews)
Restaurant reviews with ratings and content.

```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  content TEXT,
  visit_date DATE,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, restaurant_id) -- One review per user per restaurant
);

-- Indexes
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_restaurant_id ON reviews(restaurant_id);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Reviews are viewable by everyone" 
  ON reviews FOR SELECT 
  USING (true);

CREATE POLICY "Users can create their own reviews" 
  ON reviews FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews" 
  ON reviews FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews" 
  ON reviews FOR DELETE 
  USING (auth.uid() = user_id);
```

**Fields:**
- `id` - UUID, primary key
- `user_id` - References profiles(id)
- `restaurant_id` - References restaurants(id)
- `rating` - Star rating (1-5)
- `title` - Optional review title
- `content` - Review text content
- `visit_date` - Date of visit (optional)
- `likes_count` - Number of likes (auto-updated via trigger)
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

---

### 5. **review_photos** (Review Photos)
Photos attached to reviews with optional captions.

```sql
CREATE TABLE review_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_review_photos_review_id ON review_photos(review_id);
CREATE INDEX idx_review_photos_sort_order ON review_photos(review_id, sort_order);

-- Enable RLS
ALTER TABLE review_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Review photos are viewable by everyone" 
  ON review_photos FOR SELECT 
  USING (true);

CREATE POLICY "Users can add photos to their own reviews" 
  ON review_photos FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reviews 
      WHERE reviews.id = review_photos.review_id 
      AND reviews.user_id = auth.uid()
    )
  );
```

**Fields:**
- `id` - UUID, primary key
- `review_id` - References reviews(id)
- `photo_url` - URL to the photo
- `caption` - Optional photo caption
- `sort_order` - Display order
- `created_at` - Upload timestamp

---

### 6. **follows** (User Relationships)
Tracks follower/following relationships.

```sql
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id) -- Can't follow yourself
);

-- Indexes
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);

-- Enable RLS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Follows are viewable by everyone" 
  ON follows FOR SELECT 
  USING (true);

CREATE POLICY "Users can follow others" 
  ON follows FOR INSERT 
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow" 
  ON follows FOR DELETE 
  USING (auth.uid() = follower_id);
```

**Fields:**
- `id` - UUID, primary key
- `follower_id` - User who is following
- `following_id` - User being followed
- `created_at` - Follow timestamp

---

### 7. **review_likes** (Review Likes)
Tracks which users liked which reviews.

```sql
CREATE TABLE review_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(review_id, user_id) -- One like per user per review
);

-- Indexes
CREATE INDEX idx_review_likes_review_id ON review_likes(review_id);
CREATE INDEX idx_review_likes_user_id ON review_likes(user_id);

-- Enable RLS
ALTER TABLE review_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Review likes are viewable by everyone" 
  ON review_likes FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can like reviews" 
  ON review_likes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike reviews" 
  ON review_likes FOR DELETE 
  USING (auth.uid() = user_id);

-- Trigger to update likes_count on reviews table
CREATE OR REPLACE FUNCTION update_review_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE reviews SET likes_count = likes_count + 1 WHERE id = NEW.review_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE reviews SET likes_count = likes_count - 1 WHERE id = OLD.review_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_review_likes_count
AFTER INSERT OR DELETE ON review_likes
FOR EACH ROW EXECUTE FUNCTION update_review_likes_count();
```

**Fields:**
- `id` - UUID, primary key
- `review_id` - References reviews(id)
- `user_id` - User who liked the review
- `created_at` - Like timestamp

---

### 8. **wishlist** (Saved Restaurants)
Restaurants saved by users for later with optional notes.

```sql
CREATE TABLE wishlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, restaurant_id) -- One wishlist entry per user per restaurant
);

-- Indexes
CREATE INDEX idx_wishlist_user_id ON wishlist(user_id);
CREATE INDEX idx_wishlist_restaurant_id ON wishlist(restaurant_id);

-- Enable RLS
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own wishlist" 
  ON wishlist FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their wishlist" 
  ON wishlist FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from their wishlist" 
  ON wishlist FOR DELETE 
  USING (auth.uid() = user_id);
```

**Fields:**
- `id` - UUID, primary key
- `user_id` - References profiles(id)
- `restaurant_id` - References restaurants(id)
- `notes` - Optional personal notes about the venue
- `created_at` - Saved timestamp

---

### 9. **notifications** (User Notifications)
Activity notifications for users.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'like', 'follow', 'comment', 'review'
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  actor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reference_id UUID, -- ID of related entity (review, restaurant, etc.)
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications" 
  ON notifications FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
  ON notifications FOR UPDATE 
  USING (auth.uid() = user_id);
```

**Fields:**
- `id` - UUID, primary key
- `user_id` - User receiving the notification
- `type` - Notification type ('like', 'follow', 'comment', 'review')
- `title` - Notification title
- `message` - Notification message
- `link` - URL to navigate to
- `actor_id` - User who triggered the notification
- `reference_id` - Related entity ID (review, restaurant, etc.)
- `read` - Read status (default: false)
- `created_at` - Creation timestamp

---

### 10. **chat_conversations** (AI Chat Conversations)
Stores AI chat conversations for each user.

```sql
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX idx_chat_conversations_updated_at ON chat_conversations(updated_at DESC);

-- Enable RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own conversations" 
  ON chat_conversations FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create conversations" 
  ON chat_conversations FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" 
  ON chat_conversations FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" 
  ON chat_conversations FOR DELETE 
  USING (auth.uid() = user_id);
```

**Fields:**
- `id` - UUID, primary key
- `user_id` - References profiles(id)
- `title` - Optional conversation title (auto-generated from first message)
- `created_at` - Conversation start timestamp
- `updated_at` - Last message timestamp

---

### 11. **chat_messages** (AI Chat Messages)
Individual messages within chat conversations.

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(conversation_id, created_at);

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view messages in their conversations" 
  ON chat_messages FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM chat_conversations 
      WHERE chat_conversations.id = chat_messages.conversation_id 
      AND chat_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add messages to their conversations" 
  ON chat_messages FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_conversations 
      WHERE chat_conversations.id = chat_messages.conversation_id 
      AND chat_conversations.user_id = auth.uid()
    )
  );
```

**Fields:**
- `id` - UUID, primary key
- `conversation_id` - References chat_conversations(id)
- `role` - Message role ('user', 'assistant', 'system')
- `content` - Message text
- `created_at` - Message timestamp

---

## Database Functions

### 1. **restaurants_nearby** - Find Nearby Restaurants
Uses PostGIS to find restaurants within a specified radius.

```sql
CREATE OR REPLACE FUNCTION restaurants_nearby(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 10000
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  address TEXT,
  distance_meters DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.address,
    ST_Distance(
      r.location::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) AS distance_meters
  FROM restaurants r
  WHERE r.location IS NOT NULL
    AND ST_DWithin(
      r.location::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_meters
    )
  ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION restaurants_nearby TO authenticated;
GRANT EXECUTE ON FUNCTION restaurants_nearby TO anon;
```

**Usage:**
```sql
SELECT * FROM restaurants_nearby(32.0853, 34.7750, 5000);
```

### 2. **update_restaurant_location** - Update Restaurant Location
Helper function to update a restaurant's PostGIS location field.

```sql
CREATE OR REPLACE FUNCTION update_restaurant_location(
  p_restaurant_id UUID,
  p_longitude DOUBLE PRECISION,
  p_latitude DOUBLE PRECISION
)
RETURNS VOID AS $$
BEGIN
  UPDATE restaurants
  SET location = ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)
  WHERE id = p_restaurant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_restaurant_location TO authenticated;
```

**Usage:**
```sql
SELECT update_restaurant_location(
  '10000000-0000-0000-0000-000000000001',
  34.7750,
  32.0853
);
```

---

## Storage Buckets

### **review-photos** - Review Photo Storage

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('review-photos', 'review-photos', true);

-- Storage policies
CREATE POLICY "Review photos are publicly accessible" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'review-photos');

CREATE POLICY "Authenticated users can upload review photos" 
  ON storage.objects FOR INSERT 
  WITH CHECK (
    bucket_id = 'review-photos' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own photos" 
  ON storage.objects FOR UPDATE 
  USING (
    bucket_id = 'review-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own photos" 
  ON storage.objects FOR DELETE 
  USING (
    bucket_id = 'review-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

### **avatars** - Profile Avatar Storage

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true);

-- Storage policies
CREATE POLICY "Avatar images are publicly accessible" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars" 
  ON storage.objects FOR INSERT 
  WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own avatar" 
  ON storage.objects FOR UPDATE 
  USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

## Database Triggers

### Auto-create Profile on User Signup

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Update Conversation Timestamp on New Message

```sql
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_timestamp
AFTER INSERT ON chat_messages
FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamp();
```

---

## Entity Relationship Diagram

```
auth.users (Supabase Auth)
    ↓
profiles (1:1)
    ↓
    ├── reviews (1:N) ──→ restaurants (N:1) ──→ venue_categories (N:1)
    │       ↓
    │       ├── review_photos (1:N)
    │       └── review_likes (N:M via review_likes)
    │
    ├── follows (N:M self-reference)
    ├── wishlist (N:M with restaurants)
    ├── notifications (1:N)
    ├── chat_conversations (1:N)
    │       ↓
    │       └── chat_messages (1:N)

venue_categories
    ↓
restaurants
    ├── location (PostGIS GEOGRAPHY)
    ├── reviews (1:N)
    └── wishlist (N:M with users)
```

---

## Complete Table Summary

| Table Name | Purpose | Key Relationships |
|------------|---------|-------------------|
| `profiles` | User profiles | Extends auth.users |
| `venue_categories` | Category types (restaurants, hotels, etc.) | Referenced by restaurants |
| `restaurants` | Restaurant/venue data | Belongs to venue_categories |
| `reviews` | User reviews | Links users to restaurants |
| `review_photos` | Review images | Belongs to reviews |
| `review_likes` | Review like system | Links users to reviews |
| `follows` | Social connections | Self-referencing users |
| `wishlist` | Saved venues | Links users to restaurants |
| `notifications` | Activity feed | Links to users and actors |
| `chat_conversations` | AI chat sessions | Belongs to users |
| `chat_messages` | Chat messages | Belongs to conversations |

---

## Migration Order

When setting up a new database, run migrations in this order:

1. **Enable Extensions**
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```

2. **Create Tables** (in order to respect foreign key constraints):
   - profiles
   - venue_categories
   - restaurants
   - reviews
   - review_photos
   - review_likes
   - follows
   - wishlist
   - notifications
   - chat_conversations
   - chat_messages

3. **Create Functions**:
   - `restaurants_nearby()`
   - `update_restaurant_location()`
   - Trigger functions

4. **Create Triggers**:
   - `on_auth_user_created`
   - `trigger_update_review_likes_count`
   - `trigger_update_conversation_timestamp`

5. **Create Storage Buckets**:
   - review-photos
   - avatars

6. **Add Dummy Data** (optional, for testing):
   - Run migration files in `database-migrations/`

---

## Key Features

### 🌍 Geospatial Queries (PostGIS)
- Restaurants have `location` field (GEOGRAPHY type)
- Find nearby restaurants using `restaurants_nearby()` function
- Calculate distances in meters

### 🔒 Row Level Security (RLS)
- All tables have RLS enabled
- Policies enforce data access rules
- Users can only modify their own data

### 🔗 Referential Integrity
- Foreign keys enforce data consistency
- CASCADE deletes clean up related data
- UNIQUE constraints prevent duplicates

### 📊 Computed Fields
- `likes_count` updated via triggers
- `average_rating` calculated from reviews
- `total_reviews` maintained automatically
- `updated_at` on conversations auto-updated

### 🎯 Future Expansion Ready
- `venue_categories` table supports multiple venue types
- Ready to expand beyond restaurants to hotels, movies, books, professionals

---

## Dummy Users for Testing

Dummy users created in migration `04-feed-dummy-data-daniel-amit.sql`:

| Name | Email | UUID | Password |
|------|-------|------|----------|
| Daniel Davidyan | daniel@example.com | baaa812c-66f9-41de-8387-efb7535d7757 | password123 |
| Amit Chimya | amit@example.com | a541c92e-1cd4-4dfa-a5cc-040840377ea7 | password123 |
| Rotem Cohen | rotem@example.com | 22222222-2222-2222-2222-222222222222 | password123 |
| Nir Shvili | nir@example.com | 33333333-3333-3333-3333-333333333333 | password123 |
| Aviv Samir | aviv@example.com | 55555555-5555-5555-5555-555555555555 | password123 |
| Yair Avraham | yair@example.com | 66666666-6666-6666-6666-666666666666 | password123 |

Dummy restaurants in Tel Aviv (6 restaurants with sample reviews and photos).

---

## Notes

- **PostGIS** is required for geospatial features
- **UUID** extension is needed for UUID generation
- All timestamps use `TIMESTAMPTZ` (timezone-aware)
- Storage buckets are public-readable but write-protected
- RLS policies must be tested thoroughly before production
- The `venue_categories` table enables future expansion beyond restaurants

---

**Last Updated:** December 2025  
**Database Version:** PostgreSQL 15+ with PostGIS 3+  
**Supabase Project:** pachu-app  
**Schema Status:** ✅ Verified from actual Supabase database
