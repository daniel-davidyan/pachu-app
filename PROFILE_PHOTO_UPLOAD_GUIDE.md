# Profile Photo Upload - Feature Guide

## ✅ What's New

You can now upload a profile photo to your account! Simply click the camera icon on your profile avatar.

---

## 🚀 How to Use

### Upload Your Profile Photo

1. **Go to Your Profile**
   - Click on the "Profile" tab in the bottom navigation

2. **Click the Camera Icon**
   - You'll see a small camera button on the bottom-right of your avatar
   - Click it to open the file picker

3. **Select Your Photo**
   - Choose an image from your device
   - Supported formats: JPEG, PNG, WebP, GIF
   - Maximum size: 5MB

4. **Done!**
   - Your photo uploads automatically
   - You'll see it appear immediately on your profile
   - A success message confirms the upload

---

## 📋 Requirements

### Image Requirements
- **Formats:** JPEG, JPG, PNG, WebP, GIF
- **Maximum Size:** 5MB
- **Type:** Must be an image file

### Database Requirements
Before using this feature, make sure you've set up the storage bucket:

1. Open your Supabase Dashboard
2. Go to SQL Editor
3. Run this migration file:
   ```
   database-migrations/102-setup-avatars-storage.sql
   ```

This creates the `avatars` storage bucket with proper permissions.

---

## 🔧 Setup Instructions

### Step 1: Run the Database Migration

```sql
-- Open Supabase SQL Editor and run:
-- database-migrations/102-setup-avatars-storage.sql
```

This will:
- ✅ Create the `avatars` storage bucket
- ✅ Set up storage policies
- ✅ Configure file size limits (5MB)
- ✅ Set allowed image types
- ✅ Make avatars publicly viewable

### Step 2: Verify Setup

After running the migration, check that:

```sql
-- Should return 1 row with avatars bucket info
SELECT * FROM storage.buckets WHERE id = 'avatars';

-- Should return 4 policies
SELECT policyname FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects' 
AND policyname LIKE '%avatar%';
```

### Step 3: Test It!

1. Go to your profile
2. Click the camera icon
3. Upload a photo
4. Refresh the page to verify it persists

---

## 🎯 Features

### ✅ Implemented

- [x] Click camera icon to upload
- [x] File validation (type and size)
- [x] Progress indicator during upload
- [x] Automatic profile update
- [x] Public URL generation
- [x] Error handling with user feedback
- [x] 5MB file size limit
- [x] Image type validation
- [x] Unique filenames (prevents conflicts)
- [x] Success confirmation message

### 🔄 Upload Process

1. **Select File** → User clicks camera icon
2. **Validate** → Check file type and size
3. **Upload** → Send to Supabase Storage (`avatars` bucket)
4. **Get URL** → Generate public URL
5. **Update Profile** → Save URL to `profiles` table
6. **Display** → Show new avatar immediately

---

## 🐛 Troubleshooting

### "Failed to upload photo"

**Possible causes:**
- Storage bucket not created → Run migration file
- File too large → Max 5MB
- Wrong file type → Use JPEG, PNG, WebP, or GIF
- Not logged in → Sign in first

**Solution:**
1. Check browser console for errors (F12)
2. Verify storage bucket exists in Supabase
3. Confirm you're logged in
4. Try a smaller image

### Photo doesn't appear after upload

**Possible causes:**
- Cache issue
- Upload succeeded but UI didn't update

**Solution:**
1. Refresh the page (F5)
2. Check Supabase Storage bucket for your image
3. Check browser console for errors

### "Image must be less than 5MB"

**Solution:**
- Compress your image using:
  - Online tools (tinypng.com, compressor.io)
  - Image editing software (Photoshop, GIMP)
  - Built-in OS tools

### Storage bucket doesn't exist

**Error message:**
```
"The resource you requested could not be found"
```

**Solution:**
Run the migration:
```bash
# In Supabase SQL Editor:
# Copy/paste contents of:
database-migrations/102-setup-avatars-storage.sql
```

