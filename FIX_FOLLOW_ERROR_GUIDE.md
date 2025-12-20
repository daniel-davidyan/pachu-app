# Fix Follow Error Guide

## Problem
Getting a runtime error when trying to follow a user from the "Followers" tab:
```
Error: Failed to update follow status
```

## Root Cause
The most likely cause is one of the following:
1. **RLS (Row Level Security) policies are missing or incorrect** on the `follows` table
2. **Column name mismatch** - database might have `followed_id` instead of `following_id`
3. **Foreign key constraints** - target user might not exist in profiles table

## Solution Steps

### Step 1: Check What Error You're Actually Getting

With the updated code, try to follow someone again. You should now see:

1. **In the browser alert**: A specific error message
2. **In your browser console**: Detailed error information
3. **In the Next.js terminal** (where `npm run dev` is running): Server-side logs showing exactly what's failing

Look for lines starting with `[FOLLOW]` or `[FOLLOW API]` in the terminal.

### Step 2: Fix RLS Policies (Most Common Issue)

Run this SQL in your Supabase SQL Editor:

```sql
-- Run the migration script
\i database-migrations/104-fix-follows-rls-policies.sql
```

Or manually run the commands from `database-migrations/104-fix-follows-rls-policies.sql` in the Supabase SQL Editor.

### Step 3: Fix Column Name Issue (If Applicable)

If you see an error mentioning `column "following_id" does not exist`, run:

```sql
-- Run the migration script
\i database-migrations/100-fix-follows-column.sql
```

Or manually run the commands from `database-migrations/100-fix-follows-column.sql`.

### Step 4: Verify the Setup

Run this diagnostic query in Supabase SQL Editor:

```sql
-- Check RLS is enabled
SELECT 
  'RLS ENABLED' AS check_type,
  CASE 
    WHEN relrowsecurity = true 
    THEN '✅ YES'
    ELSE '❌ NO - RLS is disabled!'
  END AS result
FROM pg_class 
WHERE relname = 'follows';

-- Check policies exist
SELECT 
  'RLS POLICIES' AS info,
  policyname AS policy_name,
  cmd AS command
FROM pg_policies 
WHERE tablename = 'follows';

-- Check columns
SELECT 
  'COLUMNS' AS info,
  column_name
FROM information_schema.columns 
WHERE table_name = 'follows'
AND column_name IN ('following_id', 'followed_id');
```

You should see:
- ✅ RLS is enabled
- 3 policies: one each for SELECT, INSERT, and DELETE
- Column name should be `following_id` (not `followed_id`)

### Step 5: Test Again

1. Refresh your app at http://localhost:3000
2. Go to Profile → Connections → Followers tab
3. Try to follow someone
4. Check the browser alert and terminal logs

## Common Error Messages

### "Already following this user"
- **Cause**: Unique constraint violation
- **Fix**: You're already following them. The database prevented a duplicate.
- **Action**: This is actually working correctly! The UI should show "Following" button instead.

### "User not found"
- **Cause**: The target user doesn't exist in the profiles table
- **Fix**: Make sure the user has a profile record in the `profiles` table

### "You cannot follow yourself"
- **Cause**: Trying to follow your own account
- **Fix**: This is prevented by design. No action needed.

### "new row violates row-level security policy"
- **Cause**: RLS policy is blocking the insert
- **Fix**: Run Step 2 above to fix RLS policies

### "column 'following_id' does not exist"
- **Cause**: Database has `followed_id` column instead
- **Fix**: Run Step 3 above to rename the column

## Files Modified

1. `app/profile/connections/page.tsx` - Better error handling with alerts
2. `app/api/users/follow/route.ts` - Added comprehensive logging and better error messages
3. `database-migrations/104-fix-follows-rls-policies.sql` - New migration to fix RLS policies

## What Changed

### Frontend (Connections Page)
- Now shows alert with actual error message
- Logs detailed error info to browser console
- Parses and displays the specific error from the API

### Backend (Follow API)
- Added detailed logging for every step
- Returns specific error details (code, message, hint)
- Logs are prefixed with `[FOLLOW]` or `[FOLLOW API]` for easy filtering

## Quick Test

Try this in your browser console while on the Connections page:

```javascript
// This should show detailed error
const response = await fetch('/api/users/follow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    userId: 'baaa812c-66f9-41de-8387-efb7535d7757', // Daniel's ID
    action: 'follow' 
  })
});
const data = await response.json();
console.log('Response:', data);
```

## Need More Help?

1. Check the terminal where `npm run dev` is running
2. Look for lines starting with `[FOLLOW]` or `[FOLLOW API]`
3. Share the error message from the alert popup
4. Share the terminal logs

## Success Criteria

When everything is working correctly, you should see:

1. **In the terminal**: 
   ```
   [FOLLOW API] Request: { userId: '...', action: 'follow', currentUserId: '...' }
   [FOLLOW] User ... attempting to follow ...
   [FOLLOW] Successfully followed user
   POST /api/users/follow 200 in ...ms
   ```

2. **In the browser**: The button changes from "Follow" to "Following"

3. **No error alerts** appear

