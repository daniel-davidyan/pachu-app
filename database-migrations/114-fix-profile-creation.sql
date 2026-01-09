-- Migration: Fix Profile Creation for New Users
-- This fixes the issue where new users can't be created after database cleanup

-- =============================================
-- 1. Drop and recreate the handle_new_user function
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INTEGER := 0;
BEGIN
  -- Generate base username from user metadata or email
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    LOWER(REGEXP_REPLACE(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), '[^a-zA-Z0-9_]', '_', 'g')),
    LOWER(REGEXP_REPLACE(SPLIT_PART(COALESCE(NEW.email, 'user'), '@', 1), '[^a-zA-Z0-9_]', '_', 'g')),
    'user'
  );
  
  -- Ensure username starts with a letter and is between 3-30 chars
  base_username := REGEXP_REPLACE(base_username, '^[^a-zA-Z]+', '');
  IF LENGTH(base_username) < 3 THEN
    base_username := 'user';
  END IF;
  base_username := LEFT(base_username, 25);
  
  -- Try to find a unique username
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || '_' || counter;
    IF counter > 100 THEN
      -- Fallback to random suffix
      final_username := base_username || '_' || SUBSTR(MD5(RANDOM()::TEXT), 1, 6);
      EXIT;
    END IF;
  END LOOP;
  
  -- Insert the profile
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', final_username),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  );
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the auth signup
  RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 2. Drop and recreate the trigger
-- =============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 3. Add INSERT policy for profiles table
-- =============================================
-- Drop if exists to avoid duplicates
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;

-- Create INSERT policy - users can insert their own profile
CREATE POLICY "Users can insert own profile" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- =============================================
-- 4. Verify RLS is enabled and other policies exist
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Ensure SELECT policy exists
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
  ON profiles FOR SELECT 
  USING (true);

-- Ensure UPDATE policy exists
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

-- =============================================
-- 5. Create profiles for any existing auth.users without profiles
-- =============================================
INSERT INTO profiles (id, username, full_name, avatar_url)
SELECT 
  au.id,
  COALESCE(
    au.raw_user_meta_data->>'username',
    LOWER(REGEXP_REPLACE(COALESCE(au.raw_user_meta_data->>'full_name', ''), '[^a-zA-Z0-9_]', '_', 'g')),
    LOWER(REGEXP_REPLACE(SPLIT_PART(COALESCE(au.email, 'user'), '@', 1), '[^a-zA-Z0-9_]', '_', 'g')),
    'user_' || SUBSTR(au.id::TEXT, 1, 8)
  ),
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', au.email),
  COALESCE(au.raw_user_meta_data->>'avatar_url', au.raw_user_meta_data->>'picture')
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE p.id IS NULL;

-- =============================================
-- 6. Show results
-- =============================================
DO $$
DECLARE
  profile_count INTEGER;
  user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO profile_count FROM profiles;
  SELECT COUNT(*) INTO user_count FROM auth.users;
  
  RAISE NOTICE '===================================';
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Total auth.users: %', user_count;
  RAISE NOTICE 'Total profiles: %', profile_count;
  RAISE NOTICE '===================================';
END $$;
