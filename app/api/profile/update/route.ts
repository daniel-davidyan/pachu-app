import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { validateUsername } from '@/lib/username-validation';

/**
 * PATCH /api/profile/update
 * Update user profile (name, username, bio)
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { full_name, username, bio } = await request.json();

    // If username is being updated, validate it
    if (username !== undefined) {
      // Server-side validation
      const validation = validateUsername(username);
      if (!validation.isValid) {
        return NextResponse.json(
          { error: validation.error || 'Invalid username' },
          { status: 400 }
        );
      }

      // Use the sanitized (lowercase) version
      const sanitizedUsername = validation.sanitized || username.toLowerCase();

      // Check if username is already taken (case-insensitive)
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', sanitizedUsername)
        .neq('id', user.id)
        .maybeSingle();

      if (existingUser) {
        return NextResponse.json(
          { error: 'Username already taken' },
          { status: 400 }
        );
      }
    }

    // Update profile
    const updates: Record<string, string | null> = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (username !== undefined) {
      // Always store username in lowercase
      const validation = validateUsername(username);
      updates.username = validation.sanitized || username.toLowerCase();
    }
    if (bio !== undefined) updates.bio = bio;

    // Validate bio length
    if (bio && bio.length > 150) {
      return NextResponse.json(
        { error: 'Bio must be 150 characters or less' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      profile: data
    });
  } catch (error) {
    console.error('Error in profile update:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
