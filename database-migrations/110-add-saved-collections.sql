-- Migration: Add saved_collections table for organizing wishlist items
-- This enables users to organize saved restaurants into named collections (like Instagram)

-- Create saved_collections table
CREATE TABLE IF NOT EXISTS saved_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure unique collection names per user
  UNIQUE(user_id, name)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_saved_collections_user_id ON saved_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_collections_created_at ON saved_collections(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE saved_collections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for saved_collections

-- Users can view their own collections
CREATE POLICY "Users can view their own collections" 
  ON saved_collections FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can create their own collections
CREATE POLICY "Users can create their own collections" 
  ON saved_collections FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own collections
CREATE POLICY "Users can update their own collections" 
  ON saved_collections FOR UPDATE 
  USING (auth.uid() = user_id);

-- Users can delete their own collections
CREATE POLICY "Users can delete their own collections" 
  ON saved_collections FOR DELETE 
  USING (auth.uid() = user_id);

-- Add collection_id column to wishlist table
-- When a collection is deleted, items move to "All Saved" (collection_id = NULL)
ALTER TABLE wishlist 
ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES saved_collections(id) ON DELETE SET NULL;

-- Create index for filtering wishlist by collection
CREATE INDEX IF NOT EXISTS idx_wishlist_collection_id ON wishlist(collection_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_user_collection ON wishlist(user_id, collection_id);

-- Function to update collection's updated_at timestamp when items are added/removed
CREATE OR REPLACE FUNCTION update_collection_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.collection_id IS NOT NULL THEN
      UPDATE saved_collections
      SET updated_at = NOW()
      WHERE id = NEW.collection_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.collection_id IS NOT NULL THEN
      UPDATE saved_collections
      SET updated_at = NOW()
      WHERE id = OLD.collection_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update collection timestamp when wishlist items change
DROP TRIGGER IF EXISTS trigger_update_collection_timestamp ON wishlist;
CREATE TRIGGER trigger_update_collection_timestamp
AFTER INSERT OR UPDATE OR DELETE ON wishlist
FOR EACH ROW EXECUTE FUNCTION update_collection_timestamp();

-- Function to get collection with item count
CREATE OR REPLACE FUNCTION get_user_collections_with_counts(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  items_count BIGINT,
  preview_images TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.id,
    sc.name,
    sc.cover_image_url,
    sc.created_at,
    sc.updated_at,
    COUNT(w.id)::BIGINT AS items_count,
    ARRAY(
      SELECT r.image_url 
      FROM wishlist w2 
      JOIN restaurants r ON w2.restaurant_id = r.id 
      WHERE w2.collection_id = sc.id 
      AND r.image_url IS NOT NULL
      ORDER BY w2.created_at DESC 
      LIMIT 4
    ) AS preview_images
  FROM saved_collections sc
  LEFT JOIN wishlist w ON sc.id = w.collection_id
  WHERE sc.user_id = p_user_id
  GROUP BY sc.id, sc.name, sc.cover_image_url, sc.created_at, sc.updated_at
  ORDER BY sc.updated_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_collections_with_counts TO authenticated;
