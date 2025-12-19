# Allow Multiple Reviews Per Restaurant - Migration Guide

## Problem
Users are getting the error "Failed to create review" when trying to share multiple experiences at the same restaurant. This is because the database has a UNIQUE constraint on `(user_id, restaurant_id)` that prevents multiple reviews.

## Solution
Run the migration `103-allow-multiple-reviews-per-restaurant.sql` to remove this constraint.

## How to Apply the Migration

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"
4. Copy and paste the contents of `103-allow-multiple-reviews-per-restaurant.sql`
5. Click "Run" to execute the migration
6. You should see a success message: "Unique constraint on (user_id, restaurant_id) has been removed"

### Option 2: Using Supabase CLI
```bash
# Make sure you're in your project directory
cd pachu-app

# Run the migration
supabase db execute database-migrations/103-allow-multiple-reviews-per-restaurant.sql
```

### Option 3: Using psql (if you have direct database access)
```bash
psql -h your-db-host -U postgres -d postgres -f database-migrations/103-allow-multiple-reviews-per-restaurant.sql
```

## What This Changes
- **Before**: Users could only have ONE review per restaurant (enforced by database constraint)
- **After**: Users can share MULTIPLE experiences at the same restaurant (no constraint)

## Code Changes Already Made
The following code changes have already been implemented to support multiple reviews:

1. ✅ **API** (`app/api/reviews/route.ts`): Updated to create new reviews instead of always updating existing ones
2. ✅ **Restaurant Page** (`app/restaurant/[id]/page.tsx`): Removed the "Already Shared" disabled state
3. ✅ **Review Modal** (`components/review/write-review-modal.tsx`): Added support for editing existing reviews with `reviewId` parameter

## Testing After Migration
1. Go to any restaurant page
2. Click "Share Experience" and submit a review
3. Click "Share Experience" again and submit another review
4. Both reviews should appear on the restaurant page
5. You should be able to edit each review individually from your profile page

## Important Notes
- This change is **non-reversible** without data loss (you can't add the constraint back if users already have multiple reviews)
- Existing single reviews will continue to work normally
- The average rating calculation will now include all reviews from the same user for that restaurant

