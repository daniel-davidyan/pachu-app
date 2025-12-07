-- ============================================
-- Dummy Data for "Following" Feed Feature
-- ============================================
-- This migration adds:
-- 1. Dummy friend users
-- 2. Follow relationships
-- 3. Restaurants in Tel Aviv
-- 4. Reviews from friends
--
-- TO USE: 
-- Replace 'YOUR_USER_ID' with your actual user ID from auth.users
-- Then run this in Supabase SQL Editor
-- ============================================

-- First, let's fix the follows table column name if needed
-- (The API uses 'followed_id' but schema shows 'following_id')
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'follows' AND column_name = 'following_id'
  ) THEN
    ALTER TABLE follows RENAME COLUMN following_id TO followed_id;
  END IF;
END $$;

-- ============================================
-- 1. CREATE DUMMY FRIEND USERS
-- ============================================

-- Note: These are inserted directly into auth.users which normally
-- shouldn't be done manually, but for testing purposes it's okay.
-- In production, users would sign up normally.

-- Daniel Davidyan
INSERT INTO auth.users (
  id, 
  email, 
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at,
  instance_id,
  aud,
  role
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'daniel@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  '{"username": "danieldavidyan", "full_name": "Daniel Davidyan", "avatar_url": "https://i.pravatar.cc/150?img=12"}',
  NOW(),
  NOW(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Rotem Cohen
INSERT INTO auth.users (
  id, 
  email, 
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at,
  instance_id,
  aud,
  role
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  'rotem@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  '{"username": "rotemcohen", "full_name": "Rotem Cohen", "avatar_url": "https://i.pravatar.cc/150?img=47"}',
  NOW(),
  NOW(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Nir Shvili
INSERT INTO auth.users (
  id, 
  email, 
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at,
  instance_id,
  aud,
  role
) VALUES (
  '33333333-3333-3333-3333-333333333333',
  'nir@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  '{"username": "nirshvili", "full_name": "Nir Shvili", "avatar_url": "https://i.pravatar.cc/150?img=33"}',
  NOW(),
  NOW(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Amit Chimya
INSERT INTO auth.users (
  id, 
  email, 
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at,
  instance_id,
  aud,
  role
) VALUES (
  '44444444-4444-4444-4444-444444444444',
  'amit@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  '{"username": "amitchimya", "full_name": "Amit Chimya", "avatar_url": "https://i.pravatar.cc/150?img=68"}',
  NOW(),
  NOW(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Aviv Samir
INSERT INTO auth.users (
  id, 
  email, 
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at,
  instance_id,
  aud,
  role
) VALUES (
  '55555555-5555-5555-5555-555555555555',
  'aviv@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  '{"username": "avivsamir", "full_name": "Aviv Samir", "avatar_url": "https://i.pravatar.cc/150?img=56"}',
  NOW(),
  NOW(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Create profiles for dummy users (will be done automatically by trigger)
-- But let's ensure they exist
INSERT INTO profiles (id, username, full_name, avatar_url) VALUES
  ('11111111-1111-1111-1111-111111111111', 'danieldavidyan', 'Daniel Davidyan', 'https://i.pravatar.cc/150?img=12'),
  ('22222222-2222-2222-2222-222222222222', 'rotemcohen', 'Rotem Cohen', 'https://i.pravatar.cc/150?img=47'),
  ('33333333-3333-3333-3333-333333333333', 'nirshvili', 'Nir Shvili', 'https://i.pravatar.cc/150?img=33'),
  ('44444444-4444-4444-4444-444444444444', 'amitchimya', 'Amit Chimya', 'https://i.pravatar.cc/150?img=68'),
  ('55555555-5555-5555-5555-555555555555', 'avivsamir', 'Aviv Samir', 'https://i.pravatar.cc/150?img=56')
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  avatar_url = EXCLUDED.avatar_url;

-- ============================================
-- 2. CREATE FOLLOW RELATIONSHIPS
-- ============================================
-- Replace 'YOUR_USER_ID' with your actual user ID!

-- YOU follow all these friends
INSERT INTO follows (follower_id, followed_id) VALUES
  ('YOUR_USER_ID', '11111111-1111-1111-1111-111111111111'), -- Daniel
  ('YOUR_USER_ID', '22222222-2222-2222-2222-222222222222'), -- Rotem
  ('YOUR_USER_ID', '33333333-3333-3333-3333-333333333333'), -- Nir
  ('YOUR_USER_ID', '44444444-4444-4444-4444-444444444444'), -- Amit
  ('YOUR_USER_ID', '55555555-5555-5555-5555-555555555555')  -- Aviv
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. CREATE RESTAURANTS IN TEL AVIV
-- ============================================

-- Mela (as shown in the image)
INSERT INTO restaurants (
  id,
  name,
  address,
  city,
  country,
  location,
  latitude,
  longitude,
  image_url,
  cuisine_types,
  price_level,
  average_rating,
  total_reviews
) VALUES (
  '10000000-0000-0000-0000-000000000001',
  'Mela',
  'Dizengoff St 159, Tel Aviv',
  'Tel Aviv',
  'Israel',
  ST_SetSRID(ST_MakePoint(34.7750, 32.0853), 4326),
  32.0853,
  34.7750,
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
  ARRAY['Mediterranean', 'Israeli', 'Middle Eastern'],
  2,
  4.6,
  0
) ON CONFLICT (id) DO NOTHING;

-- Shiner (as shown in the image)
INSERT INTO restaurants (
  id,
  name,
  address,
  city,
  country,
  location,
  latitude,
  longitude,
  image_url,
  cuisine_types,
  price_level,
  average_rating,
  total_reviews
) VALUES (
  '10000000-0000-0000-0000-000000000002',
  'Shiner',
  'Rothschild Blvd 12, Tel Aviv',
  'Tel Aviv',
  'Israel',
  ST_SetSRID(ST_MakePoint(34.7650, 32.0650), 4326),
  32.0650,
  34.7650,
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
  ARRAY['Bar', 'Pub', 'International'],
  2,
  4.4,
  0
) ON CONFLICT (id) DO NOTHING;

-- Additional restaurants
INSERT INTO restaurants (
  id,
  name,
  address,
  city,
  country,
  location,
  latitude,
  longitude,
  image_url,
  cuisine_types,
  price_level,
  average_rating,
  total_reviews
) VALUES 
  (
    '10000000-0000-0000-0000-000000000003',
    'Port Said',
    'Har Sinai St 5, Tel Aviv',
    'Tel Aviv',
    'Israel',
    ST_SetSRID(ST_MakePoint(34.7599, 32.0668), 4326),
    32.0668,
    34.7599,
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
    ARRAY['Mediterranean', 'Breakfast', 'Brunch'],
    2,
    4.7,
    0
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'Taizu',
    'Menachem Begin Rd 23, Tel Aviv',
    'Tel Aviv',
    'Israel',
    ST_SetSRID(ST_MakePoint(34.7870, 32.0700), 4326),
    32.0700,
    34.7870,
    'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800',
    ARRAY['Asian', 'Fusion', 'Fine Dining'],
    3,
    4.8,
    0
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    'Ouzeria',
    'Yirmiyahu St 44, Tel Aviv',
    'Tel Aviv',
    'Israel',
    ST_SetSRID(ST_MakePoint(34.7820, 32.0930), 4326),
    32.0930,
    34.7820,
    'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    ARRAY['Greek', 'Mediterranean', 'Seafood'],
    2,
    4.5,
    0
  ),
  (
    '10000000-0000-0000-0000-000000000006',
    'Manta Ray',
    'Alma Beach, Tel Aviv',
    'Tel Aviv',
    'Israel',
    ST_SetSRID(ST_MakePoint(34.7548, 32.0709), 4326),
    32.0709,
    34.7548,
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800',
    ARRAY['Seafood', 'Mediterranean', 'Beach'],
    3,
    4.6,
    0
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. CREATE REVIEWS FROM FRIENDS
-- ============================================

-- Daniel's reviews
INSERT INTO reviews (user_id, restaurant_id, rating, content, created_at) VALUES
  ('11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000001', 5, 'Best place I have ever been to. Friendly staff, very nice location. Food was amazing.', NOW() - INTERVAL '2 days'),
  ('11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000003', 5, 'Amazing breakfast spot! The shakshuka is incredible.', NOW() - INTERVAL '5 days'),
  ('11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000004', 4, 'Innovative Asian fusion. A bit pricey but worth it for special occasions.', NOW() - INTERVAL '10 days')
ON CONFLICT (user_id, restaurant_id) DO NOTHING;

-- Rotem's reviews  
INSERT INTO reviews (user_id, restaurant_id, rating, content, created_at) VALUES
  ('22222222-2222-2222-2222-222222222222', '10000000-0000-0000-0000-000000000001', 4, 'Great food and atmosphere. The hummus is exceptional!', NOW() - INTERVAL '3 days'),
  ('22222222-2222-2222-2222-222222222222', '10000000-0000-0000-0000-000000000002', 3, 'TERRIBLE PLACE for terrible people.', NOW() - INTERVAL '1 day'),
  ('22222222-2222-2222-2222-222222222222', '10000000-0000-0000-0000-000000000006', 5, 'Perfect beachfront dining. Fresh seafood and stunning sunset views.', NOW() - INTERVAL '7 days')
ON CONFLICT (user_id, restaurant_id) DO NOTHING;

-- Nir's reviews
INSERT INTO reviews (user_id, restaurant_id, rating, content, created_at) VALUES
  ('33333333-3333-3333-3333-333333333333', '10000000-0000-0000-0000-000000000001', 5, 'One of my favorite spots in Tel Aviv. Never disappoints!', NOW() - INTERVAL '4 days'),
  ('33333333-3333-3333-3333-333333333333', '10000000-0000-0000-0000-000000000005', 4, 'Authentic Greek cuisine. The mezze platter is a must-try.', NOW() - INTERVAL '6 days')
ON CONFLICT (user_id, restaurant_id) DO NOTHING;

-- Amit's reviews
INSERT INTO reviews (user_id, restaurant_id, rating, content, created_at) VALUES
  ('44444444-4444-4444-4444-444444444444', '10000000-0000-0000-0000-000000000002', 2, 'Didn''t like the service. Unpleasant waitresses.', NOW() - INTERVAL '2 days'),
  ('44444444-4444-4444-4444-444444444444', '10000000-0000-0000-0000-000000000004', 5, 'Incredible flavors! The chef really knows Asian cuisine.', NOW() - INTERVAL '8 days'),
  ('44444444-4444-4444-4444-444444444444', '10000000-0000-0000-0000-000000000003', 4, 'Love the vibe here. Great for weekend brunch.', NOW() - INTERVAL '12 days')
ON CONFLICT (user_id, restaurant_id) DO NOTHING;

-- Aviv's reviews
INSERT INTO reviews (user_id, restaurant_id, rating, content, created_at) VALUES
  ('55555555-5555-5555-5555-555555555555', '10000000-0000-0000-0000-000000000002', 4, 'Nice place and good cocktails! Has a lively atmosphere.', NOW() - INTERVAL '1 day'),
  ('55555555-5555-5555-5555-555555555555', '10000000-0000-0000-0000-000000000006', 4, 'Beautiful location and good food. Service could be faster.', NOW() - INTERVAL '9 days'),
  ('55555555-5555-5555-5555-555555555555', '10000000-0000-0000-0000-000000000005', 5, 'Best Greek restaurant in Tel Aviv! The moussaka is divine.', NOW() - INTERVAL '15 days')
ON CONFLICT (user_id, restaurant_id) DO NOTHING;

-- More reviews to add variety
INSERT INTO reviews (user_id, restaurant_id, rating, content, created_at) VALUES
  ('11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000005', 3, 'Good but not great. Expected more based on reviews.', NOW() - INTERVAL '20 days'),
  ('22222222-2222-2222-2222-222222222222', '10000000-0000-0000-0000-000000000004', 5, 'Best meal I had this year! Every dish was perfect.', NOW() - INTERVAL '14 days'),
  ('33333333-3333-3333-3333-333333333333', '10000000-0000-0000-0000-000000000006', 4, 'Great for a romantic dinner. Book ahead!', NOW() - INTERVAL '18 days'),
  ('44444444-4444-4444-4444-444444444444', '10000000-0000-0000-0000-000000000001', 5, 'Amazing food and lovely staff. Highly recommend!', NOW() - INTERVAL '25 days'),
  ('55555555-5555-5555-5555-555555555555', '10000000-0000-0000-0000-000000000003', 5, 'Perfect brunch spot. The coffee is also excellent.', NOW() - INTERVAL '11 days')
ON CONFLICT (user_id, restaurant_id) DO NOTHING;

-- ============================================
-- DONE! 🎉
-- ============================================
-- Your Following feed should now show these restaurants
-- with reviews from your friends.
--
-- REMEMBER: Replace 'YOUR_USER_ID' with your actual user ID!
-- You can find it by running: SELECT id FROM auth.users WHERE email = 'your@email.com';
-- ============================================

