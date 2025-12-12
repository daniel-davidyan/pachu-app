import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/users/followers?userId=xxx
 * Get list of followers for a user
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

    // Get followers - people who follow this user
    // Try both column names for compatibility
    let followersData = null;
    
    // Try with following_id first (standard)
    const { data: data1, error: error1 } = await supabase
      .from('follows')
      .select(`
        follower_id,
        profiles:follower_id (
          id,
          username,
          full_name,
          avatar_url,
          bio
        )
      `)
      .eq('following_id', userId);

    followersData = data1;
    
    // If column doesn't exist, try with followed_id (legacy)
    if (error1 && error1.code === '42703') {
      const { data: data2 } = await supabase
        .from('follows')
        .select(`
          follower_id,
          profiles:follower_id (
            id,
            username,
            full_name,
            avatar_url,
            bio
          )
        `)
        .eq('followed_id', userId);
      followersData = data2;
    } else if (error1) {
      throw error1;
    }

    // Check which users the current user is following
    const { data: currentUserFollowing } = await supabase
      .from('follows')
      .select('following_id, followed_id')
      .eq('follower_id', user.id);

    const followingIds = new Set(
      currentUserFollowing?.map(f => f.following_id || f.followed_id) || []
    );

    // Format the response
    const followers = (followersData || []).map((follow: any) => ({
      id: follow.profiles.id,
      username: follow.profiles.username,
      full_name: follow.profiles.full_name,
      avatar_url: follow.profiles.avatar_url,
      bio: follow.profiles.bio,
      isFollowing: followingIds.has(follow.profiles.id),
    }));

    return NextResponse.json({ 
      followers,
      count: followers.length
    });
  } catch (error) {
    console.error('Error fetching followers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
