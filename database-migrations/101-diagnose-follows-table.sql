-- ============================================
-- Diagnose Follows Table Issues
-- ============================================
-- Run this to see what's wrong with your follows table
-- ============================================

-- 1. Check if follows table exists
SELECT 
  'TABLE EXISTS' AS check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'follows')
    THEN '✅ YES'
    ELSE '❌ NO - Table does not exist!'
  END AS result;

-- 2. Check column names in follows table
SELECT 
  'COLUMNS IN FOLLOWS TABLE' AS info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'follows'
ORDER BY ordinal_position;

-- 3. Check for followed_id vs following_id
SELECT 
  'COLUMN NAME CHECK' AS check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'follows' AND column_name = 'following_id'
    )
    THEN '✅ Has following_id (CORRECT)'
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'follows' AND column_name = 'followed_id'
    )
    THEN '⚠️ Has followed_id (NEEDS FIX)'
    ELSE '❌ Has neither column!'
  END AS result;

-- 4. Check RLS policies on follows table
SELECT 
  'RLS POLICIES' AS info,
  policyname AS policy_name,
  cmd AS command,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies 
WHERE tablename = 'follows';

-- 5. Check if RLS is enabled
SELECT 
  'RLS ENABLED' AS check_type,
  CASE 
    WHEN relrowsecurity = true 
    THEN '✅ YES'
    ELSE '❌ NO - RLS is disabled!'
  END AS result
FROM pg_class 
WHERE relname = 'follows';

-- 6. Count existing follows
SELECT 
  'EXISTING FOLLOWS COUNT' AS info,
  COUNT(*) AS total_follows
FROM follows;

-- 7. Show sample follows (if any exist)
SELECT 
  'SAMPLE FOLLOWS' AS info,
  *
FROM follows
LIMIT 5;

-- 8. Check indexes
SELECT 
  'INDEXES' AS info,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'follows';

-- 9. Check constraints
SELECT 
  'CONSTRAINTS' AS info,
  conname AS constraint_name,
  contype AS constraint_type,
  CASE contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'c' THEN 'CHECK'
    ELSE contype::text
  END AS description
FROM pg_constraint 
WHERE conrelid = 'follows'::regclass;

-- ============================================
-- INTERPRETATION GUIDE
-- ============================================
-- 
-- If you see:
-- ✅ Has following_id (CORRECT) - Good! Column is correct
-- ⚠️ Has followed_id (NEEDS FIX) - Run 100-fix-follows-column.sql
-- ❌ Has neither column - Table structure is broken, needs rebuild
-- 
-- If RLS is enabled but no policies exist:
-- - This will block ALL inserts/updates/deletes
-- - You need to add RLS policies (see below)
-- 
-- ============================================
-- FIX: Add RLS Policies if Missing
-- ============================================

-- Allow users to follow others (INSERT)
DROP POLICY IF EXISTS "Users can follow others" ON follows;
CREATE POLICY "Users can follow others" 
  ON follows FOR INSERT 
  WITH CHECK (auth.uid() = follower_id);

-- Allow users to unfollow (DELETE)
DROP POLICY IF EXISTS "Users can unfollow" ON follows;
CREATE POLICY "Users can unfollow" 
  ON follows FOR DELETE 
  USING (auth.uid() = follower_id);

-- Allow everyone to view follows (SELECT)
DROP POLICY IF EXISTS "Follows are viewable by everyone" ON follows;
CREATE POLICY "Follows are viewable by everyone" 
  ON follows FOR SELECT 
  USING (true);

-- ============================================
-- VERIFICATION
-- ============================================
-- After running the fixes above, run this again to verify
-- ============================================

SELECT 
  '=== FINAL CHECK ===' AS info,
  CASE 
    WHEN (
      SELECT COUNT(*) 
      FROM information_schema.columns 
      WHERE table_name = 'follows' AND column_name = 'following_id'
    ) > 0
    AND (
      SELECT COUNT(*) 
      FROM pg_policies 
      WHERE tablename = 'follows' AND cmd = 'INSERT'
    ) > 0
    THEN '✅ Everything looks good! Try following again.'
    ELSE '⚠️ Still have issues. Check the output above.'
  END AS status;

