-- Add social features: likes, comments, and mentions to reviews
-- Run this in your Supabase SQL Editor

-- 1. Create review_likes table
CREATE TABLE IF NOT EXISTS review_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

-- 2. Create review_comments table
CREATE TABLE IF NOT EXISTS review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create comment_mentions table (for tagging users in comments)
CREATE TABLE IF NOT EXISTS comment_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES review_comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(comment_id, mentioned_user_id)
);

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_review_likes_review_id ON review_likes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_likes_user_id ON review_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_review_id ON review_comments(review_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_user_id ON review_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_mentions_comment_id ON comment_mentions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_mentions_mentioned_user_id ON comment_mentions(mentioned_user_id);

-- 5. Enable Row Level Security
ALTER TABLE review_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_mentions ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for review_likes

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view likes" ON review_likes;
DROP POLICY IF EXISTS "Users can add their own likes" ON review_likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON review_likes;

-- Everyone can view likes
CREATE POLICY "Anyone can view likes"
  ON review_likes FOR SELECT
  USING (true);

-- Authenticated users can add their own likes
CREATE POLICY "Users can add their own likes"
  ON review_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own likes
CREATE POLICY "Users can delete their own likes"
  ON review_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 7. RLS Policies for review_comments

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view comments" ON review_comments;
DROP POLICY IF EXISTS "Authenticated users can add comments" ON review_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON review_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON review_comments;

-- Everyone can view comments
CREATE POLICY "Anyone can view comments"
  ON review_comments FOR SELECT
  USING (true);

-- Authenticated users can add comments
CREATE POLICY "Authenticated users can add comments"
  ON review_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update their own comments"
  ON review_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments"
  ON review_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 8. RLS Policies for comment_mentions

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view mentions" ON comment_mentions;
DROP POLICY IF EXISTS "Comment authors can add mentions" ON comment_mentions;
DROP POLICY IF EXISTS "Comment authors can delete mentions" ON comment_mentions;

-- Everyone can view mentions
CREATE POLICY "Anyone can view mentions"
  ON comment_mentions FOR SELECT
  USING (true);

-- Comment authors can add mentions
CREATE POLICY "Comment authors can add mentions"
  ON comment_mentions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM review_comments
      WHERE id = comment_id AND user_id = auth.uid()
    )
  );

-- Comment authors can delete mentions from their comments
CREATE POLICY "Comment authors can delete mentions"
  ON comment_mentions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM review_comments
      WHERE id = comment_id AND user_id = auth.uid()
    )
  );

-- 9. Function to update comment updated_at timestamp
DROP FUNCTION IF EXISTS update_comment_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION update_comment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_review_comments_updated_at ON review_comments;

CREATE TRIGGER update_review_comments_updated_at
  BEFORE UPDATE ON review_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_comment_updated_at();

-- 10. Ensure notifications table has required columns
-- Check if notifications table exists and add missing columns if needed
DO $$ 
BEGIN
  -- Create table if it doesn't exist
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    CREATE TABLE notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  ELSE
    -- Table exists, ensure it has the message column
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'notifications' 
      AND column_name = 'message'
    ) THEN
      -- Add message column if it doesn't exist
      ALTER TABLE notifications ADD COLUMN message TEXT NOT NULL DEFAULT '';
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- System can insert notifications
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to create notification for mentions
DROP FUNCTION IF EXISTS notify_mention() CASCADE;

CREATE OR REPLACE FUNCTION notify_mention()
RETURNS TRIGGER AS $$
DECLARE
  comment_author TEXT;
  review_restaurant TEXT;
  comment_content TEXT;
BEGIN
  -- Get comment author and review details
  SELECT p.username, r.name INTO comment_author, review_restaurant
  FROM review_comments rc
  JOIN profiles p ON rc.user_id = p.id
  JOIN reviews rev ON rc.review_id = rev.id
  JOIN restaurants r ON rev.restaurant_id = r.id
  WHERE rc.id = NEW.comment_id;

  -- Get comment content
  SELECT content INTO comment_content
  FROM review_comments
  WHERE id = NEW.comment_id;

  -- Create notification (using 'message' column instead of 'content')
  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (
    NEW.mentioned_user_id,
    'mention',
    'New Mention',
    comment_author || ' mentioned you in a comment on ' || review_restaurant,
    '/review/' || (SELECT review_id FROM review_comments WHERE id = NEW.comment_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid conflicts
DROP TRIGGER IF EXISTS on_mention_created ON comment_mentions;

CREATE TRIGGER on_mention_created
  AFTER INSERT ON comment_mentions
  FOR EACH ROW
  EXECUTE FUNCTION notify_mention();

-- Function to create notification for comments on user's review
DROP FUNCTION IF EXISTS notify_review_comment() CASCADE;

CREATE OR REPLACE FUNCTION notify_review_comment()
RETURNS TRIGGER AS $$
DECLARE
  review_author_id UUID;
  comment_author TEXT;
BEGIN
  -- Get review author
  SELECT user_id INTO review_author_id
  FROM reviews
  WHERE id = NEW.review_id;

  -- Don't notify if commenting on own review
  IF review_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get comment author username
  SELECT username INTO comment_author
  FROM profiles
  WHERE id = NEW.user_id;

  -- Create notification (using 'message' column instead of 'content')
  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (
    review_author_id,
    'comment',
    'New Comment',
    comment_author || ' commented on your review',
    '/review/' || NEW.review_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid conflicts
DROP TRIGGER IF EXISTS on_comment_created ON review_comments;

CREATE TRIGGER on_comment_created
  AFTER INSERT ON review_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_review_comment();

-- Function to create notification for likes on user's review
DROP FUNCTION IF EXISTS notify_review_like() CASCADE;

CREATE OR REPLACE FUNCTION notify_review_like()
RETURNS TRIGGER AS $$
DECLARE
  review_author_id UUID;
  liker_username TEXT;
BEGIN
  -- Get review author
  SELECT user_id INTO review_author_id
  FROM reviews
  WHERE id = NEW.review_id;

  -- Don't notify if liking own review
  IF review_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get liker username
  SELECT username INTO liker_username
  FROM profiles
  WHERE id = NEW.user_id;

  -- Create notification (using 'message' column instead of 'content')
  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (
    review_author_id,
    'like',
    'New Like',
    liker_username || ' liked your review',
    '/review/' || NEW.review_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid conflicts
DROP TRIGGER IF EXISTS on_like_created ON review_likes;

CREATE TRIGGER on_like_created
  AFTER INSERT ON review_likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_review_like();

