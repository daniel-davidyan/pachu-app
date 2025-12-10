# Pachu App - Development Guide

Quick reference guide for developers working on the Pachu application.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

Access the app at: http://localhost:3000

---

## 📁 Project Structure

```
pachu-app/
├── app/                    # Next.js pages and API routes
├── components/             # React components
│   ├── ui/                # Reusable UI primitives
│   ├── auth/              # Authentication components
│   ├── feed/              # Feed components
│   ├── layout/            # Layout components (TopBar, BottomNav)
│   ├── map/               # Map and location components
│   └── review/            # Review components
├── types/                 # TypeScript type definitions
├── constants/             # App-wide constants
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and libraries
│   ├── supabase/         # Supabase client configuration
│   └── utils.ts          # Utility functions (cn, etc.)
├── messages/             # i18n translations (en, he)
├── database-migrations/  # SQL migration files
└── public/               # Static assets
```

---

## 🎨 Using the Component Library

### UI Components

Import from `@/components/ui`:

```typescript
import { Button, Input, Card } from '@/components/ui';

// Button variants
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="danger">Danger</Button>

// Button sizes
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>

// Loading state
<Button isLoading>Processing...</Button>

// Input with label and error
<Input 
  label="Email" 
  error={errors.email}
  placeholder="your@email.com"
/>

// Card component
<Card hover padding="lg">
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content here</CardContent>
  <CardFooter>Footer actions</CardFooter>
</Card>
```

---

## 📝 Working with Types

All types are centralized in the `types/` folder. Import what you need:

```typescript
import type { 
  User, 
  Restaurant, 
  Review,
  RestaurantWithReviews,
  CreateReviewRequest 
} from '@/types';

// Use in components
interface RestaurantCardProps {
  restaurant: Restaurant;
  reviews: Review[];
  currentUser?: User;
}
```

---

## 🔢 Using Constants

Never use magic numbers or strings. Import from `@/constants`:

```typescript
import { 
  FEED_PAGE_SIZE,
  MAX_RATING,
  ROUTES,
  PRIMARY_COLOR,
  DEFAULT_LOCATION 
} from '@/constants';

// Routes
redirect(ROUTES.LOGIN);
navigate(ROUTES.RESTAURANT(restaurantId));

// App constants
const limit = FEED_PAGE_SIZE; // 5
if (rating > MAX_RATING) { ... }

// Colors
<div style={{ color: PRIMARY_COLOR }} />
```

---

## 🗺️ Navigation Routes

```typescript
import { ROUTES } from '@/constants';

// Public routes
ROUTES.HOME              // '/'
ROUTES.LOGIN             // '/auth/login'
ROUTES.SIGNUP            // '/auth/signup'

// Main app routes
ROUTES.FEED              // '/feed'
ROUTES.MAP               // '/map'
ROUTES.CHAT              // '/chat'
ROUTES.WISHLIST          // '/wishlist'
ROUTES.SEARCH            // '/search'

// Dynamic routes
ROUTES.PROFILE_VIEW(userId)      // '/profile/[id]'
ROUTES.RESTAURANT(restaurantId)  // '/restaurant/[id]'
ROUTES.REVIEW(reviewId)          // '/review/[id]'
```

---

## 🔌 API Routes

```typescript
import { API_ROUTES } from '@/constants';

// Fetch from API
const response = await fetch(API_ROUTES.FEED_FOLLOWING);
const restaurant = await fetch(API_ROUTES.RESTAURANT_BY_ID(id));

// Available API routes
API_ROUTES.FEED_FOLLOWING
API_ROUTES.FEED_NEARBY
API_ROUTES.RESTAURANTS_SEARCH
API_ROUTES.RESTAURANTS_NEARBY
API_ROUTES.REVIEWS
API_ROUTES.CHAT
API_ROUTES.MAP_CHAT
```

---

## 🗄️ Working with Supabase

### Client-side (Components)

```typescript
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Query database
const { data, error } = await supabase
  .from('restaurants')
  .select('*')
  .eq('id', restaurantId)
  .single();
```

### Server-side (API Routes, Server Components)

