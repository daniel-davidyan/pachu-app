# 🚀 Pachu Setup Guide

## ✅ What's Already Done

### Phase 1: Foundation (COMPLETE)
- ✅ Next.js 16 + React 19 + TypeScript setup
- ✅ Tailwind CSS v4 with custom color system
- ✅ International support (English & Hebrew, RTL/LTR)
- ✅ Mobile-first responsive layout
- ✅ Top bar and bottom navigation
- ✅ All main page placeholders created

### Phase 2: Authentication (COMPLETE)
- ✅ Login page with email/password
- ✅ Signup page with email/password
- ✅ OAuth providers (Google, Facebook, Microsoft)
- ✅ Forgot password flow
- ✅ Protected routes
- ✅ User session management
- ✅ Auth state management with React hooks
- ✅ User menu in top bar

## 🔑 Required Setup Steps

### 1. Create Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase (Required NOW)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# OpenAI (Required for AI Chat - Phase 6)
OPENAI_API_KEY=your-openai-api-key

# Mapbox (Required for Map View - Phase 4)
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token

# Google Places API (Required for Restaurant Data - Phase 3)
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=your-google-places-api-key
```

### 2. Set Up Supabase Database

**IMPORTANT:** Execute the database schema before testing!

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Open `DATABASE_SCHEMA.md` in this project
4. Copy sections 1-11 one by one
5. Execute each section in order

This creates:
- ✅ User profiles
- ✅ Restaurants/venues tables
- ✅ Reviews and ratings
- ✅ Social features (follows, friends)
- ✅ Wishlist
- ✅ Notifications
- ✅ Chat history
- ✅ Storage buckets

### 3. Configure OAuth Providers in Supabase

1. Go to **Authentication > Providers** in Supabase dashboard
2. Enable these providers:

#### Google OAuth
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create OAuth 2.0 credentials
- Add to Supabase

#### Facebook OAuth
- Go to [Facebook Developers](https://developers.facebook.com/)
- Create an app
- Add to Supabase

#### Microsoft OAuth (Azure)
- Go to [Azure Portal](https://portal.azure.com/)
- Register an application
- Add to Supabase

**Callback URL:** Use the URL from Supabase dashboard (usually `https://[your-project].supabase.co/auth/v1/callback`)

### 4. Test the Application

1. Make sure the dev server is running:
   ```bash
   npm run dev
   ```

2. Visit `http://localhost:3000`

3. You should be redirected to `/auth/login`

4. Try creating an account:
   - Click "Sign Up"
   - Fill in your details
   - Or use OAuth providers

5. After login, you'll be redirected to the Feed page

## 📱 Testing Checklist

- [ ] Can sign up with email/password
- [ ] Can log in with email/password
- [ ] OAuth providers work (Google, Facebook, Microsoft)
- [ ] Can log out
- [ ] Protected routes redirect to login when not authenticated
- [ ] Language switching works (English ⟷ Hebrew)
- [ ] RTL/LTR layouts switch correctly
- [ ] Bottom navigation works
- [ ] All placeholder pages load

## 🎯 Next Development Phases

### Phase 3: User Profiles & Social Features (Next)
- User profile pages
- Edit profile functionality
- Friend/follow system
- View other users' profiles

### Phase 4: Restaurant Features
- Restaurant database with Google Places API integration
- Restaurant detail pages
- Review creation with photos
- Rating system

### Phase 5: Feed View
- Timeline of friends' reviews
- Like and comment on reviews
- Filter and search

### Phase 6: Map View
- Mapbox integration
- Restaurant pins on map
- Interactive map controls
- Filter by rating/cuisine

### Phase 7: Wishlist
- Save restaurants to wishlist
- Add notes
- Share wishlist

### Phase 8: AI Chat Recommender
- Chat UI
- OpenAI integration
- Personalization engine
- Restaurant recommendations

### Phase 9: Polish & Deploy
- Animations
- Performance optimization
- Testing
- Deploy to Vercel

## 🆘 Troubleshooting

### Server won't start
```bash
# Clean install
rm -rf node_modules
rm package-lock.json
npm install
npm run dev
```

### Auth not working
- Check `.env.local` has correct Supabase credentials
- Verify OAuth providers are enabled in Supabase
- Check browser console for errors

### Database errors
- Make sure you executed all SQL sections from `DATABASE_SCHEMA.md`
- Check Supabase logs in the dashboard
- Verify Row Level Security policies are in place

### Language/RTL issues
- Clear browser cache
- Check the URL has locale prefix: `/en/...` or `/he/...`

## 📊 Current Application Status

**Running:** ✅ http://localhost:3000

**Pages Available:**
- `/auth/login` - Login page
- `/auth/signup` - Signup page
- `/auth/forgot-password` - Password reset
- `/feed` - Feed (placeholder, requires auth)
- `/map` - Map view (placeholder, requires auth)
- `/chat` - AI chat (placeholder, requires auth)
- `/wishlist` - Wishlist (placeholder, requires auth)
- `/profile` - Profile (placeholder, requires auth)
- `/notifications` - Notifications (placeholder, requires auth)
- `/settings` - Settings with language switcher (requires auth)

## 🎨 Design System

### Colors
- **Primary:** `rgb(197, 69, 156)` - Main brand color
- **Secondary:** `rgb(69, 156, 197)` - Complementary blue
- Available in shades 50-950

### Fonts
- **Body:** Inter (system fallback)
- **Headings:** Inter

### Components
- Built with Tailwind CSS
- Mobile-first responsive
- RTL/LTR support

## 📞 Need Help?

1. Check that `.env.local` is configured
2. Verify database schema is executed
3. Check OAuth providers are set up
4. Look at terminal for errors
5. Check browser console for client errors

## ✨ What's Next?

Once you've completed the setup:
1. Test authentication thoroughly
2. Generate remaining API keys (OpenAI, Mapbox, Google Places)
3. We'll continue with Phase 3: User Profiles & Social Features

---

**Ready to continue?** Once authentication is working, let me know and we'll build the next features!