---

## 🔒 Security

### Row Level Security (RLS)

The storage bucket has proper RLS policies:

✅ **Anyone can view** avatars (public bucket)
✅ **Only authenticated users** can upload
✅ **Only you** can update/delete your own avatar

### File Validation

Client-side validation:
- ✅ File type check
- ✅ File size check (5MB limit)

Server-side validation:
- ✅ Supabase enforces allowed MIME types
- ✅ Supabase enforces file size limit
- ✅ RLS policies enforce permissions

---

## 📊 Database Schema

### Storage Bucket

```sql
Bucket: avatars
- Public: true
- File size limit: 5MB (5242880 bytes)
- Allowed types: image/jpeg, image/jpg, image/png, image/webp, image/gif
```

### Profiles Table

```sql
profiles.avatar_url: TEXT
- Stores public URL of uploaded avatar
- Nullable (users can have no avatar)
- Format: https://[project].supabase.co/storage/v1/object/public/avatars/[filename]
```

---

## 🎨 Technical Implementation

### File Naming Convention

```
Format: {user_id}-{timestamp}.{extension}
Example: baaa812c-66f9-41de-8387-efb7535d7757-1702234567890.jpg
```

This ensures:
- ✅ Unique filenames (no conflicts)
- ✅ Easy identification of owner
- ✅ Chronological ordering

### Upload Flow

```typescript
1. User selects file
2. Validate file type and size
3. Generate unique filename: `${userId}-${timestamp}.${ext}`
4. Upload to Supabase Storage: avatars/${filename}
5. Get public URL
6. Update profiles table: avatar_url = publicUrl
7. Update local state
8. Show success message
```

### Error Handling

The implementation handles:
- ✅ Invalid file types
- ✅ Files too large
- ✅ Upload failures
- ✅ Database update failures
- ✅ Network errors
- ✅ Missing permissions

---

## 📱 User Experience

### Visual Feedback

- **Before upload:** Camera icon is visible
- **During upload:** Spinner replaces camera icon
- **Button disabled:** Can't click during upload
- **After upload:** Success message + new avatar displays
- **On error:** Alert with helpful message

### Accessibility

- ✅ Button has `title` attribute for hover tooltip
- ✅ Disabled state during upload
- ✅ Screen reader friendly (semantic HTML)
- ✅ Keyboard accessible

---

## 🚀 What's Next?

### Potential Enhancements (Future)

- [ ] Image cropping/editing before upload
- [ ] Multiple photo upload (photo gallery)
- [ ] Drag-and-drop upload
- [ ] Webcam capture option
- [ ] Image filters/effects
- [ ] Avatar removal option
- [ ] Upload progress bar
- [ ] Image preview before upload
- [ ] Automatic image optimization/compression

---

## 📞 Need Help?

### Check These First

1. **Browser Console** (F12) - Check for errors
2. **Supabase Dashboard** - Verify bucket exists
3. **Network Tab** (F12) - Check upload requests
4. **Storage Bucket** - Verify files are uploading

### Common Issues Quick Fix

| Issue | Quick Fix |
|-------|-----------|
| "Bucket not found" | Run migration 102-setup-avatars-storage.sql |
| "File too large" | Compress image to under 5MB |
| "Invalid file type" | Use JPEG, PNG, WebP, or GIF |
| "Not authorized" | Make sure you're logged in |
| Photo doesn't show | Refresh page (F5) |

---

## ✅ Checklist

Before deploying to production:

- [ ] Run migration `102-setup-avatars-storage.sql`
- [ ] Verify storage bucket exists
- [ ] Test upload with different image types
- [ ] Test with large file (should reject)
- [ ] Test with non-image file (should reject)
- [ ] Verify photo persists after page refresh
- [ ] Check mobile responsiveness
- [ ] Test on different browsers

---

**Status:** ✅ Ready to Use  
**Version:** 1.0.0  
**Date:** December 10, 2025  
**Feature:** Profile Photo Upload

---

Enjoy your new profile photo feature! 📸

