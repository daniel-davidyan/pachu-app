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
    // Try both column names for compatibility
    let followingData = null;
    
    // Try with following_id first (standard)
    const { data: data1, error: error1 } = await supabase
      .from('follows')
      .select(`
        following_id,
        profiles:following_id (
          id,
          username,
          full_name,
          avatar_url,
          bio
        )
      `)
      .eq('follower_id', userId);

    followingData = data1;
    
    // If column doesn't exist, try with followed_id (legacy)
    if (error1 && error1.code === '42703') {
      const { data: data2 } = await supabase
        .from('follows')
        .select(`
          followed_id,
          profiles:followed_id (
            id,
            username,
            full_name,
            avatar_url,
            bio
          )
        `)
        .eq('follower_id', userId);
      followingData = data2;
    } else if (error1) {
      throw error1;
    }

    // Check which users the current user is following (for the follow button state)
    const { data: currentUserFollowing } = await supabase
      .from('follows')
      .select('following_id, followed_id')
      .eq('follower_id', user.id);

    const followingIds = new Set(
      currentUserFollowing?.map(f => f.following_id || f.followed_id) || []
    );

    // Format the response
    const following = (followingData || []).map((follow: any) => {
      const profile = follow.profiles;
      return {
        id: profile.id,
        username: profile.username,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        bio: profile.bio,
        isFollowing: followingIds.has(profile.id),
      };
    });

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
