# Profile Feature Setup Guide

## 🎯 What We Built

✅ **Profile Page** - View your profile with avatar, stats, and tabs
✅ **Edit Profile Page** - Update your name, username, and bio
✅ **Mobile-Optimized** - Beautiful responsive design matching the app's UI

---

## 🗄️ Database Setup

You need to create the `profiles` table in Supabase. Follow these steps:

### **Step 1: Go to Supabase SQL Editor**

1. Open your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **pachu-app**
3. Go to **SQL Editor** (in the left sidebar)

### **Step 2: Run This SQL**

Copy and paste this SQL code and click **Run**:

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30)
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone" 
  ON profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### **Step 3: Create Profile for Existing Users**

If you already have users in your database (like your own account), you need to create profiles for them manually:

```sql
-- Replace YOUR_USER_ID with your actual user ID from auth.users table
-- You can find your user ID by going to: Authentication > Users in Supabase dashboard

INSERT INTO profiles (id, username, full_name, avatar_url)
VALUES (
  'YOUR_USER_ID',  -- Replace with your actual user ID
  'YOUR_USERNAME', -- Your desired username
  'Your Full Name', -- Your full name
  NULL -- Avatar URL (optional)
);
```

**How to find your User ID:**
1. Go to **Authentication** → **Users** in Supabase dashboard
2. Find your account and copy the **ID** (UUID format)
3. Replace `YOUR_USER_ID` in the SQL above

---

## ✨ Features Included

### **Profile Page (`/profile`)**
- ✅ User avatar display (or default gradient avatar)
- ✅ Full name and username
- ✅ Bio text
- ✅ Joined date
- ✅ Stats cards (Reviews, Friends, Wishlist)
- ✅ Settings button (links to `/settings`)
- ✅ Edit profile button
- ✅ Tabs: My Reviews, Wishlist, Friends (placeholders for now)
- ✅ Mobile-first responsive design

### **Edit Profile Page (`/profile/edit`)**
- ✅ Edit full name
- ✅ Edit username (validated: 3-30 chars, letters, numbers, underscores)
- ✅ Edit bio (max 160 characters)
- ✅ Avatar upload placeholder (coming soon)
- ✅ Save button with loading state
- ✅ Success/error messages
- ✅ Auto-redirect to profile after save

---

## 🎨 Design Highlights

- **Modern gradient header** with primary color
- **Elevated profile card** with shadow
- **Circular avatar** with edit button
- **Stats cards** with icons
- **Tab navigation** with smooth transitions
- **Consistent with auth pages** design language
- **Mobile-optimized** padding and spacing

---

## 📝 Next Steps

After setting up the profiles table:

1. **Test the profile page**: Go to http://localhost:3000/profile
2. **Edit your profile**: Click the edit icon on your avatar
3. **Update your info**: Add your name, username, and bio
4. **Check it works**: Save and see the updated profile

---

## 🚀 Coming Soon

- Avatar photo upload to Supabase Storage
- Friends system (follow/unfollow)
- Reviews display in profile
- Wishlist integration
- Public profile view (view other users' profiles)

---

## 🐛 Troubleshooting

**Problem**: "Profile not found" error
**Solution**: Make sure you created a profile for your user (Step 3 above)

**Problem**: Can't update profile
**Solution**: Check that Row Level Security policies are created correctly

**Problem**: Username validation error
**Solution**: Username must be 3-30 characters, only letters, numbers, and underscores

---

Need help? Check the Supabase dashboard logs or console for detailed error messages.

