import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { addTasteSignal } from '@/app/api/user/taste-signals/route';

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

    // Add taste signal for liking a review
    try {
      // Get review details for the signal
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
          signalType: 'like',
          signalStrength: 3,
          isPositive: true,
          restaurantId: restaurant.id,
          googlePlaceId: restaurant.google_place_id,
          restaurantName: restaurant.name,
          cuisineTypes: restaurant.cuisine_types || [],
          content: `Interested in ${restaurant.name}`,
          sourceId: reviewId,
        });
      }
    } catch (signalError) {
      // Don't fail the like if signal fails
      console.error('Error adding taste signal for like:', signalError);
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

