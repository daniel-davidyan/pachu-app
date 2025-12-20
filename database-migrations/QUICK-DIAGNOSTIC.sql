-- ============================================
-- Quick Diagnostic for Follows Table
-- ============================================
-- Run this in Supabase SQL Editor to diagnose follow issues
-- ============================================

-- 1. Check if follows table exists and has correct structure
SELECT 
  '1. TABLE STRUCTURE' AS section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'follows'
ORDER BY ordinal_position;

-- 2. Check if RLS is enabled
SELECT 
  '2. RLS STATUS' AS section,
  CASE 
    WHEN relrowsecurity = true 
    THEN '✅ RLS is ENABLED'
    ELSE '❌ RLS is DISABLED - This will cause issues!'
  END AS status
FROM pg_class 
WHERE relname = 'follows';

-- 3. Check RLS policies
SELECT 
  '3. RLS POLICIES' AS section,
  policyname AS policy_name,
  cmd AS command,
  CASE cmd
    WHEN 'SELECT' THEN '✅ Allows viewing follows'
    WHEN 'INSERT' THEN '✅ Allows following users'
    WHEN 'DELETE' THEN '✅ Allows unfollowing users'
    ELSE 'Unknown command'
  END AS purpose
FROM pg_policies 
WHERE tablename = 'follows'
ORDER BY cmd;

-- 4. Check for column name (should be following_id, not followed_id)
SELECT 
  '4. COLUMN NAME CHECK' AS section,
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
    THEN '⚠️ Has followed_id (NEEDS FIX - run 100-fix-follows-column.sql)'
    ELSE '❌ Missing both columns - table structure is broken!'
  END AS status;

-- 5. Check constraints
SELECT 
  '5. CONSTRAINTS' AS section,
  conname AS constraint_name,
  CASE contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'c' THEN 'CHECK'
    ELSE contype::text
  END AS constraint_type
FROM pg_constraint 
WHERE conrelid = 'follows'::regclass
ORDER BY contype;

-- 6. Count existing follows
SELECT 
  '6. DATA CHECK' AS section,
  'Total follows in database' AS metric,
  COUNT(*)::text AS value
FROM follows;

-- 7. Check if current user can query follows
SELECT 
  '7. PERMISSION TEST' AS section,
  'Your user can read follows table' AS test,
  'YES ✅' AS result
FROM follows
LIMIT 1;

-- ============================================
-- INTERPRETATION
-- ============================================
-- 
-- What you should see:
-- ✅ RLS is ENABLED
-- ✅ 3 policies (SELECT, INSERT, DELETE)
-- ✅ Has following_id column
-- ✅ Constraints for uniqueness and foreign keys
-- 
-- If you see any ❌ or ⚠️:
-- - Run database-migrations/104-fix-follows-rls-policies.sql
-- - Run database-migrations/100-fix-follows-column.sql
-- ============================================

