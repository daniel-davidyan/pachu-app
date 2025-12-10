import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');

    let profilesQuery = supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .limit(50); // Increased limit to show more users

    // If there's a search query, filter by it
    if (query && query.trim().length > 0) {
      profilesQuery = profilesQuery.or(`username.ilike.%${query}%,full_name.ilike.%${query}%`);
    }

    const { data: profiles, error } = await profilesQuery;

    if (error) {
      console.error('Error searching users:', error);
      return NextResponse.json(
        { error: 'Failed to search users' },
        { status: 500 }
      );
    }

    return NextResponse.json({ users: profiles || [] });
  } catch (error) {
    console.error('Error in user search API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

