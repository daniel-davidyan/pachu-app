-- ============================================
-- Fix Follows Table Column Name
-- ============================================
-- This migration ensures the follows table uses the correct column name
-- Some databases might have "followed_id" instead of "following_id"
-- This script will standardize it to "following_id"
-- ============================================

-- Check if the column is named "followed_id" and rename it to "following_id"
DO $$
BEGIN
  -- Check if followed_id column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'follows' AND column_name = 'followed_id'
  ) THEN
    -- Rename it to following_id
    ALTER TABLE follows RENAME COLUMN followed_id TO following_id;
    RAISE NOTICE 'Renamed followed_id to following_id';
  ELSE
    RAISE NOTICE 'Column already named following_id or does not exist';
  END IF;
END $$;

-- Verify the correct indexes exist
DROP INDEX IF EXISTS idx_follows_followed;
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);

-- Verify the unique constraint exists
ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_follower_id_followed_id_key;
ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_follower_id_following_id_key;
ALTER TABLE follows ADD CONSTRAINT follows_follower_id_following_id_key 
  UNIQUE (follower_id, following_id);

-- ============================================
-- Verification
-- ============================================
-- Check the columns
SELECT 
  'follows table columns' AS info,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'follows'
ORDER BY ordinal_position;

-- Check the indexes
SELECT 
  'follows table indexes' AS info,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'follows';

-- Check the constraints
SELECT 
  'follows table constraints' AS info,
  conname AS constraint_name,
  contype AS constraint_type
FROM pg_constraint 
WHERE conrelid = 'follows'::regclass;

-- ============================================
-- ✅ DONE! 
-- ============================================
-- The follows table now uses:
-- - follower_id (who is following)
-- - following_id (who is being followed)
-- This matches the DATABASE_SCHEMA.md specification
-- ============================================

