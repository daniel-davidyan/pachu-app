-- Create a test user directly via SQL
-- Run this in Supabase SQL Editor

-- First, let's check authentication settings
SELECT current_setting('app.settings.jwt_secret', true) as jwt_configured;

-- Create user with a known password
-- Note: This inserts directly into auth.users which requires proper permissions
-- If this doesn't work, we'll need to use the Supabase dashboard differently

-- Alternative: Check if any users exist
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

