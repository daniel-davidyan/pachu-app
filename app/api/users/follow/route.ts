import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/users/follow
 * Follow or unfollow a user
 */
export async function POST(request: NextRequest) {
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

    const { userId, action } = await request.json();

    if (!userId || !action || !['follow', 'unfollow'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid request. Required: userId and action (follow/unfollow)' },
        { status: 400 }
      );
    }

    // Prevent self-following
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'You cannot follow yourself' },
        { status: 400 }
      );
    }

    // Check if target user exists
    const { data: targetUser, error: targetError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (targetError || !targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (action === 'follow') {
      // Follow user - try both column names for compatibility
      let followError;
      
      // Try with following_id first (standard)
      const { error: error1 } = await supabase
        .from('follows')
        .insert({
          follower_id: user.id,
          following_id: userId,
        });
      
      followError = error1;
      
      // If column doesn't exist, try with followed_id (legacy)
      if (error1 && error1.code === '42703') {
        const { error: error2 } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            followed_id: userId,
          });
        followError = error2;
      }

      if (followError) {
        // Check if already following
        if (followError.code === '23505') { // Unique constraint violation
          return NextResponse.json(
            { error: 'Already following this user' },
            { status: 400 }
          );
        }
        console.error('Follow error:', followError);
        throw followError;
      }

      // Optional: Create notification for the followed user
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: userId,
        type: 'follow',
        title: 'New Follower',
        message: `${user.user_metadata?.full_name || user.email} started following you`,
        actor_id: user.id,
        link: `/profile/${user.id}`,
        read: false,
      });
      
      if (notifError) {
        console.error('Failed to create notification:', notifError);
        // Don't fail the whole request if notification fails
      }

      return NextResponse.json({ 
        success: true,
        message: 'Successfully followed user',
        isFollowing: true
      });
    } else {
      // Unfollow user - try both column names for compatibility
      let unfollowError;
      
      // Try with following_id first (standard)
      const { error: error1, count: count1 } = await supabase
        .from('follows')
        .delete({ count: 'exact' })
        .eq('follower_id', user.id)
        .eq('following_id', userId);
      
      unfollowError = error1;
      
      // If column doesn't exist or no rows deleted, try with followed_id (legacy)
      if ((error1 && error1.code === '42703') || count1 === 0) {
        const { error: error2 } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('followed_id', userId);
        unfollowError = error2;
      }

      if (unfollowError) {
        console.error('Unfollow error:', unfollowError);
        throw unfollowError;
      }

      return NextResponse.json({ 
        success: true,
        message: 'Successfully unfollowed user',
        isFollowing: false
      });
    }
  } catch (error) {
    console.error('Error in follow/unfollow:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: errorMessage,
        hint: 'Check Supabase logs for more details'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/users/follow?userId=xxx
 * Check if current user is following another user
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
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    // Check if following - try both column names for compatibility
    let data = null;
    
    // Try with following_id first (standard)
    const { data: data1, error: error1 } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', userId)
      .maybeSingle();

    data = data1;
    
    // If column doesn't exist or not found, try with followed_id (legacy)
    if (!data1 && error1?.code === '42703') {
      const { data: data2 } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('followed_id', userId)
        .maybeSingle();
      data = data2;
    } else if (error1 && error1.code !== 'PGRST116') {
      throw error1;
    }

    return NextResponse.json({ 
      isFollowing: !!data
    });
  } catch (error) {
    console.error('Error checking follow status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

