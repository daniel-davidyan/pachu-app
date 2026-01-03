import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { addTasteSignal } from '@/lib/taste-signals';

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
    const formattedComments = comments?.map(comment => {
      // Type assertion to handle Supabase's type inference issue
      const commentUser = Array.isArray(comment.user) ? comment.user[0] : comment.user;
      const commentMentions = comment.mentions || [];
      
      return {
        id: comment.id,
        content: comment.content,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        likesCount: likesCounts[comment.id] || 0,
        isLiked: userLikes.includes(comment.id),
        user: {
          id: commentUser.id,
          username: commentUser.username,
          fullName: commentUser.full_name,
          avatarUrl: commentUser.avatar_url,
        },
        mentions: commentMentions.map((m: any) => ({
          id: m.mentioned_user.id,
          username: m.mentioned_user.username,
          fullName: m.mentioned_user.full_name,
        })),
      };
    });

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

    console.log('[API] Adding comment to review:', reviewId);

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[API] Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[API] User authenticated:', user.id);

    const body = await request.json();
    const { content, mentionedUserIds = [] } = body;

    console.log('[API] Comment content:', content, 'Mentions:', mentionedUserIds);

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 });
    }

    // Add comment
    console.log('[API] Inserting comment...');
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

    if (commentError) {
      console.error('[API] Comment insert error:', commentError);
      throw commentError;
    }

    console.log('[API] Comment inserted:', comment.id);

    // Add mentions if any
    if (mentionedUserIds.length > 0) {
      console.log('[API] Adding mentions...');
      const mentions = mentionedUserIds.map((userId: string) => ({
        comment_id: comment.id,
        mentioned_user_id: userId,
      }));

      const { error: mentionsError } = await supabase
        .from('comment_mentions')
        .insert(mentions);

      if (mentionsError) {
        console.error('[API] Error adding mentions:', mentionsError);
        // Don't fail the whole request if mentions fail
      } else {
        console.log('[API] Mentions added successfully');
      }
    }

    // Fetch the complete comment with mentions
    console.log('[API] Fetching complete comment...');
    const { data: completeComment, error: fetchError } = await supabase
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

    if (fetchError || !completeComment) {
      console.error('[API] Error fetching complete comment:', fetchError);
      throw fetchError;
    }

    console.log('[API] Complete comment fetched:', completeComment);

    // Type assertion to handle Supabase's type inference issue
    const completeCommentUser = Array.isArray(completeComment.user) ? completeComment.user[0] : completeComment.user;
    const completeCommentMentions = completeComment.mentions || [];

    const formattedComment = {
      id: completeComment.id,
      content: completeComment.content,
      createdAt: completeComment.created_at,
      updatedAt: completeComment.updated_at,
      likesCount: 0,
      isLiked: false,
      user: {
        id: completeCommentUser.id,
        username: completeCommentUser.username,
        fullName: completeCommentUser.full_name,
        avatarUrl: completeCommentUser.avatar_url,
      },
      mentions: completeCommentMentions.map((m: any) => ({
        id: m.mentioned_user.id,
        username: m.mentioned_user.username,
        fullName: m.mentioned_user.full_name,
      })),
    };

    // Add taste signal for commenting on a review
    try {
      // Get review and restaurant details for the signal
      const { data: review } = await supabase
        .from('reviews')
        .select(`
          id,
          restaurant_id,
          restaurants (
            id,
            name,
            google_place_id,
            cuisine_types
          )
        `)
        .eq('id', reviewId)
        .single();

      if (review?.restaurants) {
        const restaurant = review.restaurants as any;
        await addTasteSignal(supabase, user.id, {
          signalType: 'comment',
          signalStrength: 3,
          isPositive: true,
          restaurantId: restaurant.id,
          googlePlaceId: restaurant.google_place_id,
          restaurantName: restaurant.name,
          cuisineTypes: restaurant.cuisine_types || [],
          content: `Interested in ${restaurant.name}`,
          sourceId: completeComment.id,
        });
      }
    } catch (signalError) {
      // Don't fail the comment if signal fails
      console.error('Error adding taste signal for comment:', signalError);
    }

    console.log('[API] Returning formatted comment');
    return NextResponse.json({ comment: formattedComment });
  } catch (error) {
    console.error('[API] Error adding comment:', error);
    return NextResponse.json({ 
      error: 'Failed to add comment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

