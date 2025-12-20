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
    let currentUserFollowing: any[] = [];
    
    // Try with following_id first (standard)
    const { data: followData1, error: followError1 } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);

    if (followError1 && followError1.code === '42703') {
      // Try legacy column name
      const { data: followData2 } = await supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', user.id);
      currentUserFollowing = followData2 || [];
    } else if (followError1) {
      console.error('Error fetching current user following:', followError1);
    } else {
      currentUserFollowing = followData1 || [];
    }

    const followingIds = new Set(
      currentUserFollowing.map(f => f.following_id || f.followed_id).filter(Boolean)
    );
    
    console.log('[FOLLOWERS API] Current user following count:', followingIds.size);
    console.log('[FOLLOWERS API] Following IDs:', Array.from(followingIds));

    // Format the response
    const followers = (profilesData || []).map((profile: any) => ({
      id: profile.id,
      username: profile.username,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      isFollowing: followingIds.has(profile.id),
    }));
    
    console.log('[FOLLOWERS API] Returning', followers.length, 'followers');
    console.log('[FOLLOWERS API] Sample follower:', followers[0]);

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
