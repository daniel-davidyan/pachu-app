# Comment Likes and @Mentions Update

## New Features Added

### 1. Comment Likes ❤️
Users can now like comments just like they can like posts!

**Features:**
- Click heart icon on any comment to like/unlike
- See like count on each comment
- Visual feedback (filled heart when liked)
- Optimistic updates for instant UI response
- Notifications when someone likes your comment

**How it works:**
- Each comment shows a small heart icon with like count
- Click to like, click again to unlike
- Only logged-in users can like comments
- Comment authors get notifications when their comments are liked

### 2. Improved @Mention Autocomplete 👤

**Old behavior:** No dropdown or limited results
**New behavior:** Shows ALL friends you follow when you type @

**Features:**
- Type `@` in a comment to see dropdown
- Shows all your friends (people you follow)
- Type more letters to filter the list
- Click a friend to mention them
- Shows up to 20 friends at once
- Sorted alphabetically for easy finding

**How it works:**
1. User types `@` in comment box
2. Dropdown appears with all friends
3. Type more to filter (e.g., `@joh` shows only friends with "joh" in username)
4. Click a friend to insert their @mention
5. Friend gets notified when comment is posted

## Files Changed

### Database Migration
- `database-migrations/106-add-comment-likes.sql` - New migration for comment likes

### API Endpoints
- `app/api/reviews/[reviewId]/comments/[commentId]/like/route.ts` - Like/unlike comments
- `app/api/reviews/[reviewId]/comments/route.ts` - Updated to include likes count
- `app/api/friends/search/route.ts` - Fixed to show ALL friends, not just search results

### Components
- `components/post/post-card.tsx` - Added comment likes UI and improved mentions

## Installation Steps

### 1. Run the Comment Likes Migration

In your **Supabase SQL Editor**, run:

```sql
-- database-migrations/106-add-comment-likes.sql
```

This will:
- ✅ Create `comment_likes` table
- ✅ Set up RLS policies
- ✅ Create notification triggers for comment likes
- ✅ Add indexes for performance

### 2. Test the Features

**Test Comment Likes:**
1. Go to any post with comments
2. Click the heart icon on a comment
3. See the count increase
4. Click again to unlike
5. Check notifications for comment likes

**Test @Mentions:**
1. Open a post and click to add a comment
2. Type `@` in the comment box
3. See dropdown with all your friends
4. Type more letters to filter
5. Click a friend to mention them
6. Post the comment
7. Friend should get a notification

## Database Schema

```
comment_likes
├── id (uuid, pk)
├── comment_id (uuid, fk -> review_comments)
├── user_id (uuid, fk -> profiles)
└── created_at (timestamp)
```

## API Endpoints

### Comment Likes
- `POST /api/reviews/[reviewId]/comments/[commentId]/like` - Like a comment
- `DELETE /api/reviews/[reviewId]/comments/[commentId]/like` - Unlike a comment

### Friend Search (Updated)
- `GET /api/friends/search?q=username` - Get all friends, optionally filtered

## UI Components

### Comment with Like Button
```
┌─────────────────────────────────┐
│ @username                       │
│ This is a great comment!        │
│                                 │
│ 2 min ago  ❤️ 3  Delete        │
└─────────────────────────────────┘
```

### @Mention Dropdown
```
┌─────────────────────────────────┐
│ Type comment... @joh            │
│ ┌───────────────────────────┐   │
│ │ 👤 John Smith @johnsmith  │   │
│ │ 👤 Johnny Doe @johnnyd    │   │
│ └───────────────────────────┘   │
└─────────────────────────────────┘
```

## Features Summary

✅ **Like comments** with visual feedback
✅ **Unlike comments** by clicking again
✅ **See like counts** on each comment
✅ **Get notifications** when someone likes your comment
✅ **@Mention autocomplete** shows ALL friends
✅ **Filter friends** by typing more letters
✅ **Click to insert** friend's @mention
✅ **Get notified** when mentioned in comments

## Notes

- Comment likes work the same as post likes
- Only logged-in users can like comments
- Can't like your own comments (no notification sent)
- @Mention dropdown shows up to 20 friends
- Friends list is alphabetically sorted
- Typing filters the friend list in real-time
- All existing features (post likes, comments, mentions) still work perfectly

