-- ============================================================================
-- PACHU RECOMMENDATION SYSTEM - DATABASE MIGRATION
-- ============================================================================
-- This migration creates the tables and functions needed for the new
-- AI-powered restaurant recommendation system with:
-- - Local restaurant cache with embeddings
-- - User taste profiles
-- - Taste learning signals
-- - Vector search functions
-- ============================================================================

-- Enable pgvector extension (should already be enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- TABLE 1: restaurant_cache - Israel Restaurant Database
-- ============================================================================
-- Stores all restaurants in Israel (~30,000) with embeddings for vector search

CREATE TABLE IF NOT EXISTS restaurant_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  google_place_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  location GEOGRAPHY(POINT, 4326),
  phone TEXT,
  website TEXT,
  google_rating NUMERIC(2,1),
  google_reviews_count INTEGER,
  price_level INTEGER CHECK (price_level BETWEEN 1 AND 4),
  cuisine_types TEXT[],
  is_kosher BOOLEAN DEFAULT FALSE,
  is_vegetarian_friendly BOOLEAN DEFAULT FALSE,
  opening_hours JSONB, -- {"monday": {"open": "09:00", "close": "22:00"}, ...}
  photos JSONB, -- [{"photo_reference": "xxx", "width": 800, "height": 600}]
  google_reviews JSONB, -- 5 most helpful Google reviews
  summary_text TEXT, -- 2-3 sentence summary from LLM (in English)
  embedding VECTOR(1536), -- text-embedding-3-small embedding
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES for restaurant_cache (Optimized for fast queries)
-- ============================================================================

-- Primary indexes
CREATE INDEX IF NOT EXISTS idx_restaurant_cache_location 
  ON restaurant_cache USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_restaurant_cache_google_place_id 
  ON restaurant_cache(google_place_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_cache_city 
  ON restaurant_cache(city);
CREATE INDEX IF NOT EXISTS idx_restaurant_cache_name 
  ON restaurant_cache(name);

-- Array search index
CREATE INDEX IF NOT EXISTS idx_restaurant_cache_cuisine_types 
  ON restaurant_cache USING GIN(cuisine_types);

-- Filtering indexes
CREATE INDEX IF NOT EXISTS idx_restaurant_cache_is_kosher 
  ON restaurant_cache(is_kosher) WHERE is_kosher = true;
CREATE INDEX IF NOT EXISTS idx_restaurant_cache_is_vegetarian 
  ON restaurant_cache(is_vegetarian_friendly) WHERE is_vegetarian_friendly = true;
CREATE INDEX IF NOT EXISTS idx_restaurant_cache_rating 
  ON restaurant_cache(google_rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_restaurant_cache_price_level 
  ON restaurant_cache(price_level);
CREATE INDEX IF NOT EXISTS idx_restaurant_cache_last_updated 
  ON restaurant_cache(last_updated DESC);

-- Composite index for common query pattern (city + rating)
CREATE INDEX IF NOT EXISTS idx_restaurant_cache_city_rating 
  ON restaurant_cache(city, google_rating DESC NULLS LAST);

-- ============================================================================
-- VECTOR INDEX (Run AFTER data is populated!)
-- ============================================================================
-- IVFFlat requires data to build the index properly.
-- After populating at least 1,000 restaurants, run:
--
-- CREATE INDEX idx_restaurant_cache_embedding 
--   ON restaurant_cache USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
--
-- For larger datasets (10,000+), consider:
-- CREATE INDEX idx_restaurant_cache_embedding 
--   ON restaurant_cache USING ivfflat (embedding vector_cosine_ops) WITH (lists = 200);
-- ============================================================================

-- RLS for restaurant_cache
ALTER TABLE restaurant_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant cache is viewable by everyone" 
  ON restaurant_cache FOR SELECT 
  USING (true);

-- Allow authenticated users to insert (for cache population)
CREATE POLICY "Authenticated users can insert into restaurant cache" 
  ON restaurant_cache FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow authenticated users to update (for cache updates)
CREATE POLICY "Authenticated users can update restaurant cache" 
  ON restaurant_cache FOR UPDATE 
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- ============================================================================
-- TABLE 2: user_taste_profiles - User Taste Profile
-- ============================================================================
-- Stores user preferences from onboarding and computed taste embedding

CREATE TABLE IF NOT EXISTS user_taste_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic info
  birth_date DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  phone TEXT,
  
  -- Hard parameters (for SQL filtering)
  is_kosher BOOLEAN DEFAULT FALSE,
  is_vegetarian BOOLEAN DEFAULT FALSE,
  is_vegan BOOLEAN DEFAULT FALSE,
  gluten_free BOOLEAN DEFAULT FALSE,
  
  -- Preferences (dislikes / likes) - stored in English
  dislikes TEXT[], -- ['fish', 'spicy', 'seafood']
  likes TEXT[], -- ['red meat', 'Italian', 'Asian']
  
  -- Free text description (in English)
  free_text TEXT,
  
  -- Restaurants by context (google_place_id + name)
  date_restaurants JSONB DEFAULT '[]'::jsonb, -- [{"google_place_id": "xxx", "name": "Restaurant Name"}]
  friends_restaurants JSONB DEFAULT '[]'::jsonb,
  family_restaurants JSONB DEFAULT '[]'::jsonb,
  solo_restaurants JSONB DEFAULT '[]'::jsonb,
  work_restaurants JSONB DEFAULT '[]'::jsonb,
  disliked_restaurants JSONB DEFAULT '[]'::jsonb,
  
  -- Google favorites import
  google_favorites JSONB DEFAULT '[]'::jsonb,
  
  -- Computed embedding
  taste_text TEXT, -- The text used to generate the embedding (in English)
  taste_embedding VECTOR(1536), -- Computed from all preference data
  
  -- Meta
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_step INTEGER DEFAULT 0, -- Track progress through onboarding
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user_taste_profiles
CREATE INDEX IF NOT EXISTS idx_user_taste_profiles_user_id 
  ON user_taste_profiles(user_id);

-- Note: Vector index will be created after users complete onboarding
-- CREATE INDEX idx_user_taste_profiles_embedding 
--   ON user_taste_profiles USING ivfflat (taste_embedding vector_cosine_ops) WITH (lists = 100);

-- RLS for user_taste_profiles
ALTER TABLE user_taste_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own taste profile" 
  ON user_taste_profiles FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own taste profile" 
  ON user_taste_profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own taste profile" 
  ON user_taste_profiles FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own taste profile" 
  ON user_taste_profiles FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================================================
-- TABLE 3: user_taste_signals - Taste Learning Signals
-- ============================================================================
-- Stores signals from user behavior to learn and refine taste profile

CREATE TABLE IF NOT EXISTS user_taste_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Signal type
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'review',      -- User wrote a review (strongest signal)
    'chat',        -- User expressed preference in chat
    'like',        -- User liked a review
    'comment',     -- User commented on a review
    'wishlist',    -- User added to wishlist
    'click'        -- User clicked on a restaurant
  )),
  
  -- Signal strength (1-5)
  -- review: 5 (strongest - user actually visited)
  -- chat_positive/negative: 4 (user expressed preference)
  -- like: 3 (user liked a review)
  -- comment: 3 (user commented on a review)
  -- wishlist: 2 (user added to wishlist)
  -- click: 1 (user clicked on a restaurant)
  signal_strength INTEGER NOT NULL CHECK (signal_strength BETWEEN 1 AND 5),
  
  -- Positive or negative signal
  is_positive BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Restaurant context (if relevant)
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  google_place_id TEXT,
  restaurant_name TEXT,
  cuisine_types TEXT[],
  
  -- Signal content (for building taste text) - stored in English
  content TEXT, -- "Liked Italian restaurant" / "Doesn't like spicy" / "Looking for date spot"
  
  -- Source reference
  source_id TEXT, -- review_id / conversation_id / like_id etc.
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user_taste_signals
CREATE INDEX IF NOT EXISTS idx_user_taste_signals_user_id 
  ON user_taste_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_taste_signals_type 
  ON user_taste_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_user_taste_signals_created 
  ON user_taste_signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_taste_signals_user_created 
  ON user_taste_signals(user_id, created_at DESC);

-- RLS for user_taste_signals
ALTER TABLE user_taste_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own signals" 
  ON user_taste_signals FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own signals" 
  ON user_taste_signals FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Service role can also insert (for API calls)
CREATE POLICY "Service role can insert signals" 
  ON user_taste_signals FOR INSERT 
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can delete their own signals" 
  ON user_taste_signals FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGER: Auto-update updated_at for user_taste_profiles
-- ============================================================================

CREATE OR REPLACE FUNCTION update_user_taste_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_taste_profiles_updated_at ON user_taste_profiles;
CREATE TRIGGER trigger_update_user_taste_profiles_updated_at
  BEFORE UPDATE ON user_taste_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_taste_profiles_updated_at();

-- ============================================================================
-- TRIGGER: Auto-create taste profile when user signs up
-- ============================================================================

CREATE OR REPLACE FUNCTION create_user_taste_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_taste_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create if trigger doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_taste_profile'
  ) THEN
    CREATE TRIGGER on_auth_user_created_taste_profile
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION create_user_taste_profile();
  END IF;
END $$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON restaurant_cache TO authenticated;
GRANT SELECT ON restaurant_cache TO anon;

GRANT ALL ON user_taste_profiles TO authenticated;
GRANT ALL ON user_taste_signals TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run these queries to verify the tables were created successfully:
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('restaurant_cache', 'user_taste_profiles', 'user_taste_signals');
-- \d restaurant_cache
-- \d user_taste_profiles
-- \d user_taste_signals
