-- ============================================================================
-- PACHU RECOMMENDATION SYSTEM - SIMPLE VECTOR SEARCH FUNCTION
-- ============================================================================
-- A simplified vector search function that doesn't require location filtering.
-- This is used by the agent recommendation pipeline.
-- ============================================================================

-- ============================================================================
-- FUNCTION: search_restaurants_simple
-- ============================================================================
-- Simple vector search without location constraints.
-- Uses the summary_embedding column and returns restaurants sorted by similarity.
--
-- Parameters:
--   query_embedding: The embedding vector to search for (1536 dimensions)
--   max_results: Maximum number of results to return (default 30)
--
-- Returns: Table with restaurant details and similarity score (NO embedding returned)

CREATE OR REPLACE FUNCTION search_restaurants_simple(
  query_embedding VECTOR(1536),
  max_results INTEGER DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  google_place_id TEXT,
  name TEXT,
  address TEXT,
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  google_rating NUMERIC,
  google_reviews_count INTEGER,
  price_level INTEGER,
  categories TEXT[],
  summary TEXT,
  opening_hours JSONB,
  photos JSONB,
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
    rc.latitude,
    rc.longitude,
    rc.google_rating,
    rc.google_reviews_count,
    rc.price_level,
    rc.categories,
    rc.summary,
    rc.opening_hours,
    rc.photos,
    -- Cosine similarity: 1 - cosine distance
    -- pgvector's <=> operator returns cosine distance (0 = identical, 2 = opposite)
    (1 - (rc.summary_embedding <=> query_embedding))::DOUBLE PRECISION AS similarity
  FROM restaurant_cache rc
  WHERE rc.summary_embedding IS NOT NULL
  ORDER BY rc.summary_embedding <=> query_embedding
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION search_restaurants_simple TO authenticated;
GRANT EXECUTE ON FUNCTION search_restaurants_simple TO anon;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run this to verify the function was created:
-- SELECT proname FROM pg_proc WHERE proname = 'search_restaurants_simple';
