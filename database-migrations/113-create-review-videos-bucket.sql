-- Migration: Create review-videos storage bucket AND review_videos table
-- This fixes video upload failures

-- ============================================
-- STEP 1: Create the review_videos table
-- ============================================
CREATE TABLE IF NOT EXISTS review_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_review_videos_review_id ON review_videos(review_id);
CREATE INDEX IF NOT EXISTS idx_review_videos_sort_order ON review_videos(review_id, sort_order);

-- Enable RLS
ALTER TABLE review_videos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Review videos are viewable by everyone" ON review_videos;
DROP POLICY IF EXISTS "Users can add videos to their own reviews" ON review_videos;
DROP POLICY IF EXISTS "Users can update their own review videos" ON review_videos;
DROP POLICY IF EXISTS "Users can delete their own review videos" ON review_videos;

-- RLS Policies for review_videos table
CREATE POLICY "Review videos are viewable by everyone" 
  ON review_videos FOR SELECT 
  USING (true);

CREATE POLICY "Users can add videos to their own reviews" 
  ON review_videos FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reviews 
      WHERE reviews.id = review_videos.review_id 
      AND reviews.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own review videos" 
  ON review_videos FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM reviews 
      WHERE reviews.id = review_videos.review_id 
      AND reviews.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own review videos" 
  ON review_videos FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM reviews 
      WHERE reviews.id = review_videos.review_id 
      AND reviews.user_id = auth.uid()
    )
  );

-- ============================================
-- STEP 2: Create the storage bucket
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-videos', 
  'review-videos', 
  true,
  52428800, -- 50MB limit
  ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/mov', 'video/x-m4v']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/mov', 'video/x-m4v'];

-- ============================================
-- STEP 3: Storage policies for review-videos bucket
-- ============================================
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Review videos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload review videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own videos in review-videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own videos in review-videos" ON storage.objects;

-- Policy: Review videos are publicly accessible
CREATE POLICY "Review videos are publicly accessible" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'review-videos');

-- Policy: Authenticated users can upload review videos
CREATE POLICY "Authenticated users can upload review videos" 
  ON storage.objects FOR INSERT 
  WITH CHECK (
    bucket_id = 'review-videos' 
    AND auth.role() = 'authenticated'
  );

-- Policy: Users can update their own videos
CREATE POLICY "Users can update their own videos in review-videos" 
  ON storage.objects FOR UPDATE 
  USING (
    bucket_id = 'review-videos' 
    AND auth.role() = 'authenticated'
  );

-- Policy: Users can delete their own videos
CREATE POLICY "Users can delete their own videos in review-videos" 
  ON storage.objects FOR DELETE 
  USING (
    bucket_id = 'review-videos' 
    AND auth.role() = 'authenticated'
  );
