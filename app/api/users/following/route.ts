import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/users/following?userId=xxx
 * Get list of users that this user is following
 */
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || user.id;

    // Get following - people this user follows
    let followingIds: string[] = [];
    
    // Try with following_id first (standard)
    const { data: followsData, error: followsError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);

    if (followsError && followsError.code === '42703') {
      // Try legacy column name
      const { data: followsData2 } = await supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', userId);
      followingIds = followsData2?.map(f => f.followed_id) || [];
    } else if (followsError) {
      console.error('Error fetching follows:', followsError);
      throw followsError;
    } else {
      followingIds = followsData?.map(f => f.following_id) || [];
    }

    // Get profile details for all following
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, bio')
      .in('id', followingIds.length > 0 ? followingIds : ['00000000-0000-0000-0000-000000000000']); // Use dummy ID if empty

    // Check which users the current user is following (for the follow button state)
    const { data: currentUserFollowing } = await supabase
      .from('follows')
      .select('following_id, followed_id')
      .eq('follower_id', user.id);

    const currentFollowingIds = new Set(
      currentUserFollowing?.map(f => f.following_id || f.followed_id) || []
    );

    // Format the response
    const following = (profilesData || []).map((profile: any) => ({
      id: profile.id,
      username: profile.username,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      isFollowing: currentFollowingIds.has(profile.id),
    }));

    return NextResponse.json({ 
      following,
      count: following.length
    });
  } catch (error) {
    console.error('Error fetching following:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
