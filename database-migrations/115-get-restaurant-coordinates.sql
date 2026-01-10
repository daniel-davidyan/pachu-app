-- Migration 115: Add function to extract coordinates from PostGIS location field
-- This function is used by the friends-reviews API to get lat/lng from the location geography field

-- Create function to get restaurant coordinates from PostGIS location
CREATE OR REPLACE FUNCTION get_restaurant_coordinates(restaurant_ids UUID[])
RETURNS TABLE (
  id UUID,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    ST_Y(r.location::geometry) as latitude,
    ST_X(r.location::geometry) as longitude
  FROM restaurants r
  WHERE r.id = ANY(restaurant_ids)
    AND r.location IS NOT NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_restaurant_coordinates(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_restaurant_coordinates(UUID[]) TO anon;
