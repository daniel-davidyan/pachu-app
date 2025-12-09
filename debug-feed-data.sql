-- Debug Script: Check Your Database Data
-- Copy and paste this in Supabase SQL Editor to see what data you have

-- 1. Check if you have any restaurants
SELECT 'Total Restaurants' as check_type, COUNT(*) as count FROM restaurants;

-- 2. Check if restaurants have locations
SELECT 'Restaurants WITH location' as check_type, COUNT(*) as count 
FROM restaurants WHERE location IS NOT NULL;

-- 3. Check if you have any reviews
SELECT 'Total Reviews' as check_type, COUNT(*) as count FROM reviews;

-- 4. Check if you have reviews for restaurants with locations
SELECT 'Reviews for restaurants WITH location' as check_type, COUNT(*) as count 
FROM reviews r
JOIN restaurants rest ON r.restaurant_id = rest.id
WHERE rest.location IS NOT NULL;

-- 5. Show sample restaurants (first 5)
SELECT 
  id,
  name,
  address,
  CASE 
    WHEN location IS NULL THEN 'NO LOCATION ❌'
    ELSE 'Has location ✅'
  END as location_status
FROM restaurants 
LIMIT 5;

-- 6. Show sample reviews (first 5)
SELECT 
  r.id,
  r.rating,
  r.content,
  rest.name as restaurant_name,
  CASE 
    WHEN rest.location IS NULL THEN 'Restaurant has NO LOCATION ❌'
    ELSE 'Restaurant has location ✅'
  END as location_status
FROM reviews r
JOIN restaurants rest ON r.restaurant_id = rest.id
LIMIT 5;

-- 7. Test the restaurants_nearby function (Tel Aviv location)
SELECT * FROM restaurants_nearby(32.0853, 34.7818, 50000) -- 50km radius
LIMIT 5;


