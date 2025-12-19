-- Migration: Allow Multiple Reviews Per Restaurant
-- This removes the unique constraint on (user_id, restaurant_id)
-- to allow users to share multiple experiences at the same restaurant

-- First, let's check if the constraint exists
DO $$
BEGIN
  -- Drop the unique constraint if it exists
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'reviews_user_id_restaurant_id_key'
  ) THEN
    ALTER TABLE reviews DROP CONSTRAINT reviews_user_id_restaurant_id_key;
    RAISE NOTICE 'Unique constraint on (user_id, restaurant_id) has been removed';
  ELSE
    RAISE NOTICE 'Constraint does not exist, nothing to remove';
  END IF;
END $$;

-- Verify the change
SELECT 
  'Reviews table constraints' AS info,
  conname AS constraint_name,
  contype AS constraint_type
FROM pg_constraint 
WHERE conrelid = 'reviews'::regclass;

