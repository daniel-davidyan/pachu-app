import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if ID is a valid UUID - reviews only exist in database
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    if (!isUUID) {
      // Not a valid UUID, can't be a real review
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }
    
    const supabase = await createClient();

    // Get current user (optional)
    const { data: { user } } = await supabase.auth.getUser();

    // Get review
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        title,
        content,
        visit_date,
        created_at,
        likes_count,
        user_id,
        restaurant_id
      `)
      .eq('id', id)
      .single();

    if (reviewError || !review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Get reviewer profile
    const { data: reviewerProfile } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .eq('id', review.user_id)
      .single();

    // Get restaurant info
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', review.restaurant_id)
      .single();

    // Get review photos
    const { data: photos } = await supabase
      .from('review_photos')
      .select('photo_url')
      .eq('review_id', id)
      .order('sort_order', { ascending: true });

    // Check if user has liked this review
    let isLiked = false;
    if (user) {
      const { data: likeData } = await supabase
        .from('review_likes')
        .select('id')
        .eq('user_id', user.id)
        .eq('review_id', id)
        .single();
      
      isLiked = !!likeData;
    }

    // Get other reviews from this user at the same restaurant
    const { data: otherReviewsFromUser } = await supabase
      .from('reviews')
      .select('id, rating, content, created_at')
      .eq('user_id', review.user_id)
      .eq('restaurant_id', review.restaurant_id)
      .neq('id', id)
      .order('created_at', { ascending: false });

    // Get recent reviews from this user at other restaurants
    const { data: recentReviewsData } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        created_at,
        restaurants (
          id,
          name,
          image_url
        )
      `)
      .eq('user_id', review.user_id)
      .neq('id', id)
      .order('created_at', { ascending: false })
      .limit(3);

    const recentReviews = recentReviewsData?.map((r: any) => ({
      id: r.id,
      rating: r.rating,
      createdAt: r.created_at,
      restaurant: r.restaurants ? {
        id: r.restaurants.id,
        name: r.restaurants.name,
        imageUrl: r.restaurants.image_url,
      } : null,
    })) || [];

    // Check if current user follows the reviewer
    let isFollowing = false;
    if (user && user.id !== review.user_id) {
      const { data: followData } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', review.user_id)
        .single();
      
      isFollowing = !!followData;
    }

    // Get mutual friends with the reviewer
    let mutualFriends: any[] = [];
    if (user && user.id !== review.user_id) {
      const { data: currentUserFollowing } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = currentUserFollowing?.map(f => f.following_id) || [];

      const { data: reviewerFollowers } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', review.user_id);

      const followerIds = reviewerFollowers?.map(f => f.follower_id) || [];
      const mutualIds = followingIds.filter(id => followerIds.includes(id));

      if (mutualIds.length > 0) {
        const { data: mutualProfiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', mutualIds)
          .limit(5);

        mutualFriends = mutualProfiles?.map((p: any) => ({
          id: p.id,
          username: p.username,
          fullName: p.full_name || p.username,
          avatarUrl: p.avatar_url,
        })) || [];
      }
    }

    return NextResponse.json({
      review: {
        id: review.id,
        rating: review.rating,
        title: review.title,
        content: review.content || '',
        visitDate: review.visit_date,
        createdAt: review.created_at,
        likesCount: review.likes_count || 0,
        isLiked,
        photos: photos?.map(p => p.photo_url) || [],
        user: {
          id: reviewerProfile?.id || review.user_id,
          username: reviewerProfile?.username || 'Unknown',
          fullName: reviewerProfile?.full_name || reviewerProfile?.username || 'Unknown',
          avatarUrl: reviewerProfile?.avatar_url,
        },
        restaurant: restaurant ? {
          id: restaurant.id,
          name: restaurant.name,
          address: restaurant.address,
          imageUrl: restaurant.image_url,
          averageRating: restaurant.average_rating,
          totalReviews: restaurant.total_reviews,
        } : null,
      },
      isFollowing,
      mutualFriends,
      recentReviews,
    });
  } catch (error) {
    console.error('Error fetching review:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