```typescript
import { createClient } from '@/lib/supabase/server';

const supabase = await createClient();

// Same API as client
const { data: { user } } = await supabase.auth.getUser();
```

---

## 🪝 Custom Hooks

```typescript
import { useUser } from '@/hooks';

function MyComponent() {
  const { user, loading } = useUser();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Not authenticated</div>;
  
  return <div>Hello {user.username}</div>;
}
```

---

## 🌐 Internationalization

The app supports English and Hebrew with automatic RTL support.

```typescript
// In Server Components
import { useTranslations } from 'next-intl';

function MyComponent() {
  const t = useTranslations();
  
  return <h1>{t('welcome')}</h1>;
}

// Add translations to messages/en.json and messages/he.json
```

---

## 🎨 Styling Guidelines

### Use Tailwind CSS

```typescript
// Standard Tailwind classes
<div className="flex items-center gap-4 p-4 rounded-lg">

// Use cn() utility for conditional classes
import { cn } from '@/lib/utils';

<div className={cn(
  'base-class',
  isActive && 'active-class',
  variant === 'primary' && 'primary-class'
)} />
```

### Color System

```typescript
// Primary color (brand)
text-[#C5459C]
bg-[#C5459C]
border-[#C5459C]

// Or use constants
import { PRIMARY_HEX } from '@/constants';
```

---

## 📊 Database Schema

Complete database schema is documented in `DATABASE_SCHEMA.md`.

### Main Tables

- `profiles` - User profiles
- `restaurants` - Restaurant/venue data
- `reviews` - User reviews
- `review_photos` - Review images
- `review_likes` - Like system
- `follows` - Social connections
- `wishlist` - Saved restaurants
- `notifications` - Activity feed
- `chat_conversations` - AI chat sessions
- `chat_messages` - Chat messages

### Common Queries

See `database-migrations/` folder for examples.

---

## 🧪 Testing

### Manual Testing

1. Start dev server: `npm run dev`
2. Test in browser at http://localhost:3000
3. Use browser DevTools for debugging

### Database Testing

Use dummy users from `database-migrations/04-feed-dummy-data-daniel-amit.sql`:
- daniel@example.com / password123
- amit@example.com / password123
- rotem@example.com / password123

---

## 🐛 Common Issues

### Supabase Connection Error
- Check `.env.local` has correct `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Type Errors
- Run `npm run build` to check for TypeScript errors
- Import types from `@/types` instead of defining locally

### Map Not Loading
- Verify `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local`
- Check browser console for errors

### AI Chat Not Working
- Verify `OPENAI_API_KEY` in `.env.local`
- Check API route `/api/chat` or `/api/map-chat`

---

## 🔐 Environment Variables

Create `.env.local` in the root directory:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token

# Google Places
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=your-google-api-key
```

---

## 📚 Additional Resources

- **Project Documentation**: `README.md`
- **Database Schema**: `DATABASE_SCHEMA.md`
- **Refactoring Summary**: `REFACTORING_SUMMARY.md`
- **Next.js Docs**: https://nextjs.org/docs
- **Supabase Docs**: https://supabase.com/docs
- **Tailwind CSS**: https://tailwindcss.com/docs

---

## 🤝 Contributing Guidelines

1. **Follow the folder structure** - Put files in the right place
2. **Use TypeScript** - Define types in `types/` folder
3. **Extract constants** - No magic numbers or strings
4. **Create reusable components** - Add to `components/ui/` if generic
5. **Add barrel exports** - Create `index.ts` for new folders
6. **Write clean code** - Use ESLint, format consistently
7. **Test your changes** - Manual testing at minimum
8. **Update documentation** - Keep this file updated

---

## 💡 Tips & Tricks

### VS Code Extensions (Recommended)
- ESLint
- Tailwind CSS IntelliSense
- PostCSS Language Support
- Prettier

### Keyboard Shortcuts
- `Ctrl/Cmd + P` - Quick file search
- `Ctrl/Cmd + Shift + F` - Search in files
- `F12` - Go to definition
- `Shift + F12` - Find all references

### Debugging
- Use `console.log()` liberally
- Check browser DevTools Network tab for API errors
- Use React DevTools for component inspection

---

**Happy Coding! 🚀**

