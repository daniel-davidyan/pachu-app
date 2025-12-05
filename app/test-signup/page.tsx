'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function TestSignup() {
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('Test123456!');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setLoading(true);
    setStatus('Creating user...');
    
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setStatus(`❌ Error: ${error.message}`);
      } else if (data.user) {
        setStatus(`✅ User created successfully!
        
User ID: ${data.user.id}
Email: ${data.user.email}
Email confirmed: ${data.user.email_confirmed_at ? 'Yes' : 'No - check your email'}

${!data.user.email_confirmed_at ? 'You may need to confirm your email, or disable email confirmation in Supabase settings.' : ''}

Now try logging in at /auth/login with:
Email: ${email}
Password: ${password}`);
      } else {
        setStatus('⚠️ User might be created but session not returned. Check Supabase dashboard.');
      }
    } catch (error: any) {
      setStatus(`❌ Unexpected error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-6">Create Test User</h1>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
              disabled={loading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
              disabled={loading}
            />
          </div>
          
          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Test User'}
          </button>
        </div>
        
        {status && (
          <div className={`p-4 rounded-lg whitespace-pre-line ${
            status.includes('✅') ? 'bg-green-100 text-green-800' :
            status.includes('⚠️') ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {status}
          </div>
        )}
        
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold mb-2">Troubleshooting:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>If you get "Email not confirmed" error when logging in, disable email confirmation in Supabase</li>
            <li>Go to: Authentication → Providers → Email → Turn OFF "Confirm email"</li>
            <li>After creating user, try logging in at <a href="/auth/login" className="text-blue-600 underline">/auth/login</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

