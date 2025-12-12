import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/wishlist?userId=xxx
 * Get wishlist for a user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || user.id;

    // Get wishlist items with restaurant details
    const { data: wishlistItems, error } = await supabase
      .from('wishlist')
      .select(`
        id,
        created_at,
        restaurant_id,
        restaurants (
          id,
          google_place_id,
          name,
          address,
          image_url
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching wishlist:', error);
      throw error;
    }

    return NextResponse.json({ 
      wishlist: wishlistItems || [],
      count: wishlistItems?.length || 0
    });
  } catch (error) {
    console.error('Error in wishlist API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wishlist
 * Add restaurant to wishlist
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { restaurantId, googlePlaceId, name, address, imageUrl } = await request.json();

    let finalRestaurantId = restaurantId;

    // If no restaurantId but have googlePlaceId, find or create restaurant
    if (!finalRestaurantId && googlePlaceId) {
      // Check if restaurant exists
      const { data: existingRestaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('google_place_id', googlePlaceId)
        .single();

      if (existingRestaurant) {
        finalRestaurantId = existingRestaurant.id;
      } else {
        // Create new restaurant
        const { data: newRestaurant, error: createError } = await supabase
          .from('restaurants')
          .insert({
            google_place_id: googlePlaceId,
            name,
            address,
            image_url: imageUrl,
            created_by: user.id,
          })
          .select('id')
          .single();

        if (createError) {
          console.error('Error creating restaurant:', createError);
          throw createError;
        }

        finalRestaurantId = newRestaurant.id;
      }
    }

    if (!finalRestaurantId) {
      return NextResponse.json(
        { error: 'Restaurant ID or Google Place ID required' },
        { status: 400 }
      );
    }

    // Check if already in wishlist
    const { data: existing } = await supabase
      .from('wishlist')
      .select('id')
      .eq('user_id', user.id)
      .eq('restaurant_id', finalRestaurantId)
      .single();

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Already in wishlist',
        inWishlist: true
      });
    }

    // Add to wishlist
    const { error: insertError } = await supabase
      .from('wishlist')
      .insert({
        user_id: user.id,
        restaurant_id: finalRestaurantId,
      });

    if (insertError) {
      console.error('Error adding to wishlist:', insertError);
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      message: 'Added to wishlist',
      inWishlist: true
    });
  } catch (error) {
    console.error('Error in wishlist POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/wishlist?restaurantId=xxx
 * Remove restaurant from wishlist
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const restaurantId = searchParams.get('restaurantId');

    if (!restaurantId) {
      return NextResponse.json(
        { error: 'Restaurant ID required' },
        { status: 400 }
      );
    }

    // Remove from wishlist
    const { error: deleteError } = await supabase
      .from('wishlist')
      .delete()
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurantId);

    if (deleteError) {
      console.error('Error removing from wishlist:', deleteError);
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: 'Removed from wishlist',
      inWishlist: false
    });
  } catch (error) {
    console.error('Error in wishlist DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
