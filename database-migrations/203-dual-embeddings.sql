-- ============================================================================
-- DUAL EMBEDDINGS - Summary + Reviews
-- ============================================================================
-- Adds separate embedding columns for summary and reviews to enable A/B testing
-- and hybrid search approaches.
-- ============================================================================

-- Rename existing embedding column to summary_embedding for clarity
ALTER TABLE restaurant_cache 
  RENAME COLUMN embedding TO summary_embedding;

-- Add reviews_embedding column
ALTER TABLE restaurant_cache 
  ADD COLUMN IF NOT EXISTS reviews_embedding VECTOR(1536);

-- Add reviews_text column to store the concatenated reviews text used for embedding
ALTER TABLE restaurant_cache 
  ADD COLUMN IF NOT EXISTS reviews_text TEXT;

-- ============================================================================
-- INDEXES FOR VECTOR SEARCH
-- ============================================================================
-- Note: IVFFlat indexes should be created AFTER data is populated.
-- Run these manually after embeddings are generated:
--
-- For summary embeddings:
-- CREATE INDEX idx_restaurant_cache_summary_embedding 
--   ON restaurant_cache USING ivfflat (summary_embedding vector_cosine_ops) WITH (lists = 100);
--
-- For reviews embeddings:
-- CREATE INDEX idx_restaurant_cache_reviews_embedding 
--   ON restaurant_cache USING ivfflat (reviews_embedding vector_cosine_ops) WITH (lists = 100);
-- ============================================================================

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run this to verify:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'restaurant_cache' AND column_name LIKE '%embedding%';
