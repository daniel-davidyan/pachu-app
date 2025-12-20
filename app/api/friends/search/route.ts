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

    // Get all users that the current user follows
    const { data: followsData, error: followsError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);

    if (followsError) throw followsError;

    const followingIds = followsData?.map(f => f.following_id) || [];

    if (followingIds.length === 0) {
      return NextResponse.json({ friends: [] });
    }

    // Search for friends (people the user follows)
    let profileQuery = supabase
      .from('profiles')
      .select('id, username, full_name')
      .in('id', followingIds)
      .order('username', { ascending: true })
      .limit(20);

    // If there's a search query, filter by username
    if (query) {
      profileQuery = profileQuery.ilike('username', `%${query}%`);
    }

    const { data: profiles, error: profilesError } = await profileQuery;

    if (profilesError) throw profilesError;

    const formattedFriends = profiles?.map(profile => ({
      id: profile.id,
      username: profile.username,
      fullName: profile.full_name || profile.username,
    })) || [];

    return NextResponse.json({ friends: formattedFriends });
  } catch (error) {
    console.error('Error searching friends:', error);
    return NextResponse.json({ error: 'Failed to search friends' }, { status: 500 });
  }
}

