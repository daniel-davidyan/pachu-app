-- Migration: Create review-videos storage bucket
-- This bucket was missing, causing video uploads to fail with "Failed to upload video"

-- Create the review-videos storage bucket
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

-- Storage policies for review-videos bucket

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
