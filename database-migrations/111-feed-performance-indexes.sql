-- Migration: Add Performance Indexes for Feed and Detail Page Queries
-- Created: 2026-01-08
-- Description: Optimize database queries for TikTok-like speed
-- Target: Sub-second response times for feed, restaurant, and profile pages

-- =====================================================
-- FEED QUERY OPTIMIZATIONS
-- =====================================================

-- Composite index for feed queries (reviews with is_published filter)
-- This dramatically speeds up the main feed query
CREATE INDEX IF NOT EXISTS idx_reviews_published_created 
ON reviews(is_published, created_at DESC) 
WHERE is_published = true;

-- Index for restaurant lookups in feed with published filter
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_published 
ON reviews(restaurant_id, is_published) 
WHERE is_published = true;

-- Composite index for user's published reviews (for following tab)
CREATE INDEX IF NOT EXISTS idx_reviews_user_published_created
ON reviews(user_id, is_published, created_at DESC)
WHERE is_published = true;

-- =====================================================
-- MEDIA QUERY OPTIMIZATIONS
-- =====================================================

-- Index for photos with review_id and sort_order (covers the common query)
CREATE INDEX IF NOT EXISTS idx_review_photos_review_sort 
ON review_photos(review_id, sort_order);

-- Index for videos with review_id and sort_order
CREATE INDEX IF NOT EXISTS idx_review_videos_review_sort 
ON review_videos(review_id, sort_order);

-- Index for recent videos (used in foryou tab)
CREATE INDEX IF NOT EXISTS idx_review_videos_created
ON review_videos(created_at DESC);

-- =====================================================
-- SOCIAL FEATURES OPTIMIZATIONS
-- =====================================================

-- Index for likes count queries (aggregation)
CREATE INDEX IF NOT EXISTS idx_review_likes_review 
ON review_likes(review_id);

-- Index for user's own likes (checking if liked)
CREATE INDEX IF NOT EXISTS idx_review_likes_user_review
ON review_likes(user_id, review_id);

-- Index for comments count queries
CREATE INDEX IF NOT EXISTS idx_review_comments_review 
ON review_comments(review_id);

-- =====================================================
-- WISHLIST OPTIMIZATIONS
-- =====================================================

-- Composite index for wishlist lookups (user + restaurant)
CREATE INDEX IF NOT EXISTS idx_wishlist_user_restaurant 
ON wishlist(user_id, restaurant_id);

-- =====================================================
-- RESTAURANT CACHE OPTIMIZATIONS
-- =====================================================

-- Index for restaurant cache by google_place_id (used for embedding lookups)
CREATE INDEX IF NOT EXISTS idx_restaurant_cache_place_id
ON restaurant_cache(google_place_id);

-- Index for restaurant cache location queries
CREATE INDEX IF NOT EXISTS idx_restaurant_cache_location
ON restaurant_cache(latitude, longitude);

-- =====================================================
-- TASTE PROFILE OPTIMIZATIONS
-- =====================================================

-- Index for user taste profiles (used in match score calculation)
CREATE INDEX IF NOT EXISTS idx_user_taste_profiles_user
ON user_taste_profiles(user_id);

-- =====================================================
-- ANALYZE TABLES
-- =====================================================

-- Update statistics for query planner
ANALYZE reviews;
ANALYZE review_photos;
ANALYZE review_videos;
ANALYZE review_likes;
ANALYZE review_comments;
ANALYZE wishlist;
ANALYZE restaurant_cache;
ANALYZE profiles;
ANALYZE follows;
