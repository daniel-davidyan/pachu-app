import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * PATCH /api/notifications/read
 * Mark all notifications as read for the current user
 * Called automatically when NotificationsPane opens (TikTok/Instagram style)
 */
export async function PATCH() {
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

    // Mark all unread notifications as read
    const { error, count } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
      .select('id', { count: 'exact' });

    if (error) {
      console.error('Error marking notifications as read:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      markedAsRead: count || 0,
    });
  } catch (error) {
    console.error('Error in mark notifications read API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
