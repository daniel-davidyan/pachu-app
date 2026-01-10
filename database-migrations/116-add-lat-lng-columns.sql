-- Migration 116: Add latitude and longitude columns to restaurants table
-- This provides easier access to coordinates without needing PostGIS functions

-- Add latitude column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'restaurants' AND column_name = 'latitude') THEN
    ALTER TABLE restaurants ADD COLUMN latitude DOUBLE PRECISION;
  END IF;
END $$;

-- Add longitude column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'restaurants' AND column_name = 'longitude') THEN
    ALTER TABLE restaurants ADD COLUMN longitude DOUBLE PRECISION;
  END IF;
END $$;

-- Populate latitude/longitude from existing PostGIS location data
UPDATE restaurants
SET 
  latitude = ST_Y(location::geometry),
  longitude = ST_X(location::geometry)
WHERE location IS NOT NULL
  AND (latitude IS NULL OR longitude IS NULL);

-- Create trigger to keep latitude/longitude in sync when location changes
CREATE OR REPLACE FUNCTION sync_restaurant_coordinates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.location IS NOT NULL THEN
    NEW.latitude := ST_Y(NEW.location::geometry);
    NEW.longitude := ST_X(NEW.location::geometry);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_restaurant_coordinates ON restaurants;
CREATE TRIGGER trigger_sync_restaurant_coordinates
  BEFORE INSERT OR UPDATE OF location ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION sync_restaurant_coordinates();

-- Also update the update_restaurant_location function to set lat/lng columns
CREATE OR REPLACE FUNCTION update_restaurant_location(
  p_restaurant_id UUID,
  p_longitude DOUBLE PRECISION,
  p_latitude DOUBLE PRECISION
)
RETURNS VOID AS $$
BEGIN
  UPDATE restaurants
  SET 
    location = ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326),
    latitude = p_latitude,
    longitude = p_longitude
  WHERE id = p_restaurant_id;
END;
$$ LANGUAGE plpgsql;

-- Create index on latitude/longitude for faster queries
CREATE INDEX IF NOT EXISTS idx_restaurants_lat_lng ON restaurants(latitude, longitude);
