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

    const { restaurant, rating, content, photoUrls, reviewId } = await request.json();

    if (!restaurant || !rating) {
      return NextResponse.json(
        { error: 'Restaurant and rating are required' },
        { status: 400 }
      );
    }

    // Always use Google Place ID to find or create restaurant
    let restaurantId: string | null = null;

    if (restaurant.googlePlaceId) {
      // Check if restaurant exists by Google Place ID
      const { data: existingRestaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('google_place_id', restaurant.googlePlaceId)
        .single();

      if (existingRestaurant) {
        restaurantId = existingRestaurant.id;
      } else {
        // Create new restaurant with Google Place ID
        const { data: newRestaurant, error: createError } = await supabase
          .from('restaurants')
          .insert({
            google_place_id: restaurant.googlePlaceId,
            name: restaurant.name,
            address: restaurant.address,
            image_url: restaurant.photoUrl,
            created_by: user.id,
          })
          .select('id')
          .single();

        if (createError) {
          console.error('Error creating restaurant:', createError);
          return NextResponse.json(
            { error: `Failed to create restaurant: ${createError.message}` },
            { status: 500 }
          );
        }

        restaurantId = newRestaurant.id;
        
        // Update location separately using SQL if PostGIS is set up
        if (restaurant.latitude && restaurant.longitude) {
          try {
            await supabase.rpc('update_restaurant_location', {
              p_restaurant_id: restaurantId,
              p_longitude: restaurant.longitude,
              p_latitude: restaurant.latitude,
            });
          } catch (e) {
            // Location update is optional, continue without it
            console.log('Location update skipped (PostGIS function may not exist)');
          }
        }
      }
    } else if (restaurant.id) {
      // Fallback: use provided restaurant ID (for legacy support)
      restaurantId = restaurant.id;
    }

    if (!restaurantId) {
      return NextResponse.json(
        { error: 'Could not determine restaurant ID' },
        { status: 400 }
      );
    }

    // If reviewId is provided, update existing review (edit mode)
    if (reviewId) {
      // Verify the review belongs to the user
      const { data: existingReview } = await supabase
        .from('reviews')
        .select('id, user_id')
        .eq('id', reviewId)
        .eq('user_id', user.id)
        .single();

      if (!existingReview) {
        return NextResponse.json(
          { error: 'Review not found or unauthorized' },
          { status: 404 }
        );
      }

      // Update existing review
      const { error: updateError } = await supabase
        .from('reviews')
        .update({
          rating,
          content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reviewId);

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
          .eq('review_id', reviewId);

        // Add new photos
        const photoInserts = photoUrls.map((url: string, index: number) => ({
          review_id: reviewId,
          photo_url: url,
          sort_order: index,
        }));

        await supabase.from('review_photos').insert(photoInserts);
      } else {
        // If no photos provided, delete all existing photos
        await supabase
          .from('review_photos')
          .delete()
          .eq('review_id', reviewId);
      }

      return NextResponse.json({ 
        success: true, 
        reviewId: reviewId,
        message: 'Review updated'
      });
    }

    // Otherwise, create a new review (allows multiple reviews per restaurant)
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
  } catch (error) {
    console.error('Error in reviews API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get reviews for a restaurant or user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const restaurantId = searchParams.get('restaurantId');
    const userId = searchParams.get('userId');

    // Query reviews with restaurant and photo data
    // Using left join to handle cases where restaurant might be deleted
    let query = supabase
      .from('reviews')
      .select(`
        id,
        rating,
        content,
        created_at,
        user_id,
        restaurant_id,
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
      console.error('Error fetching reviews - Details:', error);
      console.error('Query params:', { restaurantId, userId });
      return NextResponse.json(
        { 
          error: 'Failed to fetch reviews',
          details: error.message,
          hint: error.hint 
        },
        { status: 500 }
      );
    }

    // Return empty array if no reviews
    return NextResponse.json({ reviews: reviews || [] });
  } catch (error) {
    console.error('Error in reviews API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Delete a review
export async function DELETE(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const reviewId = searchParams.get('reviewId');

    if (!reviewId) {
      return NextResponse.json(
        { error: 'Review ID is required' },
        { status: 400 }
      );
    }

    // Check if review belongs to user
    const { data: review } = await supabase
      .from('reviews')
      .select('user_id')
      .eq('id', reviewId)
      .single();

    if (!review || review.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Review not found or unauthorized' },
        { status: 404 }
      );
    }

    // Delete review photos first
    await supabase
      .from('review_photos')
      .delete()
      .eq('review_id', reviewId);

    // Delete review
    const { error: deleteError } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId);

    if (deleteError) {
      console.error('Error deleting review:', deleteError);
      throw deleteError;
    }

    return NextResponse.json({ 
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Error in delete review API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

