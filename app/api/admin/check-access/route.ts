import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/check-access
 * 
 * Check if current user has admin/developer access
 * Only whitelisted emails can access developer features
 */

const WHITELISTED_EMAILS = [
  'amitchimya@pachu.app',
  'danieldavidyan@pachu.app',
];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ hasAccess: false });
    }

    const hasAccess = WHITELISTED_EMAILS.includes(user.email.toLowerCase());

    return NextResponse.json({ 
      hasAccess,
      email: hasAccess ? user.email : undefined,
    });

  } catch (error) {
    console.error('Check access error:', error);
    return NextResponse.json({ hasAccess: false });
  }
}
