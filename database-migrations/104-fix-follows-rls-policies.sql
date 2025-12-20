-- ============================================
-- Fix Follows Table RLS Policies
-- ============================================
-- This migration ensures RLS policies are correctly set up
-- Run this if you're getting follow/unfollow errors
-- ============================================

-- First, make sure RLS is enabled
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can follow others" ON follows;
DROP POLICY IF EXISTS "Users can unfollow" ON follows;
DROP POLICY IF EXISTS "Follows are viewable by everyone" ON follows;

-- Create fresh RLS policies
-- 1. Allow everyone to view follows
CREATE POLICY "Follows are viewable by everyone" 
  ON follows 
  FOR SELECT 
  USING (true);

-- 2. Allow users to follow others (INSERT)
CREATE POLICY "Users can follow others" 
  ON follows 
  FOR INSERT 
  WITH CHECK (auth.uid() = follower_id);

-- 3. Allow users to unfollow (DELETE)
CREATE POLICY "Users can unfollow" 
  ON follows 
  FOR DELETE 
  USING (auth.uid() = follower_id);

-- Verify the policies were created
SELECT 
  '=== FOLLOWS TABLE RLS POLICIES ===' AS info,
  policyname AS policy_name,
  cmd AS command,
  CASE 
    WHEN cmd = 'SELECT' THEN 'Anyone can view follows'
    WHEN cmd = 'INSERT' THEN 'Users can follow others'
    WHEN cmd = 'DELETE' THEN 'Users can unfollow'
  END AS description
FROM pg_policies 
WHERE tablename = 'follows'
ORDER BY cmd;

-- ============================================
-- ✅ DONE! 
-- ============================================
-- RLS policies are now properly configured
-- ============================================

