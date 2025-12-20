import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// DELETE /api/reviews/[reviewId]/comments/[commentId] - Delete a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string; commentId: string }> }
) {
  try {
    const supabase = await createClient();
    const { commentId } = await params;

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete comment (RLS will ensure user owns it)
    const { error } = await supabase
      .from('review_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}

// PATCH /api/reviews/[reviewId]/comments/[commentId] - Update a comment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string; commentId: string }> }
) {
  try {
    const supabase = await createClient();
    const { commentId } = await params;

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 });
    }

    // Update comment
    const { data: comment, error } = await supabase
      .from('review_comments')
      .update({ content: content.trim() })
      .eq('id', commentId)
      .eq('user_id', user.id)
      .select(`
        id,
        content,
        created_at,
        updated_at,
        user:profiles!review_comments_user_id_fkey (
          id,
          username,
          full_name,
          avatar_url
        ),
        mentions:comment_mentions (
          mentioned_user:profiles!comment_mentions_mentioned_user_id_fkey (
            id,
            username,
            full_name
          )
        )
      `)
      .single();

    if (error) throw error;

    const formattedComment = {
      id: comment.id,
      content: comment.content,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      user: {
        id: comment.user.id,
        username: comment.user.username,
        fullName: comment.user.full_name,
        avatarUrl: comment.user.avatar_url,
      },
      mentions: comment.mentions?.map((m: any) => ({
        id: m.mentioned_user.id,
        username: m.mentioned_user.username,
        fullName: m.mentioned_user.full_name,
      })) || [],
    };

    return NextResponse.json({ comment: formattedComment });
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
  }
}

