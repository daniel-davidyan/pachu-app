import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/reviews/[reviewId]/like - Add like
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const supabase = await createClient();
    const { reviewId } = await params;

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Add like (will fail if already exists due to unique constraint)
    const { data, error } = await supabase
      .from('review_likes')
      .insert({
        review_id: reviewId,
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
    console.error('Error liking review:', error);
    return NextResponse.json({ error: 'Failed to like review' }, { status: 500 });
  }
}

// DELETE /api/reviews/[reviewId]/like - Remove like
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const supabase = await createClient();
    const { reviewId } = await params;

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Remove like
    const { error } = await supabase
      .from('review_likes')
      .delete()
      .eq('review_id', reviewId)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unliking review:', error);
    return NextResponse.json({ error: 'Failed to unlike review' }, { status: 500 });
  }
}

