-- Quick Apply: Copy and paste this entire file into your Supabase SQL Editor
-- This will add all performance indexes to speed up map queries

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

-- Index for restaurant location-based queries (if we add PostGIS later)
CREATE INDEX IF NOT EXISTS idx_restaurants_location 
ON restaurants(latitude, longitude);

-- Index for created_at timestamp queries (for recent reviews)
CREATE INDEX IF NOT EXISTS idx_reviews_created_at 
ON reviews(created_at DESC);

-- Index for profiles username lookup (used in search)
CREATE INDEX IF NOT EXISTS idx_profiles_username 
ON profiles(username);

-- Composite index for reviews with user_id in a list (used in nearby API)
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_user 
ON reviews(restaurant_id, user_id);

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

