-- ============================================================================
-- USER EMBEDDINGS - Additional embedding columns for user taste profiles
-- ============================================================================

-- Add new embedding columns to user_taste_profiles
ALTER TABLE user_taste_profiles 
  ADD COLUMN IF NOT EXISTS onboarding_embedding VECTOR(1536),
  ADD COLUMN IF NOT EXISTS onboarding_text TEXT,
  ADD COLUMN IF NOT EXISTS chat_embedding VECTOR(1536),
  ADD COLUMN IF NOT EXISTS chat_summary_text TEXT,
  ADD COLUMN IF NOT EXISTS reviews_embedding VECTOR(1536),
  ADD COLUMN IF NOT EXISTS reviews_summary_text TEXT,
  ADD COLUMN IF NOT EXISTS combined_embedding VECTOR(1536);

-- Comment on columns
COMMENT ON COLUMN user_taste_profiles.onboarding_embedding IS 'Embedding from onboarding preferences (likes, dislikes, dietary)';
COMMENT ON COLUMN user_taste_profiles.onboarding_text IS 'Text used to generate onboarding_embedding';
COMMENT ON COLUMN user_taste_profiles.chat_embedding IS 'Embedding from recent chat conversations';
COMMENT ON COLUMN user_taste_profiles.chat_summary_text IS 'Summary of recent chat preferences';
COMMENT ON COLUMN user_taste_profiles.reviews_embedding IS 'Embedding from user reviews';
COMMENT ON COLUMN user_taste_profiles.reviews_summary_text IS 'Summary of user review patterns';
COMMENT ON COLUMN user_taste_profiles.combined_embedding IS 'Weighted combination of all embeddings';

-- The existing taste_embedding can be kept for backwards compatibility
-- or renamed to combined_embedding

-- ============================================================================
-- STORED PROCEDURE: Combine user embeddings with weights
-- ============================================================================

CREATE OR REPLACE FUNCTION combine_user_embeddings(
  p_user_id UUID,
  p_onboarding_weight FLOAT DEFAULT 0.3,
  p_chat_weight FLOAT DEFAULT 0.4,
  p_reviews_weight FLOAT DEFAULT 0.3
) RETURNS VECTOR(1536) AS $$
DECLARE
  v_onboarding VECTOR(1536);
  v_chat VECTOR(1536);
  v_reviews VECTOR(1536);
  v_combined VECTOR(1536);
  v_result FLOAT[];
  i INT;
BEGIN
  -- Get embeddings
  SELECT onboarding_embedding, chat_embedding, reviews_embedding
  INTO v_onboarding, v_chat, v_reviews
  FROM user_taste_profiles
  WHERE user_id = p_user_id;
  
  -- If no embeddings, return null
  IF v_onboarding IS NULL AND v_chat IS NULL AND v_reviews IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Initialize result array
  v_result := ARRAY[]::FLOAT[];
  
  -- Weighted average (skip null embeddings)
  FOR i IN 1..1536 LOOP
    DECLARE
      total_weight FLOAT := 0;
      weighted_sum FLOAT := 0;
    BEGIN
      IF v_onboarding IS NOT NULL THEN
        weighted_sum := weighted_sum + (v_onboarding[i] * p_onboarding_weight);
        total_weight := total_weight + p_onboarding_weight;
      END IF;
      
      IF v_chat IS NOT NULL THEN
        weighted_sum := weighted_sum + (v_chat[i] * p_chat_weight);
        total_weight := total_weight + p_chat_weight;
      END IF;
      
      IF v_reviews IS NOT NULL THEN
        weighted_sum := weighted_sum + (v_reviews[i] * p_reviews_weight);
        total_weight := total_weight + p_reviews_weight;
      END IF;
      
      IF total_weight > 0 THEN
        v_result := v_result || (weighted_sum / total_weight);
      ELSE
        v_result := v_result || 0.0;
      END IF;
    END;
  END LOOP;
  
  RETURN v_result::VECTOR(1536);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Update combined embedding for a user
-- ============================================================================

CREATE OR REPLACE FUNCTION update_user_combined_embedding(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_taste_profiles
  SET combined_embedding = combine_user_embeddings(p_user_id),
      updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;
