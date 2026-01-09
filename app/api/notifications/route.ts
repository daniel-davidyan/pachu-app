import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/notifications
 * Fetch user's notifications with actor info
 * Query params: ?limit=50&unreadOnly=false
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
    const limit = parseInt(searchParams.get('limit') || '50');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    // Build query
    let query = supabase
      .from('notifications')
      .select(`
        id,
        type,
        title,
        message,
        link,
        read,
        created_at,
        actor_id,
        reference_id,
        actor:profiles!notifications_actor_id_fkey (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by unread if requested
    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }

    // Get unread count
    const { count: unreadCount, error: countError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (countError) {
      console.error('Error counting unread notifications:', countError);
    }

    // Transform notifications to a cleaner format
    const formattedNotifications = notifications?.map(notification => {
      const actor = Array.isArray(notification.actor) 
        ? notification.actor[0] 
        : notification.actor;

      return {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        read: notification.read,
        createdAt: notification.created_at,
        referenceId: notification.reference_id,
        actor: actor ? {
          id: actor.id,
          username: actor.username,
          fullName: actor.full_name,
          avatarUrl: actor.avatar_url,
        } : null,
      };
    }) || [];

    return NextResponse.json({
      notifications: formattedNotifications,
      unreadCount: unreadCount || 0,
    });
  } catch (error) {
    console.error('Error in notifications API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
