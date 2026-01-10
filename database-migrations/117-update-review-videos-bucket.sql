-- Migration: Update review-videos bucket to accept more video MIME types
-- This fixes video upload failures for various video formats, especially from iOS

-- Update the review-videos bucket to accept more MIME types
UPDATE storage.buckets 
SET 
  allowed_mime_types = ARRAY[
    'video/mp4',
    'video/quicktime',
    'video/webm', 
    'video/x-m4v',
    'video/x-msvideo',
    'video/3gpp',
    'video/x-matroska',
    'video/mpeg',
    'video/ogg',
    'video/mov',
    'application/octet-stream'  -- Fallback for unknown video types
  ],
  file_size_limit = 104857600  -- 100MB limit (increased from 50MB)
WHERE id = 'review-videos';

-- If the bucket doesn't exist, create it
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-videos', 
  'review-videos', 
  true,
  104857600, -- 100MB limit
  ARRAY[
    'video/mp4',
    'video/quicktime',
    'video/webm', 
    'video/x-m4v',
    'video/x-msvideo',
    'video/3gpp',
    'video/x-matroska',
    'video/mpeg',
    'video/ogg',
    'video/mov',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Make sure storage policies exist for the review-videos bucket
-- Drop and recreate policies to ensure they're correct

-- Policy: Review videos are publicly accessible
DO $$
BEGIN
  DROP POLICY IF EXISTS "Review videos are publicly accessible" ON storage.objects;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

CREATE POLICY "Review videos are publicly accessible" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'review-videos');

-- Policy: Authenticated users can upload review videos
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload review videos" ON storage.objects;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

CREATE POLICY "Authenticated users can upload review videos" 
  ON storage.objects FOR INSERT 
  WITH CHECK (
    bucket_id = 'review-videos' 
    AND auth.role() = 'authenticated'
  );

-- Policy: Users can update their own videos
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can update their own videos in review-videos" ON storage.objects;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

CREATE POLICY "Users can update their own videos in review-videos" 
  ON storage.objects FOR UPDATE 
  USING (
    bucket_id = 'review-videos' 
    AND auth.role() = 'authenticated'
  );

-- Policy: Users can delete their own videos
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can delete their own videos in review-videos" ON storage.objects;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

CREATE POLICY "Users can delete their own videos in review-videos" 
  ON storage.objects FOR DELETE 
  USING (
    bucket_id = 'review-videos' 
    AND auth.role() = 'authenticated'
  );

-- Also make sure the review_videos table exists
CREATE TABLE IF NOT EXISTS review_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_review_videos_review_id ON review_videos(review_id);
CREATE INDEX IF NOT EXISTS idx_review_videos_sort_order ON review_videos(review_id, sort_order);

-- Enable RLS if not already enabled
ALTER TABLE review_videos ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for review_videos table if they don't exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Review videos are viewable by everyone" ON review_videos;
  CREATE POLICY "Review videos are viewable by everyone" 
    ON review_videos FOR SELECT 
    USING (true);
EXCEPTION WHEN undefined_object THEN
  CREATE POLICY "Review videos are viewable by everyone" 
    ON review_videos FOR SELECT 
    USING (true);
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can add videos to their own reviews" ON review_videos;
  CREATE POLICY "Users can add videos to their own reviews" 
    ON review_videos FOR INSERT 
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM reviews 
        WHERE reviews.id = review_videos.review_id 
        AND reviews.user_id = auth.uid()
      )
    );
EXCEPTION WHEN undefined_object THEN
  CREATE POLICY "Users can add videos to their own reviews" 
    ON review_videos FOR INSERT 
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM reviews 
        WHERE reviews.id = review_videos.review_id 
        AND reviews.user_id = auth.uid()
      )
    );
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can update their own review videos" ON review_videos;
  CREATE POLICY "Users can update their own review videos" 
    ON review_videos FOR UPDATE 
    USING (
      EXISTS (
        SELECT 1 FROM reviews 
        WHERE reviews.id = review_videos.review_id 
        AND reviews.user_id = auth.uid()
      )
    );
EXCEPTION WHEN undefined_object THEN
  CREATE POLICY "Users can update their own review videos" 
    ON review_videos FOR UPDATE 
    USING (
      EXISTS (
        SELECT 1 FROM reviews 
        WHERE reviews.id = review_videos.review_id 
        AND reviews.user_id = auth.uid()
      )
    );
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can delete their own review videos" ON review_videos;
  CREATE POLICY "Users can delete their own review videos" 
    ON review_videos FOR DELETE 
    USING (
      EXISTS (
        SELECT 1 FROM reviews 
        WHERE reviews.id = review_videos.review_id 
        AND reviews.user_id = auth.uid()
      )
    );
EXCEPTION WHEN undefined_object THEN
  CREATE POLICY "Users can delete their own review videos" 
    ON review_videos FOR DELETE 
    USING (
      EXISTS (
        SELECT 1 FROM reviews 
        WHERE reviews.id = review_videos.review_id 
        AND reviews.user_id = auth.uid()
      )
    );
END $$;
