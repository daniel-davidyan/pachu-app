import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const publicPaths = ['/auth/login', '/auth/signup', '/auth/forgot-password', '/auth/callback', '/privacy', '/terms'];
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path));

  // Redirect to login if not authenticated and accessing protected route
  if (!user && !isPublicPath) {
    const redirectUrl = new URL('/auth/login', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect to feed if already logged in and trying to access auth pages
  if (user && (request.nextUrl.pathname === '/auth/login' || request.nextUrl.pathname === '/auth/signup')) {
    const redirectUrl = new URL('/feed', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.webp).*)'
  ]
};

