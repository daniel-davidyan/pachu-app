'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const supabase = createClient();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;
      
      setSuccess(true);
    } catch (error: any) {
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-8 overflow-y-auto relative" style={{ background: 'linear-gradient(to bottom right, #C5459C, #C5459C, #932B74)' }}>
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full translate-y-32 -translate-x-32 blur-3xl"></div>
      
      <div className="w-full max-w-[400px] relative z-10 my-auto">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-5xl sm:text-6xl font-black text-white mb-2 drop-shadow-lg">
            Pachu
          </h1>
          <p className="text-sm text-white/90 font-medium">Reset Your Password</p>
        </div>

        {/* Reset Form */}
        <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-2xl">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 text-center">Forgot Password? 🔑</h2>
          <p className="text-xs sm:text-sm text-gray-600 mb-6 sm:mb-8 text-center">
            Enter your email and we'll send you a reset link
          </p>

          {error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-3 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs">
              ✅ Check your email for a password reset link!
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-3 sm:space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm bg-gray-50 focus:bg-white"
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || success}
              style={{ backgroundColor: '#C5459C', borderColor: '#C5459C' }}
              className="w-full py-2.5 sm:py-3 rounded-xl font-semibold text-white hover:opacity-90 hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm mt-3 border-2"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-4 sm:mt-5 text-center">
            <p className="text-gray-600 text-xs">
              Remember your password?{' '}
              <Link href="/auth/login" className="text-primary font-bold hover:text-primary-700 transition-colors">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

