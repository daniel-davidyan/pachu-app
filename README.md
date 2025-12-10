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

#### Social Feed
- Discover restaurant reviews from friends
- View nearby restaurant reviews
- Interactive review cards with photos
- Like and comment on reviews
- Following/follower system
- Real-time feed updates

#### Interactive Map View
- Mapbox integration with restaurant markers
- Click markers to see restaurant details
- AI-powered chat assistant for recommendations
- Location-based restaurant discovery
- Beautiful restaurant detail cards
- Photo galleries for restaurants

#### Reviews & Ratings
- Create reviews with ratings (1-5 stars)
- Upload multiple photos per review
- View friends' reviews for each restaurant
- Full-screen photo viewer
- Review editing and management

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

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Execute the migration files in `database-migrations/` folder in order:
   - `02-feed-functions.sql`
   - `03-feed-following-dummy-data.sql`
   - `04-feed-dummy-data-daniel-amit.sql`
   - `05-add-review-photos.sql`

This will create all necessary tables, functions, and RLS policies.

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

## 🚧 Future Enhancements

### Planned Features
- [ ] Expand to other categories (Hotels, Movies, Books, Professionals)
- [ ] Advanced AI personalization based on taste profile
- [ ] Group recommendations and planning
- [ ] Restaurant reservations integration
- [ ] Push notifications
- [ ] Progressive Web App (PWA) capabilities
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

**Current Version:** v0.1.0  
**Last Updated:** December 2025  
**Status:** Active Development
