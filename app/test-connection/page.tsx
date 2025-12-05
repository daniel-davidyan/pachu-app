'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ConnectionDetails {
  supabaseUrl?: string;
  hasAnonKey?: string;
  testingConnection?: string;
  healthCheck?: string;
  possibleCause?: string;
  session?: string;
  sessionError?: string;
  user?: string;
  userError?: string;
  profilesTable?: string;
  error?: string;
  stack?: string;
}

export default function TestConnection() {
  const [status, setStatus] = useState<string>('Testing...');
  const [details, setDetails] = useState<ConnectionDetails | null>(null);

  useEffect(() => {
    const testConnection = async () => {
      try {
        const supabase = createClient();
        
        // Test 1: Check if Supabase client is created
        if (!supabase) {
          setStatus('❌ Failed to create Supabase client');
          return;
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        setDetails({
          supabaseUrl,
          hasAnonKey: hasAnonKey ? '✓ Anon key present' : '✗ Missing anon key',
          testingConnection: '⏳ Testing connection...',
        });

        // Test 2: Direct fetch to Supabase health endpoint
        try {
          const healthCheck = await fetch(`${supabaseUrl}/rest/v1/`, {
            method: 'GET',
            headers: {
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            },
          });
          
          setDetails(prev => ({
            ...prev,
            healthCheck: healthCheck.ok ? `✓ Supabase reachable (${healthCheck.status})` : `✗ Supabase returned ${healthCheck.status}`,
            testingConnection: '⏳ Testing auth...',
          }));
        } catch (fetchError: any) {
          setDetails(prev => ({
            ...prev,
            healthCheck: `✗ Cannot reach Supabase: ${fetchError.message}`,
            possibleCause: 'Network error, CORS, or Supabase project is paused',
          }));
          setStatus('❌ Cannot connect to Supabase! Check project status.');
          return;
        }
        
        // Test 3: Try to get session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        // Test 4: Try to get user
        const { data: userData, error: userError } = await supabase.auth.getUser();
        
        // Test 5: Check if tables exist (try to query profiles)
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('count')
          .limit(1);
        
        setDetails({
          supabaseUrl,
          hasAnonKey: hasAnonKey ? '✓ Anon key present' : '✗ Missing anon key',
          healthCheck: '✓ Supabase reachable',
          session: sessionData.session ? '✓ Session exists' : '✗ No session',
          sessionError: sessionError?.message || 'None',
          user: userData.user ? `✓ User: ${userData.user.email}` : '✗ No user',
          userError: userError?.message || 'None',
          profilesTable: profilesError ? `✗ ${profilesError.message}` : '✓ Profiles table exists',
        });
        
        if (profilesError && profilesError.message.includes('relation')) {
          setStatus('❌ Database tables not created yet!');
        } else if (!sessionData.session) {
          setStatus('⚠️ Not logged in (this is OK for testing)');
        } else {
          setStatus('✓ All tests passed!');
        }
      } catch (error: any) {
        setStatus(`❌ Error: ${error.message}`);
        setDetails({ error: error.toString(), stack: error.stack });
      }
    };
    
    testConnection();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-6">Supabase Connection Test</h1>
        
        <div className="mb-6">
          <div className="text-lg font-semibold mb-2">Status:</div>
          <div className={`p-4 rounded-lg ${
            status.includes('✓') ? 'bg-green-100 text-green-800' :
            status.includes('⚠️') ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {status}
          </div>
        </div>
        
        {details && (
          <div className="space-y-2">
            <div className="text-lg font-semibold mb-3">Details:</div>
            {Object.entries(details).map(([key, value]) => (
              <div key={key} className="flex gap-2 p-2 bg-gray-50 rounded">
                <span className="font-mono text-sm text-gray-600">{key}:</span>
                <span className="font-mono text-sm">{String(value)}</span>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold mb-2">Next Steps:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>If tables don't exist: Run DATABASE_SCHEMA.md SQL in Supabase</li>
            <li>If not logged in: Create a test user in Supabase Dashboard</li>
            <li>Then try logging in at <a href="/auth/login" className="text-blue-600 underline">/auth/login</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

