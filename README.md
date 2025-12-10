# Pachu - The Taste Signature

A mobile-optimized social restaurant discovery platform that combines AI-powered recommendations with a social network for sharing and discovering restaurant reviews with friends.

## 🚀 Features

### ✅ Implemented Features

#### Authentication & User Management
- Email/password authentication with Supabase
- Social OAuth (Google, Facebook, Microsoft ready)
- Login, signup, and password recovery flows
- User profiles with avatars and bio
- Profile editing
- Protected routes and session management

#### Social Features
- **Follow/Unfollow Users** - Build your network of food lovers
- **Following Feed** - See reviews from people you follow
- **User Search** - Find and connect with friends
- **Mutual Friends** - Discover shared connections
- **Follower/Following Counts** - Track your social stats
- **Follow Notifications** - Get notified when someone follows you

#### Interactive Map View
- Mapbox integration with restaurant markers
- Click markers to see restaurant details
- AI-powered chat assistant for recommendations
- Location-based restaurant discovery
- Beautiful restaurant detail cards
- Photo galleries for restaurants

#### Reviews & Ratings
- **Write Reviews** - Rate restaurants 1-5 stars with detailed reviews
- **Upload Photos** - Add up to 5 photos per review
- **Update Reviews** - Edit your existing reviews anytime
- **Like Reviews** - Show appreciation for helpful reviews
- **View History** - See all your reviews on your profile
- **Friends' Reviews** - Discover restaurants through your network

#### Search & Discovery
- Search for restaurants
- Search for users
- Filter by location and preferences
- Wishlist/save restaurants for later

#### Restaurant Details
- Comprehensive restaurant information
- Google Places integration
- Photo galleries
- Friend reviews and ratings
- Save to wishlist

#### Notifications
- Activity notifications for likes, comments, follows
- Review notifications
- Real-time updates

#### Settings & Preferences
- Language switcher (English/Hebrew)
- Profile settings
- App preferences

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Maps**: Mapbox GL JS
- **AI**: OpenAI GPT-4
- **Internationalization**: next-intl (English & Hebrew with RTL support)
- **Components**: Radix UI primitives
- **State Management**: Zustand
- **Icons**: Lucide React

## 🔧 Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# OpenAI API
OPENAI_API_KEY=your-openai-api-key

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token

