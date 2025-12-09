# Pachu - the taste signature

A mobile-optimized web application that combines AI-powered restaurant recommendations with a social network for sharing reviews with friends.

## 🚀 What's Been Built So Far

### ✅ Phase 1: Foundation (COMPLETE)
- [x] Modern tech stack setup (Next.js 16, React 19, TypeScript, Tailwind CSS v4)
- [x] Internationalization (Hebrew & English with RTL/LTR support)
- [x] Color system based on primary color `rgb(197, 69, 156)`
- [x] Base layout with top bar and bottom navigation
- [x] Mobile-first responsive design
- [x] Supabase integration for database and authentication
- [x] Complete database schema design (ready to execute)

### 🏗️ App Structure
- **Top Bar**: Settings (left), Pachu logo (center), Notifications (right)
- **Bottom Navigation**: Feed, Map, Chat, Wishlist, Profile
- **Future Expansion Tabs**: Restaurants (active), Hotels, Movies, Books, Professionals (coming soon)

### 📱 Main Pages (Placeholders Created)
- `/feed` - Social feed with friends' reviews
- `/map` - Geographic view of restaurant reviews
- `/chat` - AI chat for personalized recommendations
- `/wishlist` - Saved restaurants to visit
- `/profile` - User profile page
- `/notifications` - Activity notifications
- `/settings` - App settings & language switcher

## 🔧 Setup Instructions

### 1. Install Dependencies
Dependencies are already installed. The project includes:
- Next.js 16 with Turbopack
- Supabase for database & auth
- next-intl for internationalization
- Mapbox for maps
- OpenAI for AI chat
- Radix UI components
- Tailwind CSS v4

### 2. Set Up Environment Variables
Create a `.env.local` file in the root directory:

```env
# Supabase (you should already have these)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# OpenAI (generate at https://platform.openai.com/api-keys)
OPENAI_API_KEY=your-openai-api-key

# Mapbox (generate at https://account.mapbox.com/)
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token

# Google Places API (generate at https://console.cloud.google.com/)
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=your-google-places-api-key
```

### 3. Set Up Supabase Database
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Open `DATABASE_SCHEMA.md` in this project
4. Copy and paste each SQL section into the Supabase SQL Editor
5. Execute them in order

This will create:
- User profiles table
- Restaurants/venues tables
- Reviews and ratings system
- Social features (follows, friends)
- Wishlist
- Notifications
- Chat history
- Storage buckets for images

### 4. Configure OAuth Providers in Supabase
1. Go to Authentication > Providers in Supabase
2. Enable and configure:
   - Google OAuth
   - Facebook OAuth
   - Microsoft OAuth
3. Follow Supabase's guides for each provider

### 5. Run the Development Server
The server should already be running at `http://localhost:3000`

If not, run:
```bash
npm run dev
```

## 🎨 Design System

### Color Palette
The app uses a comprehensive color system centered around the primary color:

- **Primary**: `rgb(197, 69, 156)` - Main brand color
- **Secondary**: `rgb(69, 156, 197)` - Complementary blue
- **Shades**: Each color has 10 shades from 50 (lightest) to 950 (darkest)

To change the entire color scheme, simply update the primary color in:
- `tailwind.config.ts`
- `app/globals.css` (CSS variables)

### Typography
Using Inter font family for clean, modern typography.

### Components
Custom components built with:
- Tailwind CSS for styling
- Radix UI for accessible primitives
- Mobile-first responsive design

## 🌍 Internationalization

The app supports English and Hebrew:
- Toggle language in Settings
- RTL/LTR layouts automatically adjust
- All UI text is translatable

## 📋 Next Steps (TODO)

### Phase 2: Authentication (Next)
- [ ] Build login/signup pages
- [ ] Implement email/password authentication
- [ ] Add OAuth provider buttons
- [ ] Create protected routes
- [ ] User session management

### Phase 3: Core Social Features
- [ ] User profile pages
- [ ] Friend/follow system
- [ ] Restaurant database integration with Google Places API
- [ ] Review creation with ratings and photos
- [ ] Feed view with friends' reviews
- [ ] Image upload to Supabase Storage

### Phase 4: Map View
- [ ] Integrate Mapbox
- [ ] Display restaurants on map
- [ ] Show review pins with photos
- [ ] Interactive map controls

### Phase 5: Features
- [ ] Wishlist functionality
- [ ] Notification system
- [ ] Search functionality

### Phase 6: AI Chat Recommender
- [ ] Chat UI interface
- [ ] OpenAI integration
- [ ] Personalization engine using user data
- [ ] Restaurant recommendations based on taste

### Phase 7: Polish
- [ ] Animations and transitions
- [ ] Performance optimization
- [ ] Testing
- [ ] Deploy to Vercel

## 🗂️ Project Structure

```
pachu-app/
├── app/
│   ├── [locale]/           # Locale-based routing
│   │   ├── layout.tsx      # Main layout with i18n
│   │   ├── page.tsx        # Homepage (redirects to feed)
│   │   ├── feed/           # Feed page
│   │   ├── map/            # Map view page
│   │   ├── chat/           # AI chat page
│   │   ├── wishlist/       # Wishlist page
│   │   ├── profile/        # Profile page
│   │   ├── notifications/  # Notifications page
│   │   └── settings/       # Settings page
│   └── globals.css         # Global styles + color system
├── components/
│   └── layout/             # Layout components
│       ├── top-bar.tsx     # Top navigation bar
│       ├── bottom-nav.tsx  # Bottom navigation
│       └── main-layout.tsx # Main layout wrapper
├── lib/
│   ├── supabase/          # Supabase clients
│   │   ├── client.ts      # Browser client
│   │   ├── server.ts      # Server client
│   │   └── middleware.ts  # Auth middleware
│   └── utils.ts           # Utility functions
├── i18n/
│   └── request.ts         # i18n request config
├── messages/
│   ├── en.json           # English translations
│   └── he.json           # Hebrew translations
├── middleware.ts          # Next.js middleware (auth + i18n)
├── tailwind.config.ts     # Tailwind configuration
├── next.config.ts         # Next.js configuration
├── DATABASE_SCHEMA.md     # Complete database schema
└── README.md             # This file
```

## 🔑 API Keys Needed

Please generate these API keys:

1. **OpenAI API**: https://platform.openai.com/api-keys
2. **Mapbox Token**: https://account.mapbox.com/
3. **Google Places API**: https://console.cloud.google.com/
   - Enable "Places API" in your Google Cloud project
4. **OAuth Providers** (in Supabase dashboard):
   - Google OAuth
   - Facebook OAuth
   - Microsoft OAuth

## 📱 Testing

1. Open http://localhost:3000
2. You should see the Feed page (placeholder)
3. Try navigating between pages using the bottom navigation
4. Go to Settings to switch between English and Hebrew
5. Notice how the layout changes from LTR to RTL

## 🐛 Current Status

✅ **Working:**
- Development server running
- All pages accessible
- Language switching works
- Navigation functional
- Mobile-responsive layout

⏳ **In Progress:**
- Authentication system (next step)

## 📞 Need Help?

If you encounter any issues:
1. Check that all environment variables are set in `.env.local`
2. Verify Supabase database schema is executed
3. Make sure npm packages are installed
4. Check the terminal for error messages

## 🎯 Vision

Pachu will become the ultimate platform for personalized recommendations:
- Start with restaurants
- Expand to hotels, movies, books, professionals
- AI that knows your taste better than anything
- Social discovery through friends' reviews

---

**Current Version:** Foundation Complete
**Last Updated:** December 2025
**Framework:** Next.js 16 + React 19 + TypeScript + Supabase
