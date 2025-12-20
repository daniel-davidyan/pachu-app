import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/reviews/[reviewId]/comments - Get comments for a review
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const supabase = await createClient();
    const { reviewId } = await params;

    // Get current user to check for likes
    const { data: { user } } = await supabase.auth.getUser();

    // Get comments with user info and mentions
    const { data: comments, error } = await supabase
      .from('review_comments')
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
      .eq('review_id', reviewId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Get likes counts and user's likes for all comments
    const commentIds = comments?.map(c => c.id) || [];
    
    // Get likes counts
    const { data: likesData } = await supabase
      .from('comment_likes')
      .select('comment_id')
      .in('comment_id', commentIds);

    const likesCounts: { [key: string]: number } = {};
    likesData?.forEach(like => {
      likesCounts[like.comment_id] = (likesCounts[like.comment_id] || 0) + 1;
    });

    // Get user's likes if logged in
    let userLikes: string[] = [];
    if (user) {
      const { data: userLikesData } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', user.id)
        .in('comment_id', commentIds);
      userLikes = userLikesData?.map(l => l.comment_id) || [];
    }

    // Transform the data to a cleaner format
    const formattedComments = comments?.map(comment => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      likesCount: likesCounts[comment.id] || 0,
      isLiked: userLikes.includes(comment.id),
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
    }));

    return NextResponse.json({ comments: formattedComments || [] });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

// POST /api/reviews/[reviewId]/comments - Add a comment
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

    const body = await request.json();
    const { content, mentionedUserIds = [] } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 });
    }

    // Add comment
    const { data: comment, error: commentError } = await supabase
      .from('review_comments')
      .insert({
        review_id: reviewId,
        user_id: user.id,
        content: content.trim(),
      })
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
        )
      `)
      .single();

    if (commentError) throw commentError;

    // Add mentions if any
    if (mentionedUserIds.length > 0) {
      const mentions = mentionedUserIds.map((userId: string) => ({
        comment_id: comment.id,
        mentioned_user_id: userId,
      }));

      const { error: mentionsError } = await supabase
        .from('comment_mentions')
        .insert(mentions);

      if (mentionsError) {
        console.error('Error adding mentions:', mentionsError);
        // Don't fail the whole request if mentions fail
      }
    }

    // Fetch the complete comment with mentions
    const { data: completeComment } = await supabase
      .from('review_comments')
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
      .eq('id', comment.id)
      .single();

    const formattedComment = {
      id: completeComment!.id,
      content: completeComment!.content,
      createdAt: completeComment!.created_at,
      updatedAt: completeComment!.updated_at,
      user: {
        id: completeComment!.user.id,
        username: completeComment!.user.username,
        fullName: completeComment!.user.full_name,
        avatarUrl: completeComment!.user.avatar_url,
      },
      mentions: completeComment!.mentions?.map((m: any) => ({
        id: m.mentioned_user.id,
        username: m.mentioned_user.username,
        fullName: m.mentioned_user.full_name,
      })) || [],
    };

    return NextResponse.json({ comment: formattedComment });
  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
  }
}

