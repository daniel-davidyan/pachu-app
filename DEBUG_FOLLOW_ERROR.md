# 🐛 Debug Follow Error - Step by Step

## Current Error
```
Failed to follow/unfollow: "Internal server error"
```

---

## 🔍 Step 1: Run Diagnostic Script

Open Supabase SQL Editor and run:
```sql
database-migrations/101-diagnose-follows-table.sql
```

This will show you:
- ✅ If follows table exists
- ✅ What columns it has (`following_id` vs `followed_id`)
- ✅ If RLS policies are set up correctly
- ✅ What's currently in the table

---

## 🔍 Step 2: Check Browser Console

1. Open your app
2. Press F12 to open Developer Tools
3. Go to Console tab
4. Try to follow someone
5. Look for detailed error message

**Now with better logging, you should see:**
```
Failed to follow/unfollow: {
  error: "Internal server error",
  details: "actual error message here",
  hint: "Check Supabase logs for more details"
}
```

---

## 🔍 Step 3: Check Supabase Logs

1. Open Supabase Dashboard
2. Go to **Logs** section
3. Look for API errors
4. Find the POST request to `/api/users/follow`
5. Read the detailed error

Common errors you might see:
- `column "following_id" does not exist` → Run `100-fix-follows-column.sql`
- `new row violates row-level security policy` → RLS policies are wrong
- `duplicate key value violates unique constraint` → Already following
- `relation "follows" does not exist` → Table doesn't exist

---

## 🔧 Common Fixes

### Fix 1: Wrong Column Name
If diagnostic shows "followed_id" instead of "following_id":

```sql
-- Run in Supabase SQL Editor
ALTER TABLE follows RENAME COLUMN followed_id TO following_id;
```

### Fix 2: Missing RLS Policies
If diagnostic shows RLS is enabled but no policies:

```sql
-- Run in Supabase SQL Editor (included in 101-diagnose script)

-- Allow users to follow others
CREATE POLICY "Users can follow others" 
  ON follows FOR INSERT 
  WITH CHECK (auth.uid() = follower_id);

-- Allow users to unfollow
CREATE POLICY "Users can unfollow" 
  ON follows FOR DELETE 
  USING (auth.uid() = follower_id);

-- Allow everyone to view follows
CREATE POLICY "Follows are viewable by everyone" 
  ON follows FOR SELECT 
  USING (true);
```

### Fix 3: Table Doesn't Exist
If diagnostic shows table doesn't exist:

```sql
-- Run in Supabase SQL Editor
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Create indexes
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);

-- Enable RLS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Add policies (see Fix 2 above)
```

---

## 📊 Expected Diagnostic Output

### ✅ Good Output (Everything Working)
```
TABLE EXISTS: ✅ YES
COLUMN NAME CHECK: ✅ Has following_id (CORRECT)
RLS ENABLED: ✅ YES
RLS POLICIES: 
  - Users can follow others (INSERT)
  - Users can unfollow (DELETE)
  - Follows are viewable by everyone (SELECT)
FINAL CHECK: ✅ Everything looks good!
```

### ⚠️ Problem Output (Needs Fix)
```
TABLE EXISTS: ✅ YES
COLUMN NAME CHECK: ⚠️ Has followed_id (NEEDS FIX)
RLS ENABLED: ✅ YES
RLS POLICIES: (empty) ❌ NO POLICIES!
FINAL CHECK: ⚠️ Still have issues.
```

---

## 🔄 Quick Fix Process

1. **Run diagnostic**: `101-diagnose-follows-table.sql`
2. **Read the output** - it will tell you what's wrong
3. **Run the fixes** included in the diagnostic script
4. **Test again** in your app
5. **Check browser console** for detailed error if still failing

---

## 💡 Additional Debugging

### Check if you're logged in
```javascript
// Run in browser console
const supabase = createClient();
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user);
```

### Test the API directly
```javascript
// Run in browser console
fetch('/api/users/follow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'TARGET_USER_ID_HERE',
    action: 'follow'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

### Check database directly
```sql
-- Run in Supabase SQL Editor
-- See if you can insert manually
INSERT INTO follows (follower_id, following_id) 
VALUES (
  'YOUR_USER_ID',
  'TARGET_USER_ID'
);
-- If this fails, the error message will be very helpful
```

---

## 📝 Report Back

After running the diagnostic script, please share:

1. **Column name**: `following_id` or `followed_id`?
2. **RLS enabled**: Yes or No?
3. **RLS policies count**: How many policies exist?
4. **Browser console error**: Full error message with details
5. **Supabase logs**: What does the API log say?

With this information, I can provide a precise fix!

---

## 🚀 Most Likely Solution

Based on common issues, try this order:

1. ✅ Run `101-diagnose-follows-table.sql`
2. ✅ Fix column name if needed (part of diagnostic script)
3. ✅ Add RLS policies (part of diagnostic script)
4. ✅ Test following again
5. ✅ Check browser console for new error details

---

**After running these steps, the error message should be much more specific, making it easy to fix!**

