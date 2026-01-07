-- Migration: Add review_videos table for TikTok-style feed
-- This enables users to upload videos alongside photos in their reviews

-- Create review_videos table
CREATE TABLE IF NOT EXISTS review_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_review_videos_review_id ON review_videos(review_id);
CREATE INDEX IF NOT EXISTS idx_review_videos_sort_order ON review_videos(review_id, sort_order);

-- Enable Row Level Security
ALTER TABLE review_videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can view review videos
CREATE POLICY "Review videos are viewable by everyone" 
  ON review_videos FOR SELECT 
  USING (true);

-- Users can add videos to their own reviews
CREATE POLICY "Users can add videos to their own reviews" 
  ON review_videos FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reviews 
      WHERE reviews.id = review_videos.review_id 
      AND reviews.user_id = auth.uid()
    )
  );

-- Users can update their own review videos
CREATE POLICY "Users can update their own review videos" 
  ON review_videos FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM reviews 
      WHERE reviews.id = review_videos.review_id 
      AND reviews.user_id = auth.uid()
    )
  );

-- Users can delete their own review videos
CREATE POLICY "Users can delete their own review videos" 
  ON review_videos FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM reviews 
      WHERE reviews.id = review_videos.review_id 
      AND reviews.user_id = auth.uid()
    )
  );

-- Create storage bucket for review videos (run in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'review-videos', 
--   'review-videos', 
--   true,
--   52428800, -- 50MB limit
--   ARRAY['video/mp4', 'video/quicktime', 'video/webm']
-- );

-- Storage policies for review-videos bucket
-- These need to be run in Supabase dashboard under Storage > Policies

-- Policy: Review videos are publicly accessible
-- CREATE POLICY "Review videos are publicly accessible" 
--   ON storage.objects FOR SELECT 
--   USING (bucket_id = 'review-videos');

-- Policy: Authenticated users can upload review videos
-- CREATE POLICY "Authenticated users can upload review videos" 
--   ON storage.objects FOR INSERT 
--   WITH CHECK (
--     bucket_id = 'review-videos' 
--     AND auth.role() = 'authenticated'
--   );

-- Policy: Users can update their own videos
-- CREATE POLICY "Users can update their own videos" 
--   ON storage.objects FOR UPDATE 
--   USING (
--     bucket_id = 'review-videos' 
--     AND auth.uid()::text = (storage.foldername(name))[1]
--   );

-- Policy: Users can delete their own videos
-- CREATE POLICY "Users can delete their own videos" 
--   ON storage.objects FOR DELETE 
--   USING (
--     bucket_id = 'review-videos' 
--     AND auth.uid()::text = (storage.foldername(name))[1]
--   );
