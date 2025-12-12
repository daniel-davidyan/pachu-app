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
    let followerIds: string[] = [];
    
    // Try with following_id first (standard)
    const { data: followsData, error: followsError } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', userId);

    if (followsError && followsError.code === '42703') {
      // Try legacy column name
      const { data: followsData2 } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('followed_id', userId);
      followerIds = followsData2?.map(f => f.follower_id) || [];
    } else if (followsError) {
      console.error('Error fetching follows:', followsError);
      throw followsError;
    } else {
      followerIds = followsData?.map(f => f.follower_id) || [];
    }

    // Get profile details for all followers
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, bio')
      .in('id', followerIds.length > 0 ? followerIds : ['00000000-0000-0000-0000-000000000000']); // Use dummy ID if empty

    // Check which users the current user is following
    const { data: currentUserFollowing } = await supabase
      .from('follows')
      .select('following_id, followed_id')
      .eq('follower_id', user.id);

    const followingIds = new Set(
      currentUserFollowing?.map(f => f.following_id || f.followed_id) || []
    );

    // Format the response
    const followers = (profilesData || []).map((profile: any) => ({
      id: profile.id,
      username: profile.username,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      isFollowing: followingIds.has(profile.id),
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
