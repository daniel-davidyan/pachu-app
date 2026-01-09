-- Fix notification triggers to include actor_id
-- This is required for the notifications API to properly show who did the action

-- 1. Update the like notification trigger
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

  -- Create notification WITH actor_id
  INSERT INTO notifications (user_id, type, title, message, link, actor_id, reference_id, read)
  VALUES (
    review_author_id,
    'like',
    'New Like',
    liker_username || ' liked your review',
    '/review/' || NEW.review_id,
    NEW.user_id,  -- actor_id = the person who liked
    NEW.review_id, -- reference_id = the review that was liked
    false
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_like_created
  AFTER INSERT ON review_likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_review_like();


-- 2. Update the comment notification trigger
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

  -- Create notification WITH actor_id
  INSERT INTO notifications (user_id, type, title, message, link, actor_id, reference_id, read)
  VALUES (
    review_author_id,
    'comment',
    'New Comment',
    comment_author || ' commented on your review',
    '/review/' || NEW.review_id,
    NEW.user_id,  -- actor_id = the person who commented
    NEW.review_id, -- reference_id = the review that was commented on
    false
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_comment_created
  AFTER INSERT ON review_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_review_comment();


-- 3. Update the mention notification trigger
DROP FUNCTION IF EXISTS notify_mention() CASCADE;

CREATE OR REPLACE FUNCTION notify_mention()
RETURNS TRIGGER AS $$
DECLARE
  comment_author TEXT;
  comment_author_id UUID;
  review_id_val UUID;
BEGIN
  -- Get comment author info and review_id
  SELECT rc.user_id, p.username, rc.review_id 
  INTO comment_author_id, comment_author, review_id_val
  FROM review_comments rc
  JOIN profiles p ON rc.user_id = p.id
  WHERE rc.id = NEW.comment_id;

  -- Don't notify if mentioning yourself
  IF NEW.mentioned_user_id = comment_author_id THEN
    RETURN NEW;
  END IF;

  -- Create notification WITH actor_id
  INSERT INTO notifications (user_id, type, title, message, link, actor_id, reference_id, read)
  VALUES (
    NEW.mentioned_user_id,
    'mention',
    'New Mention',
    comment_author || ' mentioned you in a comment',
    '/review/' || review_id_val,
    comment_author_id,  -- actor_id = the person who mentioned
    review_id_val,      -- reference_id = the review
    false
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_mention_created
  AFTER INSERT ON comment_mentions
  FOR EACH ROW
  EXECUTE FUNCTION notify_mention();


-- 4. Ensure the notifications table has the correct structure
-- Add actor_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications' 
    AND column_name = 'actor_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN actor_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON notifications(actor_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications' 
    AND column_name = 'reference_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN reference_id UUID;
  END IF;
END $$;

-- 5. Add RLS policy for inserting notifications (needed for triggers with SECURITY DEFINER)
DROP POLICY IF EXISTS "Triggers can insert notifications" ON notifications;
CREATE POLICY "Triggers can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- 6. Grant execute permissions
GRANT EXECUTE ON FUNCTION notify_review_like TO authenticated;
GRANT EXECUTE ON FUNCTION notify_review_comment TO authenticated;
GRANT EXECUTE ON FUNCTION notify_mention TO authenticated;
