import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/friends/search - Search friends for mentions
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Search for friends (people the user follows)
    const { data: friends, error } = await supabase
      .from('follows')
      .select(`
        following:profiles!follows_following_id_fkey (
          id,
          username,
          full_name
        )
      `)
      .eq('follower_id', user.id)
      .ilike('profiles.username', `%${query}%`)
      .limit(10);

    if (error) throw error;

    const formattedFriends = friends?.map(f => ({
      id: f.following.id,
      username: f.following.username,
      fullName: f.following.full_name,
    })) || [];

    return NextResponse.json({ friends: formattedFriends });
  } catch (error) {
    console.error('Error searching friends:', error);
    return NextResponse.json({ error: 'Failed to search friends' }, { status: 500 });
  }
}

