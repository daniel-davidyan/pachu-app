-- ============================================
-- Add Review Photos to Existing Reviews
-- ============================================
-- This adds sample photos to existing reviews
-- ============================================

-- Get review IDs for Mela restaurant from friends
-- (Replace with actual review IDs from your database or use the INSERT...RETURNING pattern)

-- Add photos to Daniel's review of Mela
INSERT INTO review_photos (review_id, photo_url, sort_order)
SELECT 
  r.id,
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
  0
FROM reviews r
WHERE r.user_id = 'baaa812c-66f9-41de-8387-efb7535d7757' 
  AND r.restaurant_id = '10000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

INSERT INTO review_photos (review_id, photo_url, sort_order)
SELECT 
  r.id,
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
  1
FROM reviews r
WHERE r.user_id = 'baaa812c-66f9-41de-8387-efb7535d7757' 
  AND r.restaurant_id = '10000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- Add photos to Rotem's review of Mela
INSERT INTO review_photos (review_id, photo_url, sort_order)
SELECT 
  r.id,
  'https://images.unsplash.com/photo-1567337710282-00832b415979?w=800',
  0
FROM reviews r
WHERE r.user_id = '22222222-2222-2222-2222-222222222222' 
  AND r.restaurant_id = '10000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- Add photos to Nir's review of Mela
INSERT INTO review_photos (review_id, photo_url, sort_order)
SELECT 
  r.id,
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800',
  0
FROM reviews r
WHERE r.user_id = '33333333-3333-3333-3333-333333333333' 
  AND r.restaurant_id = '10000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- Add photos to Aviv's review of Shiner
INSERT INTO review_photos (review_id, photo_url, sort_order)
SELECT 
  r.id,
  'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800',
  0
FROM reviews r
WHERE r.user_id = '55555555-5555-5555-5555-555555555555' 
  AND r.restaurant_id = '10000000-0000-0000-0000-000000000002'
ON CONFLICT DO NOTHING;

-- Add photos to Rotem's review of Shiner
INSERT INTO review_photos (review_id, photo_url, sort_order)
SELECT 
  r.id,
  'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800',
  0
FROM reviews r
WHERE r.user_id = '22222222-2222-2222-2222-222222222222' 
  AND r.restaurant_id = '10000000-0000-0000-0000-000000000002'
ON CONFLICT DO NOTHING;

-- Add photos to Daniel's review of Port Said
INSERT INTO review_photos (review_id, photo_url, sort_order)
SELECT 
  r.id,
  'https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?w=800',
  0
FROM reviews r
WHERE r.user_id = 'baaa812c-66f9-41de-8387-efb7535d7757' 
  AND r.restaurant_id = '10000000-0000-0000-0000-000000000003'
ON CONFLICT DO NOTHING;

-- Add photos to Aviv's review of Port Said
INSERT INTO review_photos (review_id, photo_url, sort_order)
SELECT 
  r.id,
  'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=800',
  0
FROM reviews r
WHERE r.user_id = '55555555-5555-5555-5555-555555555555' 
  AND r.restaurant_id = '10000000-0000-0000-0000-000000000003'
ON CONFLICT DO NOTHING;

-- Add photos to Amit's review of Taizu
INSERT INTO review_photos (review_id, photo_url, sort_order)
SELECT 
  r.id,
  'https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=800',
  0
FROM reviews r
WHERE r.user_id = 'a541c92e-1cd4-4dfa-a5cc-040840377ea7' 
  AND r.restaurant_id = '10000000-0000-0000-0000-000000000004'
ON CONFLICT DO NOTHING;

-- Add photos to Rotem's review of Taizu
INSERT INTO review_photos (review_id, photo_url, sort_order)
SELECT 
  r.id,
  'https://images.unsplash.com/photo-1512003867696-6d5ce6835040?w=800',
  0
FROM reviews r
WHERE r.user_id = '22222222-2222-2222-2222-222222222222' 
  AND r.restaurant_id = '10000000-0000-0000-0000-000000000004'
ON CONFLICT DO NOTHING;

-- Add photos to Nir's review of Ouzeria
INSERT INTO review_photos (review_id, photo_url, sort_order)
SELECT 
  r.id,
  'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
  0
FROM reviews r
WHERE r.user_id = '33333333-3333-3333-3333-333333333333' 
  AND r.restaurant_id = '10000000-0000-0000-0000-000000000005'
ON CONFLICT DO NOTHING;

-- Add photos to Aviv's review of Ouzeria
INSERT INTO review_photos (review_id, photo_url, sort_order)
SELECT 
  r.id,
  'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
  0
FROM reviews r
WHERE r.user_id = '55555555-5555-5555-5555-555555555555' 
  AND r.restaurant_id = '10000000-0000-0000-0000-000000000005'
ON CONFLICT DO NOTHING;

-- Add photos to Rotem's review of Manta Ray
INSERT INTO review_photos (review_id, photo_url, sort_order)
SELECT 
  r.id,
  'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800',
  0
FROM reviews r
WHERE r.user_id = '22222222-2222-2222-2222-222222222222' 
  AND r.restaurant_id = '10000000-0000-0000-0000-000000000006'
ON CONFLICT DO NOTHING;

-- Add photos to Nir's review of Manta Ray
INSERT INTO review_photos (review_id, photo_url, sort_order)
SELECT 
  r.id,
  'https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=800',
  0
FROM reviews r
WHERE r.user_id = '33333333-3333-3333-3333-333333333333' 
  AND r.restaurant_id = '10000000-0000-0000-0000-000000000006'
ON CONFLICT DO NOTHING;

-- Add photos to Aviv's review of Manta Ray
INSERT INTO review_photos (review_id, photo_url, sort_order)
SELECT 
  r.id,
  'https://images.unsplash.com/photo-1580959375944-c93ca97a884b?w=800',
  0
FROM reviews r
WHERE r.user_id = '55555555-5555-5555-5555-555555555555' 
  AND r.restaurant_id = '10000000-0000-0000-0000-000000000006'
ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICATION
-- ============================================

-- Check how many review photos were added
SELECT 'Total review photos' AS check_type, COUNT(*) AS count FROM review_photos;

-- Check which reviews have photos
SELECT 
  r.id,
  p.full_name AS reviewer,
  rest.name AS restaurant,
  COUNT(rp.id) AS photo_count
FROM reviews r
JOIN profiles p ON r.user_id = p.id
JOIN restaurants rest ON r.restaurant_id = rest.id
LEFT JOIN review_photos rp ON rp.review_id = r.id
GROUP BY r.id, p.full_name, rest.name
HAVING COUNT(rp.id) > 0
ORDER BY rest.name, p.full_name;

-- ============================================
-- ✅ DONE!
-- ============================================
-- Review photos have been added!
-- Now when you view the Following feed, 
-- you should see photos in your friends' reviews.
-- ============================================

