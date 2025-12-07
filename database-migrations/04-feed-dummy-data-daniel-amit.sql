-- ============================================
-- READY TO PASTE - Feed Dummy Data
-- For: Daniel & Amit
-- ============================================
-- This creates dummy friends, restaurants, and reviews
-- for Daniel and Amit's accounts
-- ============================================

-- Daniel's ID: baaa812c-66f9-41de-8387-efb7535d7757
-- Amit's ID: a541c92e-1cd4-4dfa-a5cc-040840377ea7

-- ============================================
-- 1. CREATE DUMMY FRIEND USERS
-- ============================================

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

-- Yair Avraham
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
  '66666666-6666-6666-6666-666666666666',
  'yair@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  '{"username": "yairavraham", "full_name": "Yair Avraham", "avatar_url": "https://i.pravatar.cc/150?img=15"}',
  NOW(),
  NOW(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Create profiles for dummy users
INSERT INTO profiles (id, username, full_name, avatar_url) VALUES
  ('22222222-2222-2222-2222-222222222222', 'rotemcohen', 'Rotem Cohen', 'https://i.pravatar.cc/150?img=47'),
  ('33333333-3333-3333-3333-333333333333', 'nirshvili', 'Nir Shvili', 'https://i.pravatar.cc/150?img=33'),
  ('55555555-5555-5555-5555-555555555555', 'avivsamir', 'Aviv Samir', 'https://i.pravatar.cc/150?img=56'),
  ('66666666-6666-6666-6666-666666666666', 'yairavraham', 'Yair Avraham', 'https://i.pravatar.cc/150?img=15')
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  avatar_url = EXCLUDED.avatar_url;

-- ============================================
-- 2. CREATE FOLLOW RELATIONSHIPS
-- ============================================

-- Daniel follows these friends
INSERT INTO follows (follower_id, following_id) VALUES
  ('baaa812c-66f9-41de-8387-efb7535d7757', '22222222-2222-2222-2222-222222222222'), -- Rotem
  ('baaa812c-66f9-41de-8387-efb7535d7757', '33333333-3333-3333-3333-333333333333'), -- Nir
  ('baaa812c-66f9-41de-8387-efb7535d7757', '55555555-5555-5555-5555-555555555555'), -- Aviv
  ('baaa812c-66f9-41de-8387-efb7535d7757', '66666666-6666-6666-6666-666666666666'), -- Yair
  ('baaa812c-66f9-41de-8387-efb7535d7757', 'a541c92e-1cd4-4dfa-a5cc-040840377ea7')  -- Amit
ON CONFLICT DO NOTHING;

-- Amit follows these friends
INSERT INTO follows (follower_id, following_id) VALUES
  ('a541c92e-1cd4-4dfa-a5cc-040840377ea7', '22222222-2222-2222-2222-222222222222'), -- Rotem
  ('a541c92e-1cd4-4dfa-a5cc-040840377ea7', '33333333-3333-3333-3333-333333333333'), -- Nir
  ('a541c92e-1cd4-4dfa-a5cc-040840377ea7', '55555555-5555-5555-5555-555555555555'), -- Aviv
  ('a541c92e-1cd4-4dfa-a5cc-040840377ea7', '66666666-6666-6666-6666-666666666666'), -- Yair
  ('a541c92e-1cd4-4dfa-a5cc-040840377ea7', 'baaa812c-66f9-41de-8387-efb7535d7757')  -- Daniel
ON CONFLICT DO NOTHING;

-- They follow each other
INSERT INTO follows (follower_id, following_id) VALUES
  ('baaa812c-66f9-41de-8387-efb7535d7757', 'a541c92e-1cd4-4dfa-a5cc-040840377ea7'),
  ('a541c92e-1cd4-4dfa-a5cc-040840377ea7', 'baaa812c-66f9-41de-8387-efb7535d7757')
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. CREATE RESTAURANTS IN TEL AVIV
-- ============================================

-- Mela
INSERT INTO restaurants (
  id,
  name,
  address,
  city,
  country,
  location,
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
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
  ARRAY['Mediterranean', 'Israeli', 'Middle Eastern'],
  2,
  4.6,
  0
) ON CONFLICT (id) DO NOTHING;

-- Shiner
INSERT INTO restaurants (
  id,
  name,
  address,
  city,
  country,
  location,
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
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
  ARRAY['Bar', 'Pub', 'International'],
  2,
  4.4,
  0
) ON CONFLICT (id) DO NOTHING;

-- Port Said
INSERT INTO restaurants (
  id,
  name,
  address,
  city,
  country,
  location,
  image_url,
  cuisine_types,
  price_level,
  average_rating,
  total_reviews
) VALUES (
  '10000000-0000-0000-0000-000000000003',
  'Port Said',
  'Har Sinai St 5, Tel Aviv',
  'Tel Aviv',
  'Israel',
  ST_SetSRID(ST_MakePoint(34.7599, 32.0668), 4326),
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
  ARRAY['Mediterranean', 'Breakfast', 'Brunch'],
  2,
  4.7,
  0
) ON CONFLICT (id) DO NOTHING;

-- Taizu
INSERT INTO restaurants (
  id,
  name,
  address,
  city,
  country,
  location,
  image_url,
  cuisine_types,
  price_level,
  average_rating,
  total_reviews
) VALUES (
  '10000000-0000-0000-0000-000000000004',
  'Taizu',
  'Menachem Begin Rd 23, Tel Aviv',
  'Tel Aviv',
  'Israel',
  ST_SetSRID(ST_MakePoint(34.7870, 32.0700), 4326),
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800',
  ARRAY['Asian', 'Fusion', 'Fine Dining'],
  3,
  4.8,
  0
) ON CONFLICT (id) DO NOTHING;

-- Ouzeria
INSERT INTO restaurants (
  id,
  name,
  address,
  city,
  country,
  location,
  image_url,
  cuisine_types,
  price_level,
  average_rating,
  total_reviews
) VALUES (
  '10000000-0000-0000-0000-000000000005',
  'Ouzeria',
  'Yirmiyahu St 44, Tel Aviv',
  'Tel Aviv',
  'Israel',
  ST_SetSRID(ST_MakePoint(34.7820, 32.0930), 4326),
  'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
  ARRAY['Greek', 'Mediterranean', 'Seafood'],
  2,
  4.5,
  0
) ON CONFLICT (id) DO NOTHING;

-- Manta Ray
INSERT INTO restaurants (
  id,
  name,
  address,
  city,
  country,
  location,
  image_url,
  cuisine_types,
  price_level,
  average_rating,
  total_reviews
) VALUES (
  '10000000-0000-0000-0000-000000000006',
  'Manta Ray',
  'Alma Beach, Tel Aviv',
  'Tel Aviv',
  'Israel',
  ST_SetSRID(ST_MakePoint(34.7548, 32.0709), 4326),
  'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800',
  ARRAY['Seafood', 'Mediterranean', 'Beach'],
  3,
  4.6,
  0
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. CREATE REVIEWS FROM FRIENDS
-- ============================================

-- Daniel's reviews
INSERT INTO reviews (user_id, restaurant_id, rating, content, created_at) VALUES
  ('baaa812c-66f9-41de-8387-efb7535d7757', '10000000-0000-0000-0000-000000000001', 5, 'Best place I have ever been to. Friendly staff, very nice location. Food was amazing.', NOW() - INTERVAL '2 days'),
  ('baaa812c-66f9-41de-8387-efb7535d7757', '10000000-0000-0000-0000-000000000003', 5, 'Amazing breakfast spot! The shakshuka is incredible.', NOW() - INTERVAL '5 days'),
  ('baaa812c-66f9-41de-8387-efb7535d7757', '10000000-0000-0000-0000-000000000004', 4, 'Innovative Asian fusion. A bit pricey but worth it for special occasions.', NOW() - INTERVAL '10 days')
ON CONFLICT (user_id, restaurant_id) DO NOTHING;

-- Amit's reviews  
INSERT INTO reviews (user_id, restaurant_id, rating, content, created_at) VALUES
  ('a541c92e-1cd4-4dfa-a5cc-040840377ea7', '10000000-0000-0000-0000-000000000002', 2, 'Didn''t like the service. Unpleasant waitresses.', NOW() - INTERVAL '2 days'),
  ('a541c92e-1cd4-4dfa-a5cc-040840377ea7', '10000000-0000-0000-0000-000000000004', 5, 'Incredible flavors! The chef really knows Asian cuisine.', NOW() - INTERVAL '8 days'),
  ('a541c92e-1cd4-4dfa-a5cc-040840377ea7', '10000000-0000-0000-0000-000000000003', 4, 'Love the vibe here. Great for weekend brunch.', NOW() - INTERVAL '12 days')
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
  ('33333333-3333-3333-3333-333333333333', '10000000-0000-0000-0000-000000000005', 4, 'Authentic Greek cuisine. The mezze platter is a must-try.', NOW() - INTERVAL '6 days'),
  ('33333333-3333-3333-3333-333333333333', '10000000-0000-0000-0000-000000000006', 4, 'Great for a romantic dinner. Book ahead!', NOW() - INTERVAL '18 days')
ON CONFLICT (user_id, restaurant_id) DO NOTHING;

-- Aviv's reviews
INSERT INTO reviews (user_id, restaurant_id, rating, content, created_at) VALUES
  ('55555555-5555-5555-5555-555555555555', '10000000-0000-0000-0000-000000000002', 4, 'Nice place and good cocktails! Has a lively atmosphere.', NOW() - INTERVAL '1 day'),
  ('55555555-5555-5555-5555-555555555555', '10000000-0000-0000-0000-000000000006', 4, 'Beautiful location and good food. Service could be faster.', NOW() - INTERVAL '9 days'),
  ('55555555-5555-5555-5555-555555555555', '10000000-0000-0000-0000-000000000005', 5, 'Best Greek restaurant in Tel Aviv! The moussaka is divine.', NOW() - INTERVAL '15 days'),
  ('55555555-5555-5555-5555-555555555555', '10000000-0000-0000-0000-000000000003', 5, 'Perfect brunch spot. The coffee is also excellent.', NOW() - INTERVAL '11 days')
ON CONFLICT (user_id, restaurant_id) DO NOTHING;

-- Yair's reviews
INSERT INTO reviews (user_id, restaurant_id, rating, content, created_at) VALUES
  ('66666666-6666-6666-6666-666666666666', '10000000-0000-0000-0000-000000000001', 5, 'Amazing food and lovely staff. Highly recommend!', NOW() - INTERVAL '25 days'),
  ('66666666-6666-6666-6666-666666666666', '10000000-0000-0000-0000-000000000003', 4, 'Good breakfast options. Can get crowded on weekends.', NOW() - INTERVAL '13 days'),
  ('66666666-6666-6666-6666-666666666666', '10000000-0000-0000-0000-000000000004', 5, 'Exceptional dining experience. Worth every shekel!', NOW() - INTERVAL '20 days'),
  ('66666666-6666-6666-6666-666666666666', '10000000-0000-0000-0000-000000000005', 3, 'Good but not great. Expected more based on reviews.', NOW() - INTERVAL '16 days')
ON CONFLICT (user_id, restaurant_id) DO NOTHING;

-- More variety reviews
INSERT INTO reviews (user_id, restaurant_id, rating, content, created_at) VALUES
  ('22222222-2222-2222-2222-222222222222', '10000000-0000-0000-0000-000000000004', 5, 'Best meal I had this year! Every dish was perfect.', NOW() - INTERVAL '14 days'),
  ('a541c92e-1cd4-4dfa-a5cc-040840377ea7', '10000000-0000-0000-0000-000000000001', 5, 'Absolutely love this place! The atmosphere is fantastic.', NOW() - INTERVAL '17 days'),
  ('baaa812c-66f9-41de-8387-efb7535d7757', '10000000-0000-0000-0000-000000000005', 4, 'Solid Greek food. The grilled octopus is a highlight.', NOW() - INTERVAL '21 days')
ON CONFLICT (user_id, restaurant_id) DO NOTHING;

-- ============================================
-- VERIFICATION QUERIES (Optional - Comment out if not needed)
-- ============================================

-- Check Daniel's follows
SELECT 'Daniel follows' AS check_type, COUNT(*) AS count 
FROM follows WHERE follower_id = 'baaa812c-66f9-41de-8387-efb7535d7757';

-- Check Amit's follows
SELECT 'Amit follows' AS check_type, COUNT(*) AS count 
FROM follows WHERE follower_id = 'a541c92e-1cd4-4dfa-a5cc-040840377ea7';

-- Check restaurants created
SELECT 'Restaurants' AS check_type, COUNT(*) AS count 
FROM restaurants WHERE id::text LIKE '10000000%';

-- Check Daniel's reviews
SELECT 'Daniel reviews' AS check_type, COUNT(*) AS count 
FROM reviews WHERE user_id = 'baaa812c-66f9-41de-8387-efb7535d7757';

-- Check Amit's reviews
SELECT 'Amit reviews' AS check_type, COUNT(*) AS count 
FROM reviews WHERE user_id = 'a541c92e-1cd4-4dfa-a5cc-040840377ea7';

-- Check total reviews
SELECT 'Total reviews' AS check_type, COUNT(*) AS count FROM reviews;

-- ============================================
-- ✅ DONE! 
-- ============================================
-- Daniel and Amit now have:
-- - 4 mutual friends (Rotem, Nir, Aviv, Yair)
-- - 6 restaurants in Tel Aviv
-- - Multiple reviews from friends
-- - Follow relationships set up
--
-- Go to: http://localhost:3000/feed
-- Click "Following" tab to see the magic! 🎉
-- ============================================

