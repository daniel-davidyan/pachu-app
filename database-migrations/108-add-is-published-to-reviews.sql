-- Add is_published column to reviews table
-- This allows users to save experiences without publishing them publicly
-- Unpublished experiences help learn user preferences for recommendations

-- Add the column (default to true for existing reviews)
ALTER TABLE reviews 
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true NOT NULL;

-- Create index for efficient querying of published vs unpublished reviews
CREATE INDEX IF NOT EXISTS idx_reviews_is_published ON reviews(is_published);
CREATE INDEX IF NOT EXISTS idx_reviews_user_published ON reviews(user_id, is_published);

-- Update existing reviews to be published (they were all published before this feature)
UPDATE reviews SET is_published = true WHERE is_published IS NULL;

-- Comment for documentation
COMMENT ON COLUMN reviews.is_published IS 'Whether the review is published publicly or saved privately for recommendations';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Added is_published column to reviews table';
  RAISE NOTICE 'Existing reviews have been marked as published';
  RAISE NOTICE 'New reviews can be saved as published (true) or unpublished (false)';
END $$;

