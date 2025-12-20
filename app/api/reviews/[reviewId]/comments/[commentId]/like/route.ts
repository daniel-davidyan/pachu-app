import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/reviews/[reviewId]/comments/[commentId]/like - Add like to a comment
export async function POST(
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

    // Add like (will fail if already exists due to unique constraint)
    const { data, error } = await supabase
      .from('comment_likes')
      .insert({
        comment_id: commentId,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      // If duplicate, return success anyway
      if (error.code === '23505') {
        return NextResponse.json({ success: true, alreadyLiked: true });
      }
      throw error;
    }

    return NextResponse.json({ success: true, like: data });
  } catch (error) {
    console.error('Error liking comment:', error);
    return NextResponse.json({ error: 'Failed to like comment' }, { status: 500 });
  }
}

// DELETE /api/reviews/[reviewId]/comments/[commentId]/like - Remove like from a comment
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

    // Remove like
    const { error } = await supabase
      .from('comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unliking comment:', error);
    return NextResponse.json({ error: 'Failed to unlike comment' }, { status: 500 });
  }
}

