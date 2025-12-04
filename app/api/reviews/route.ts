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
        // Create new restaurant (location can be added later via SQL if needed)
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
            { error: `Failed to create restaurant: ${createError.message}. Please check your database schema.` },
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

