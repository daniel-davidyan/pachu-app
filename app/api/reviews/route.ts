import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { restaurant, rating, content, photoUrls } = await request.json();

    if (!restaurant || !rating) {
      return NextResponse.json(
        { error: 'Restaurant and rating are required' },
        { status: 400 }
      );
    }

    // First, check if restaurant exists in our database or create it
    let restaurantId = restaurant.id;

    if (!restaurantId && restaurant.googlePlaceId) {
      // Check if restaurant exists by Google Place ID
      const { data: existingRestaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('google_place_id', restaurant.googlePlaceId)
        .single();

      if (existingRestaurant) {
        restaurantId = existingRestaurant.id;
      } else {
        // Create new restaurant
        const { data: newRestaurant, error: createError } = await supabase
          .from('restaurants')
          .insert({
            google_place_id: restaurant.googlePlaceId,
            name: restaurant.name,
            address: restaurant.address,
            location: `POINT(${restaurant.longitude} ${restaurant.latitude})`,
            image_url: restaurant.photoUrl,
            created_by: user.id,
          })
          .select('id')
          .single();

        if (createError) {
          console.error('Error creating restaurant:', createError);
          return NextResponse.json(
            { error: 'Failed to create restaurant' },
            { status: 500 }
          );
        }

        restaurantId = newRestaurant.id;
      }
    }

    if (!restaurantId) {
      return NextResponse.json(
        { error: 'Could not determine restaurant ID' },
        { status: 400 }
      );
    }

    // Check if user already reviewed this restaurant
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurantId)
      .single();

    if (existingReview) {
      // Update existing review
      const { error: updateError } = await supabase
        .from('reviews')
        .update({
          rating,
          content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingReview.id);

      if (updateError) {
        console.error('Error updating review:', updateError);
        return NextResponse.json(
          { error: 'Failed to update review' },
          { status: 500 }
        );
      }

      // Update photos
      if (photoUrls?.length > 0) {
        // Delete old photos
        await supabase
          .from('review_photos')
          .delete()
          .eq('review_id', existingReview.id);

        // Add new photos
        const photoInserts = photoUrls.map((url: string, index: number) => ({
          review_id: existingReview.id,
          photo_url: url,
          sort_order: index,
        }));

        await supabase.from('review_photos').insert(photoInserts);
      }

      return NextResponse.json({ 
        success: true, 
        reviewId: existingReview.id,
        message: 'Review updated'
      });
    } else {
      // Create new review
      const { data: newReview, error: createError } = await supabase
        .from('reviews')
        .insert({
          user_id: user.id,
          restaurant_id: restaurantId,
          rating,
          content,
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Error creating review:', createError);
        return NextResponse.json(
          { error: 'Failed to create review' },
          { status: 500 }
        );
      }

      // Add photos
      if (photoUrls?.length > 0) {
        const photoInserts = photoUrls.map((url: string, index: number) => ({
          review_id: newReview.id,
          photo_url: url,
          sort_order: index,
        }));

        await supabase.from('review_photos').insert(photoInserts);
      }

      return NextResponse.json({ 
        success: true, 
        reviewId: newReview.id,
        message: 'Review created'
      });
    }
  } catch (error) {
    console.error('Error in reviews API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get reviews for a restaurant
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const restaurantId = searchParams.get('restaurantId');
    const userId = searchParams.get('userId');

    let query = supabase
      .from('reviews')
      .select(`
        id,
        rating,
        content,
        created_at,
        user_id,
        restaurant_id,
        profiles (
          username,
          full_name,
          avatar_url
        ),
        restaurants (
          id,
          name,
          address,
          image_url
        ),
        review_photos (
          photo_url,
          sort_order
        )
      `)
      .order('created_at', { ascending: false });

    if (restaurantId) {
      query = query.eq('restaurant_id', restaurantId);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: reviews, error } = await query.limit(50);

    if (error) {
      console.error('Error fetching reviews:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reviews' },
        { status: 500 }
      );
    }

    return NextResponse.json({ reviews });
  } catch (error) {
    console.error('Error in reviews API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

