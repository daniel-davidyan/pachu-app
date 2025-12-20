-- Add comment likes feature
-- Run this in your Supabase SQL Editor

-- 1. Create comment_likes table
CREATE TABLE IF NOT EXISTS comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES review_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- 2. Create index for better performance
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON comment_likes(user_id);

-- 3. Enable Row Level Security
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for comment_likes

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view comment likes" ON comment_likes;
DROP POLICY IF EXISTS "Users can add their own comment likes" ON comment_likes;
DROP POLICY IF EXISTS "Users can delete their own comment likes" ON comment_likes;

-- Everyone can view comment likes
CREATE POLICY "Anyone can view comment likes"
  ON comment_likes FOR SELECT
  USING (true);

-- Authenticated users can add their own comment likes
CREATE POLICY "Users can add their own comment likes"
  ON comment_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comment likes
CREATE POLICY "Users can delete their own comment likes"
  ON comment_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. Function to create notification for comment likes
DROP FUNCTION IF EXISTS notify_comment_like() CASCADE;

CREATE OR REPLACE FUNCTION notify_comment_like()
RETURNS TRIGGER AS $$
DECLARE
  comment_author_id UUID;
  liker_username TEXT;
BEGIN
  -- Get comment author
  SELECT user_id INTO comment_author_id
  FROM review_comments
  WHERE id = NEW.comment_id;

  -- Don't notify if liking own comment
  IF comment_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get liker username
  SELECT username INTO liker_username
  FROM profiles
  WHERE id = NEW.user_id;

  -- Create notification
  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (
    comment_author_id,
    'like',
    'New Like',
    liker_username || ' liked your comment',
    '/review/' || (SELECT review_id FROM review_comments WHERE id = NEW.comment_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid conflicts
DROP TRIGGER IF EXISTS on_comment_like_created ON comment_likes;

CREATE TRIGGER on_comment_like_created
  AFTER INSERT ON comment_likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_comment_like();