# Google Places API
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=your-google-places-api-key
```

### 3. Set Up Supabase Database

**Important:** The app is now ready for real data only! See `QUICK_START.md` for a 5-minute setup guide.

#### For Fresh Installation:
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Execute the schema setup files (in order):
   - `02-feed-functions.sql`
   - `05-add-review-photos.sql`

**Note:** Skip the dummy data files (`03-feed-following-dummy-data.sql` and `04-feed-dummy-data-daniel-amit.sql`) - they're no longer needed!

#### To Remove Dummy Data (if already installed):
1. Open Supabase SQL Editor
2. Run: `database-migrations/99-remove-dummy-data.sql`
3. Verify all dummy data is removed (see `QUICK_START.md`)

See `DATABASE_SCHEMA.md` for complete database documentation.

### 4. Configure OAuth Providers (Optional)

1. Go to Authentication > Providers in Supabase dashboard
2. Enable and configure:
   - Google OAuth
   - Facebook OAuth
   - Microsoft OAuth

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📱 App Structure

### Main Pages
- `/` - Home (redirects to feed)
- `/feed` - Social feed with friends' reviews
- `/map` - Interactive map view with AI chat
- `/chat` - AI chat for personalized recommendations
- `/wishlist` - Saved restaurants
- `/profile` - User profile
- `/profile/edit` - Edit profile
- `/profile/[id]` - View other users' profiles
- `/restaurant/[id]` - Restaurant details
- `/review/[id]` - Individual review page
- `/search` - Search restaurants and users
- `/notifications` - Activity notifications
- `/settings` - App settings

### Authentication Pages
- `/auth/login` - User login
- `/auth/signup` - Create account
- `/auth/forgot-password` - Password recovery
- `/auth/welcome` - Welcome page after signup
- `/auth/callback` - OAuth callback handler

## 🎨 Design System

### Color Palette
The app uses a vibrant pink/magenta as the primary brand color:
- **Primary**: `rgb(197, 69, 156)` - Main brand color
- Custom color shades from 50 (lightest) to 950 (darkest)
- Dark mode support throughout

### Typography
- **Font**: Inter (system font fallback)
- Mobile-first, responsive typography

### Components
Built with:
- Tailwind CSS utility classes
- Radix UI for accessible, unstyled primitives
- Custom components for restaurant cards, reviews, maps

## 🌍 Internationalization

The app fully supports:
- **English** (LTR)
- **Hebrew** (RTL)

All UI text is translatable. Language can be switched in Settings.

## 📂 Project Structure

```
pachu-app/
├── app/
│   ├── api/              # API routes
│   │   ├── chat/         # AI chat endpoint
│   │   ├── map-chat/     # Map AI chat endpoint
│   │   ├── feed/         # Feed endpoints
│   │   ├── restaurants/  # Restaurant data endpoints
│   │   ├── reviews/      # Review CRUD endpoints
│   │   ├── profile/      # Profile endpoints
│   │   └── users/        # User search/management
│   ├── auth/             # Authentication pages
│   ├── feed/             # Feed page
│   ├── map/              # Map view page
│   ├── chat/             # AI chat page
│   ├── wishlist/         # Wishlist page
│   ├── profile/          # Profile pages
│   ├── restaurant/       # Restaurant detail pages
│   ├── review/           # Review pages
│   ├── search/           # Search page
│   ├── notifications/    # Notifications page
│   ├── settings/         # Settings page
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Home page
│   └── globals.css       # Global styles
├── components/
│   ├── auth/             # Auth components
│   ├── feed/             # Feed components
│   ├── layout/           # Layout components
│   ├── map/              # Map & AI chat components
│   └── review/           # Review components
├── lib/
│   ├── supabase/         # Supabase clients
│   │   ├── client.ts     # Browser client
│   │   ├── server.ts     # Server client
│   │   └── middleware.ts # Auth middleware
│   └── utils.ts          # Utility functions
├── hooks/
│   └── use-user.ts       # User state hook
├── i18n/
│   └── request.ts        # i18n configuration
├── messages/
│   ├── en.json           # English translations
│   └── he.json           # Hebrew translations
├── database-migrations/  # SQL migration files
├── public/               # Static assets
├── middleware.ts         # Next.js middleware
├── next.config.ts        # Next.js configuration
├── tailwind.config.ts    # Tailwind configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies
```

## 🔑 Required API Keys

To run this application, you'll need:

1. **Supabase**: https://supabase.com
   - Create a project
   - Get the project URL and anon key

2. **OpenAI API**: https://platform.openai.com/api-keys
   - For AI chat recommendations

3. **Mapbox**: https://account.mapbox.com/
   - For interactive maps

4. **Google Places API**: https://console.cloud.google.com/
   - Enable "Places API" in your Google Cloud project
   - For restaurant data and search

## 📚 Documentation

- **Quick Start:** See `QUICK_START.md` for 5-minute setup guide
- **Setup Guide:** See `SETUP_REAL_DATA.md` for detailed setup instructions
- **Features Guide:** See `FRIENDS_AND_REVIEWS_GUIDE.md` for feature documentation
- **Database Schema:** See `DATABASE_SCHEMA.md` for complete database structure
- **Recent Changes:** See `CHANGES_SUMMARY.md` for latest updates

## 🚧 Future Enhancements

### Planned Features
- [ ] Expand to other categories (Hotels, Movies, Books, Professionals)
- [ ] Advanced AI personalization based on taste profile
- [ ] Group recommendations and planning
- [ ] Restaurant reservations integration
- [ ] Push notifications
- [ ] Block/report users
- [ ] Private profiles
- [ ] More social features (stories, highlights)
- [ ] Analytics dashboard
- [ ] Premium features

### Technical Improvements
- [ ] Performance optimization
- [ ] E2E testing with Playwright
- [ ] Unit tests
- [ ] CI/CD pipeline
- [ ] Docker containerization
- [ ] Production monitoring

## 🐛 Known Issues

Please check the GitHub issues page for current bugs and feature requests.

## 📦 Scripts

```bash
# Development
npm run dev          # Start development server

# Production
npm run build        # Build for production
npm start            # Start production server

# Linting
npm run lint         # Run ESLint
```

## 🤝 Contributing

This is a private project. If you have access and want to contribute:

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

Private and proprietary.

## 🎯 Vision

Pachu aims to become the ultimate platform for personalized recommendations by understanding your unique taste signature. Starting with restaurants, we'll expand to help you discover the perfect hotels, movies, books, and professionals - all through a combination of AI intelligence and social discovery.

---

## 🎯 Ready for Production

✅ **All core features implemented and tested:**
- User authentication and profiles
- Follow/unfollow functionality
- Write and manage reviews with photos
- Social feed showing friends' reviews
- Restaurant search and discovery
- AI-powered recommendations
- Location-based features
- Real-time notifications

🚀 **Next Steps:**
1. Run `99-remove-dummy-data.sql` to clean dummy data
2. Follow `QUICK_START.md` for 25-minute setup
3. Test with real accounts
4. Deploy to production!

---

**Current Version:** v1.0.0  
**Last Updated:** December 10, 2025  
**Status:** ✅ Ready for Production
