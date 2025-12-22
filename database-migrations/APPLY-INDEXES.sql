-- FIXED Migration: Add Performance Indexes for Map and Restaurant Queries
-- Created: 2025-12-22
-- Description: Add database indexes to speed up restaurant and review queries
-- NOTE: Removed latitude/longitude index as restaurants uses PostGIS geometry

-- Index for google_place_id lookups (used in nearby API)
CREATE INDEX IF NOT EXISTS idx_restaurants_google_place_id 
ON restaurants(google_place_id) 
WHERE google_place_id IS NOT NULL;

-- Index for restaurant reviews by restaurant_id (used frequently)
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_id 
ON reviews(restaurant_id);

-- Index for reviews by user_id (used for user profiles)
CREATE INDEX IF NOT EXISTS idx_reviews_user_id 
ON reviews(user_id);

-- Composite index for follow queries (follower looking up following)
CREATE INDEX IF NOT EXISTS idx_follows_follower_id 
ON follows(follower_id, following_id);

-- Composite index for reverse follow queries (finding followers)
CREATE INDEX IF NOT EXISTS idx_follows_following_id 
ON follows(following_id, follower_id);

-- Index for reviews filtered by user and restaurant (common query pattern)
CREATE INDEX IF NOT EXISTS idx_reviews_user_restaurant 
ON reviews(user_id, restaurant_id);

-- Index for created_at timestamp queries (for recent reviews)
CREATE INDEX IF NOT EXISTS idx_reviews_created_at 
ON reviews(created_at DESC);

-- Index for profiles username lookup (used in search)
CREATE INDEX IF NOT EXISTS idx_profiles_username 
ON profiles(username);

-- Composite index for reviews with user_id in a list (used in nearby API)
-- This helps with the IN clause queries
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_user 
ON reviews(restaurant_id, user_id);

-- Index for restaurant location (PostGIS geometry column)
-- Only create if the location column exists (it's optional)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'restaurants' 
    AND column_name = 'location'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_restaurants_location 
    ON restaurants USING GIST(location);
  END IF;
END $$;

-- Analyze tables to update statistics for query planner
ANALYZE restaurants;
ANALYZE reviews;
ANALYZE follows;
ANALYZE profiles;

-- Verify indexes were created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
