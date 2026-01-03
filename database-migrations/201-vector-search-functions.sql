-- ============================================================================
-- PACHU RECOMMENDATION SYSTEM - VECTOR SEARCH FUNCTIONS
-- ============================================================================
-- This migration creates the functions needed for semantic restaurant search
-- using pgvector for similarity matching.
-- ============================================================================

-- ============================================================================
-- FUNCTION: search_restaurants_by_embedding
-- ============================================================================
-- Main vector search function that finds restaurants similar to a query embedding
-- within a specified radius from the user's location.
--
-- Parameters:
--   query_embedding: VECTOR(1536) - The embedding to search for
--   user_lat: DOUBLE PRECISION - User's latitude
--   user_lng: DOUBLE PRECISION - User's longitude
--   radius_meters: INTEGER - Search radius in meters (default 5000)
--   max_results: INTEGER - Maximum number of results (default 100)
--   filter_kosher: BOOLEAN - If true, only return kosher restaurants
--   filter_vegetarian: BOOLEAN - If true, only return vegetarian-friendly restaurants
--
-- Returns: Table with restaurant details, distance, and similarity score

CREATE OR REPLACE FUNCTION search_restaurants_by_embedding(
  query_embedding VECTOR(1536),
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 5000,
  max_results INTEGER DEFAULT 100,
  filter_kosher BOOLEAN DEFAULT FALSE,
  filter_vegetarian BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  google_place_id TEXT,
  name TEXT,
  address TEXT,
  city TEXT,
  phone TEXT,
  website TEXT,
  google_rating NUMERIC,
  google_reviews_count INTEGER,
  price_level INTEGER,
  cuisine_types TEXT[],
  is_kosher BOOLEAN,
  is_vegetarian_friendly BOOLEAN,
  opening_hours JSONB,
  photos JSONB,
  google_reviews JSONB,
  summary_text TEXT,
  distance_meters DOUBLE PRECISION,
  similarity DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rc.id,
    rc.google_place_id,
    rc.name,
    rc.address,
    rc.city,
    rc.phone,
    rc.website,
    rc.google_rating,
    rc.google_reviews_count,
    rc.price_level,
    rc.cuisine_types,
    rc.is_kosher,
    rc.is_vegetarian_friendly,
    rc.opening_hours,
    rc.photos,
    rc.google_reviews,
    rc.summary_text,
    ST_Distance(
      rc.location::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) AS distance_meters,
    1 - (rc.embedding <=> query_embedding) AS similarity
  FROM restaurant_cache rc
  WHERE rc.location IS NOT NULL
    AND rc.embedding IS NOT NULL
    AND ST_DWithin(
      rc.location::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_meters
    )
    -- Apply kosher filter only if requested
    AND (NOT filter_kosher OR rc.is_kosher = TRUE)
    -- Apply vegetarian filter only if requested
    AND (NOT filter_vegetarian OR rc.is_vegetarian_friendly = TRUE)
  ORDER BY rc.embedding <=> query_embedding
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: search_restaurants_by_text
-- ============================================================================
-- Search restaurants by name or cuisine type (for quick lookups)
--
-- Parameters:
--   search_query: TEXT - Search term
--   user_lat: DOUBLE PRECISION - User's latitude
--   user_lng: DOUBLE PRECISION - User's longitude
--   radius_meters: INTEGER - Search radius in meters (default 10000)
--   max_results: INTEGER - Maximum number of results (default 50)

CREATE OR REPLACE FUNCTION search_restaurants_by_text(
  search_query TEXT,
  user_lat DOUBLE PRECISION DEFAULT NULL,
  user_lng DOUBLE PRECISION DEFAULT NULL,
  radius_meters INTEGER DEFAULT 10000,
  max_results INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  google_place_id TEXT,
  name TEXT,
  address TEXT,
  city TEXT,
  google_rating NUMERIC,
  cuisine_types TEXT[],
  summary_text TEXT,
  distance_meters DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rc.id,
    rc.google_place_id,
    rc.name,
    rc.address,
    rc.city,
    rc.google_rating,
    rc.cuisine_types,
    rc.summary_text,
    CASE 
      WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
        ST_Distance(
          rc.location::geography,
          ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
        )
      ELSE NULL
    END AS distance_meters
  FROM restaurant_cache rc
  WHERE (
    rc.name ILIKE '%' || search_query || '%'
    OR EXISTS (
      SELECT 1 FROM unnest(rc.cuisine_types) AS ct 
      WHERE ct ILIKE '%' || search_query || '%'
    )
    OR rc.city ILIKE '%' || search_query || '%'
  )
  AND (
    user_lat IS NULL 
    OR user_lng IS NULL
    OR ST_DWithin(
      rc.location::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_meters
    )
  )
  ORDER BY 
    CASE 
      WHEN rc.name ILIKE search_query || '%' THEN 0  -- Exact prefix match first
      WHEN rc.name ILIKE '%' || search_query || '%' THEN 1  -- Contains match
      ELSE 2
    END,
    rc.google_rating DESC NULLS LAST,
    distance_meters ASC NULLS LAST
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: get_restaurant_by_google_place_id
-- ============================================================================
-- Fetch a single restaurant from cache by Google Place ID

CREATE OR REPLACE FUNCTION get_restaurant_from_cache(
  p_google_place_id TEXT
)
RETURNS TABLE (
  id UUID,
  google_place_id TEXT,
  name TEXT,
  address TEXT,
  city TEXT,
  phone TEXT,
  website TEXT,
  google_rating NUMERIC,
  google_reviews_count INTEGER,
  price_level INTEGER,
  cuisine_types TEXT[],
  is_kosher BOOLEAN,
  is_vegetarian_friendly BOOLEAN,
  opening_hours JSONB,
  photos JSONB,
  google_reviews JSONB,
  summary_text TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rc.id,
    rc.google_place_id,
    rc.name,
    rc.address,
    rc.city,
    rc.phone,
    rc.website,
    rc.google_rating,
    rc.google_reviews_count,
    rc.price_level,
    rc.cuisine_types,
    rc.is_kosher,
    rc.is_vegetarian_friendly,
    rc.opening_hours,
    rc.photos,
    rc.google_reviews,
    rc.summary_text,
    ST_Y(rc.location::geometry) AS latitude,
    ST_X(rc.location::geometry) AS longitude
  FROM restaurant_cache rc
  WHERE rc.google_place_id = p_google_place_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: get_nearby_restaurants_from_cache
-- ============================================================================
-- Get restaurants from cache within a radius (without embedding search)

CREATE OR REPLACE FUNCTION get_nearby_restaurants_from_cache(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 5000,
  max_results INTEGER DEFAULT 100,
  filter_kosher BOOLEAN DEFAULT FALSE,
  filter_vegetarian BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  google_place_id TEXT,
  name TEXT,
  address TEXT,
  city TEXT,
  phone TEXT,
  website TEXT,
  google_rating NUMERIC,
  google_reviews_count INTEGER,
  price_level INTEGER,
  cuisine_types TEXT[],
  is_kosher BOOLEAN,
  is_vegetarian_friendly BOOLEAN,
  opening_hours JSONB,
  photos JSONB,
  summary_text TEXT,
  distance_meters DOUBLE PRECISION,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rc.id,
    rc.google_place_id,
    rc.name,
    rc.address,
    rc.city,
    rc.phone,
    rc.website,
    rc.google_rating,
    rc.google_reviews_count,
    rc.price_level,
    rc.cuisine_types,
    rc.is_kosher,
    rc.is_vegetarian_friendly,
    rc.opening_hours,
    rc.photos,
    rc.summary_text,
    ST_Distance(
      rc.location::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) AS distance_meters,
    ST_Y(rc.location::geometry) AS latitude,
    ST_X(rc.location::geometry) AS longitude
  FROM restaurant_cache rc
  WHERE rc.location IS NOT NULL
    AND ST_DWithin(
      rc.location::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_meters
    )
    AND (NOT filter_kosher OR rc.is_kosher = TRUE)
    AND (NOT filter_vegetarian OR rc.is_vegetarian_friendly = TRUE)
  ORDER BY distance_meters ASC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: calculate_match_score
-- ============================================================================
-- Calculate match score between a user's taste embedding and restaurant embeddings
-- This is the "passive" match score shown on map/feed without active conversation

CREATE OR REPLACE FUNCTION calculate_match_scores(
  p_user_id UUID,
  p_restaurant_ids UUID[]
)
RETURNS TABLE (
  restaurant_id UUID,
  match_score DOUBLE PRECISION
) AS $$
DECLARE
  v_taste_embedding VECTOR(1536);
BEGIN
  -- Get user's taste embedding
  SELECT taste_embedding INTO v_taste_embedding
  FROM user_taste_profiles
  WHERE user_id = p_user_id;
  
  -- If no taste profile, return default scores
  IF v_taste_embedding IS NULL THEN
    RETURN QUERY
    SELECT 
      unnest(p_restaurant_ids) AS restaurant_id,
      0.75::DOUBLE PRECISION AS match_score;  -- Default 75%
    RETURN;
  END IF;
  
  -- Calculate scores for each restaurant
  RETURN QUERY
  SELECT 
    rc.id AS restaurant_id,
    -- Match score formula:
    -- 50% from taste similarity
    -- 25% from Google rating (normalized to 0-1)
    -- 25% from social signals (future: friends who liked it)
    (
      0.50 * (1 - (rc.embedding <=> v_taste_embedding)) +
      0.25 * COALESCE(rc.google_rating / 5.0, 0.7) +
      0.25 * 0.75  -- Placeholder for friends_score, will be updated
    )::DOUBLE PRECISION AS match_score
  FROM restaurant_cache rc
  WHERE rc.id = ANY(p_restaurant_ids)
    AND rc.embedding IS NOT NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: get_user_signals_summary
-- ============================================================================
-- Get a summary of user's taste signals for building taste text

CREATE OR REPLACE FUNCTION get_user_signals_summary(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  signal_type TEXT,
  is_positive BOOLEAN,
  content TEXT,
  cuisine_types TEXT[],
  restaurant_name TEXT,
  signal_strength INTEGER,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uts.signal_type,
    uts.is_positive,
    uts.content,
    uts.cuisine_types,
    uts.restaurant_name,
    uts.signal_strength,
    uts.created_at
  FROM user_taste_signals uts
  WHERE uts.user_id = p_user_id
  ORDER BY uts.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION search_restaurants_by_embedding TO authenticated;
GRANT EXECUTE ON FUNCTION search_restaurants_by_embedding TO anon;

GRANT EXECUTE ON FUNCTION search_restaurants_by_text TO authenticated;
GRANT EXECUTE ON FUNCTION search_restaurants_by_text TO anon;

GRANT EXECUTE ON FUNCTION get_restaurant_from_cache TO authenticated;
GRANT EXECUTE ON FUNCTION get_restaurant_from_cache TO anon;

GRANT EXECUTE ON FUNCTION get_nearby_restaurants_from_cache TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_restaurants_from_cache TO anon;

GRANT EXECUTE ON FUNCTION calculate_match_scores TO authenticated;

GRANT EXECUTE ON FUNCTION get_user_signals_summary TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run these to verify functions were created:
-- SELECT proname FROM pg_proc WHERE proname LIKE '%restaurant%' OR proname LIKE '%match%' OR proname LIKE '%signal%';

