import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { validateUsername } from '@/lib/username-validation';

/**
 * GET /api/users/check-username?username=xxx&currentUserId=xxx
 * Check if a username is available and valid
 * currentUserId is optional - if provided, allows the current user's own username
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const username = searchParams.get('username');
    const currentUserId = searchParams.get('currentUserId');

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required', available: false },
        { status: 400 }
      );
    }

    // First validate the username format
    const validation = validateUsername(username);
    
    if (!validation.isValid) {
      return NextResponse.json({
        available: false,
        valid: false,
        error: validation.error,
      });
    }

    const sanitizedUsername = validation.sanitized!;
    
    // Check if username is already taken
    const supabase = await createClient();
    
    let query = supabase
      .from('profiles')
      .select('id')
      .ilike('username', sanitizedUsername);
    
    // If currentUserId provided, exclude that user from the check
    if (currentUserId) {
      query = query.neq('id', currentUserId);
    }
    
    const { data: existingUser, error } = await query.maybeSingle();

    if (error) {
      console.error('Error checking username:', error);
      return NextResponse.json(
        { error: 'Failed to check username availability', available: false },
        { status: 500 }
      );
    }

    const isAvailable = !existingUser;

    return NextResponse.json({
      available: isAvailable,
      valid: true,
      sanitized: sanitizedUsername,
      error: isAvailable ? null : 'This username is already taken',
    });
  } catch (error) {
    console.error('Error in check-username API:', error);
    return NextResponse.json(
      { error: 'Internal server error', available: false },
      { status: 500 }
    );
  }
}
