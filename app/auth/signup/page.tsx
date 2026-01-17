'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { validateUsername, sanitizeUsername } from '@/lib/username-validation';
import { Check, X, Loader2 } from 'lucide-react';

import Link from 'next/link';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Username validation state
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Debounced username check
  const checkUsernameAvailability = useCallback(async (usernameToCheck: string) => {
    if (!usernameToCheck || usernameToCheck.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    // First validate locally
    const validation = validateUsername(usernameToCheck);
    if (!validation.isValid) {
      setUsernameError(validation.error || 'Invalid username');
      setUsernameAvailable(false);
      return;
    }

    setCheckingUsername(true);
    try {
      const response = await fetch(`/api/users/check-username?username=${encodeURIComponent(usernameToCheck)}`);
      const data = await response.json();
      
      if (data.valid && data.available) {
        setUsernameError(null);
        setUsernameAvailable(true);
      } else {
        setUsernameError(data.error || 'Username not available');
        setUsernameAvailable(false);
      }
    } catch (err) {
      console.error('Error checking username:', err);
      // Don't show error for network issues, just clear the state
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  }, []);

  // Debounce username check
  useEffect(() => {
    const trimmed = username.trim();
    
    if (!trimmed) {
      setUsernameError(null);
      setUsernameAvailable(null);
      return;
    }

    // Quick local validation first
    const validation = validateUsername(trimmed);
    if (!validation.isValid) {
      setUsernameError(validation.error || 'Invalid username');
      setUsernameAvailable(false);
      return;
    }

    // Clear previous error and set checking
    setUsernameError(null);
    setUsernameAvailable(null);
    
    const timeoutId = setTimeout(() => {
      checkUsernameAvailability(trimmed);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [username, checkUsernameAvailability]);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Auto-sanitize as user types (lowercase, no spaces)
    const sanitized = value.toLowerCase().replace(/\s/g, '_');
    setUsername(sanitized);
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Final validation before submit
    const validation = validateUsername(username);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid username');
      return;
    }

    if (usernameAvailable === false) {
      setError('Please choose a different username');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      // Use the sanitized username
      const sanitizedUsername = validation.sanitized || sanitizeUsername(username);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName,
            username: sanitizedUsername,
          },
        },
      });

      if (error) throw error;
      
      // Check if email confirmation is required
      if (data?.user && !data.session) {
        // Email confirmation required
        setSuccess(true);
        setError('');
        // Redirect to login page after 3 seconds with email pre-filled
        setTimeout(() => {
          router.push(`/auth/login?email=${encodeURIComponent(email)}`);
        }, 3000);
      } else if (data?.session) {
        // No email confirmation needed (auto-confirm is enabled)
        setSuccess(true);
        setTimeout(() => {
          router.push('/agent');
          router.refresh();
        }, 1500);
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignUp = async (provider: 'google') => {
    try {
      // Use current origin for redirect (works for both localhost and production)
      const redirectUrl = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      setError(error.message || 'An error occurred');
    }
  };

  const isFormValid = fullName && username && email && password && usernameAvailable !== false;

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-8 bg-[#f9e7ff]">
      <div className="w-full max-w-[380px]">
        {/* Logo */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-black bg-gradient-to-r from-[#E91E8C] to-[#A855C7] bg-clip-text text-transparent mb-2">
            Pachu
          </h1>
          <p className="text-lg font-medium bg-gradient-to-r from-[#E91E8C] to-[#A855C7] bg-clip-text text-transparent">The Taste Signature</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-3 p-3 bg-white border border-red-200 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-6 bg-white border border-green-200 text-green-600 rounded-lg text-center">
            <div className="text-4xl mb-4">✅</div>
            <div className="font-bold text-lg mb-2">Account created successfully!</div>
            <div className="text-sm text-gray-600 mb-4">
              Please check your email to confirm your account. Click the link in the email to complete registration.
            </div>
            <div className="text-xs text-gray-500">
              Redirecting to login page...
            </div>
          </div>
        )}

        {/* Sign Up Form - Only show if not successful */}
        {!success && (
        <form onSubmit={handleEmailSignUp} className="space-y-3">
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-[#C5459C] transition-all text-sm placeholder:text-gray-400"
            placeholder="Full Name"
            required
            disabled={loading}
          />

          {/* Username field with validation feedback */}
          <div className="relative">
            <input
              id="username"
              type="text"
              value={username}
              onChange={handleUsernameChange}
              className={`w-full px-4 py-3 pr-10 bg-white border rounded-lg focus:outline-none transition-all text-sm placeholder:text-gray-400 ${
                usernameError 
                  ? 'border-red-400 focus:border-red-500' 
                  : usernameAvailable 
                    ? 'border-green-400 focus:border-green-500' 
                    : 'border-gray-200 focus:border-[#C5459C]'
              }`}
              placeholder="Username"
              required
              disabled={loading}
              autoComplete="off"
              autoCapitalize="off"
            />
            {/* Status indicator */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {checkingUsername && (
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              )}
              {!checkingUsername && usernameAvailable === true && (
                <Check className="w-5 h-5 text-green-500" />
              )}
              {!checkingUsername && usernameAvailable === false && (
                <X className="w-5 h-5 text-red-500" />
              )}
            </div>
          </div>
          
          {/* Username validation hint */}
          {username && (
            <div className={`text-xs px-1 -mt-1 ${usernameError ? 'text-red-500' : usernameAvailable ? 'text-green-600' : 'text-gray-500'}`}>
              {usernameError || (usernameAvailable ? 'Username is available!' : 'Letters, numbers, underscores, and periods only')}
            </div>
          )}

          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-[#C5459C] transition-all text-sm placeholder:text-gray-400"
            placeholder="Email"
            required
            disabled={loading}
          />

          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-[#C5459C] transition-all text-sm placeholder:text-gray-400"
            placeholder="Password"
            required
            disabled={loading}
            minLength={6}
          />

          <button
            type="submit"
            disabled={loading || !isFormValid}
            className="w-full py-3 rounded-lg font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm active:scale-[0.98]"
            style={{ backgroundColor: '#C5459C' }}
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>
        )}

        {/* Divider - Only show if not successful */}
        {!success && (
        <>
        <div className="my-8 flex items-center">
          <div className="flex-1 border-t border-gray-300"></div>
          <span className="px-4 text-sm text-gray-500 font-medium">OR</span>
          <div className="flex-1 border-t border-gray-300"></div>
        </div>

        {/* Google Sign Up */}
        <button
          onClick={() => handleOAuthSignUp('google')}
          className="w-full h-[52px] bg-white border border-gray-200 rounded-lg font-semibold hover:bg-gray-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-gray-700 text-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span>Log in with Google</span>
        </button>

        {/* Log In Link */}
        <div className="mt-3 text-center border border-gray-300 rounded-lg h-[52px] bg-white flex items-center justify-center">
          <p className="text-sm text-gray-700">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-[#C5459C] font-bold hover:text-[#A855C7] transition-colors">
              Log In
            </Link>
          </p>
        </div>
        </>
        )}

        {/* Privacy Policy & Terms */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <Link href="/privacy" className="hover:text-[#C5459C] transition-colors underline">
            Privacy Policy
          </Link>
          {' • '}
          <Link href="/terms" className="hover:text-[#C5459C] transition-colors underline">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
