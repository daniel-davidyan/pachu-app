import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/reviews/[reviewId]/likes - Get users who liked a review
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const supabase = await createClient();
    const { reviewId } = await params;

    // Get current user to check follow status
    const { data: { user } } = await supabase.auth.getUser();

    // Get all users who liked this review
    const { data: likes, error } = await supabase
      .from('review_likes')
      .select('user_id, created_at')
      .eq('review_id', reviewId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const userIds = likes?.map(l => l.user_id) || [];

    if (userIds.length === 0) {
      return NextResponse.json({ users: [] });
    }

    // Get user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', userIds);

    if (profilesError) throw profilesError;

    // Get follow status for each user if logged in
    const followStatuses: { [key: string]: boolean } = {};
    if (user) {
      const { data: followData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .in('following_id', userIds);

      followData?.forEach(f => {
        followStatuses[f.following_id] = true;
      });
    }

    // Format users with follow status
    const formattedUsers = profiles?.map(profile => ({
      id: profile.id,
      username: profile.username,
      fullName: profile.full_name || profile.username,
      avatarUrl: profile.avatar_url,
      isFollowing: followStatuses[profile.id] || false,
      isCurrentUser: user ? profile.id === user.id : false,
    })) || [];

    return NextResponse.json({ users: formattedUsers });
  } catch (error) {
    console.error('Error fetching likes:', error);
    return NextResponse.json({ error: 'Failed to fetch likes' }, { status: 500 });
  }
}

