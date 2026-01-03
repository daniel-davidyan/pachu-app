-- ========================================
-- Helper Functions for Restaurant Cache Population
-- Run this AFTER 200-recommendation-system-tables.sql
-- ========================================

-- Drop existing functions first (to handle signature changes)
DROP FUNCTION IF EXISTS upsert_restaurant_cache(TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, NUMERIC, INTEGER, INTEGER, TEXT[], BOOLEAN, BOOLEAN, JSONB, JSONB, JSONB, TEXT, VECTOR);
DROP FUNCTION IF EXISTS update_restaurant_location(TEXT, DOUBLE PRECISION, DOUBLE PRECISION);

-- Function to upsert restaurant with proper PostGIS location
CREATE OR REPLACE FUNCTION upsert_restaurant_cache(
  p_google_place_id TEXT,
  p_name TEXT,
  p_address TEXT,
  p_city TEXT,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_phone TEXT,
  p_website TEXT,
  p_google_rating NUMERIC,
  p_google_reviews_count INTEGER,
  p_price_level INTEGER,
  p_cuisine_types TEXT[],
  p_is_kosher BOOLEAN,
  p_is_vegetarian_friendly BOOLEAN,
  p_opening_hours JSONB,
  p_photos JSONB,
  p_google_reviews JSONB,
  p_summary_text TEXT,
  p_embedding VECTOR(1536)
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO restaurant_cache (
    google_place_id,
    name,
    address,
    city,
    location,
    phone,
    website,
    google_rating,
    google_reviews_count,
    price_level,
    cuisine_types,
    is_kosher,
    is_vegetarian_friendly,
    opening_hours,
    photos,
    google_reviews,
    summary_text,
    embedding,
    last_updated
  ) VALUES (
    p_google_place_id,
    p_name,
    p_address,
    p_city,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    p_phone,
    p_website,
    p_google_rating,
    p_google_reviews_count,
    p_price_level,
    p_cuisine_types,
    p_is_kosher,
    p_is_vegetarian_friendly,
    p_opening_hours,
    p_photos,
    p_google_reviews,
    p_summary_text,
    p_embedding,
    NOW()
  )
  ON CONFLICT (google_place_id) 
  DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    location = EXCLUDED.location,
    phone = EXCLUDED.phone,
    website = EXCLUDED.website,
    google_rating = EXCLUDED.google_rating,
    google_reviews_count = EXCLUDED.google_reviews_count,
    price_level = EXCLUDED.price_level,
    cuisine_types = EXCLUDED.cuisine_types,
    is_kosher = EXCLUDED.is_kosher,
    is_vegetarian_friendly = EXCLUDED.is_vegetarian_friendly,
    opening_hours = EXCLUDED.opening_hours,
    photos = EXCLUDED.photos,
    google_reviews = EXCLUDED.google_reviews,
    summary_text = EXCLUDED.summary_text,
    embedding = EXCLUDED.embedding,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to update just the location (fallback)
CREATE OR REPLACE FUNCTION update_restaurant_location(
  p_google_place_id TEXT,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION
)
RETURNS VOID AS $$
BEGIN
  UPDATE restaurant_cache 
  SET location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  WHERE google_place_id = p_google_place_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION upsert_restaurant_cache TO authenticated;
GRANT EXECUTE ON FUNCTION update_restaurant_location TO authenticated;

-- ========================================
-- Useful Queries for Monitoring
-- ========================================

-- Check cache statistics
-- SELECT 
--   COUNT(*) as total,
--   COUNT(embedding) as with_embedding,
--   COUNT(location) as with_location,
--   COUNT(DISTINCT city) as cities
-- FROM restaurant_cache;

-- Check by city
-- SELECT city, COUNT(*) as count 
-- FROM restaurant_cache 
-- GROUP BY city 
-- ORDER BY count DESC;

-- Check restaurants without embeddings
-- SELECT name, google_place_id 
-- FROM restaurant_cache 
-- WHERE embedding IS NULL;

-- ========================================
-- Index Creation (Run AFTER populating cache)
-- ========================================

-- NOTE: Run this AFTER the cache is populated with at least 1000 restaurants
-- The ivfflat index requires data to be effective

-- CREATE INDEX idx_restaurant_cache_embedding 
-- ON restaurant_cache 
-- USING ivfflat (embedding vector_cosine_ops) 
-- WITH (lists = 100);

-- Verify index was created:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'restaurant_cache';

