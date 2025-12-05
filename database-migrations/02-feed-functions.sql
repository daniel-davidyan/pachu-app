-- SQL Functions for Feed Feature
-- Run this in your Supabase SQL Editor

-- Function to get nearby restaurants
CREATE OR REPLACE FUNCTION restaurants_nearby(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 10000
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  address TEXT,
  distance_meters DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.address,
    ST_Distance(
      r.location::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) AS distance_meters
  FROM restaurants r
  WHERE r.location IS NOT NULL
    AND ST_DWithin(
      r.location::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_meters
    )
  ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to update restaurant location (helper function)
CREATE OR REPLACE FUNCTION update_restaurant_location(
  p_restaurant_id UUID,
  p_longitude DOUBLE PRECISION,
  p_latitude DOUBLE PRECISION
)
RETURNS VOID AS $$
BEGIN
  UPDATE restaurants
  SET location = ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)
  WHERE id = p_restaurant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION restaurants_nearby TO authenticated;
GRANT EXECUTE ON FUNCTION restaurants_nearby TO anon;
GRANT EXECUTE ON FUNCTION update_restaurant_location TO authenticated;

