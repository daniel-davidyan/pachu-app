import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const error_description = requestUrl.searchParams.get('error_description');
  const origin = requestUrl.origin;

  console.log('[Auth Callback] Starting...', { 
    hasCode: !!code, 
    error, 
    error_description 
  });

  // Handle OAuth errors
  if (error) {
    console.error('[Auth Callback] OAuth error:', error, error_description);
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error_description || error)}`);
  }

  if (code) {
    try {
      const supabase = await createClient();
      
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      
      if (exchangeError) {
        console.error('[Auth Callback] Exchange error:', exchangeError.message);
        return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(exchangeError.message)}`);
      }
      
      console.log('[Auth Callback] Success!', { 
        userId: data.user?.id,
        email: data.user?.email 
      });
      
      // Verify user was created
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[Auth Callback] Verified user:', { 
        userId: user?.id,
        email: user?.email 
      });
      
    } catch (err) {
      console.error('[Auth Callback] Unexpected error:', err);
      return NextResponse.redirect(`${origin}/auth/login?error=unexpected_error`);
    }
  } else {
    console.warn('[Auth Callback] No code provided');
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(`${origin}/agent`);
}

