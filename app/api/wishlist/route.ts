import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { addTasteSignal } from '@/lib/taste-signals';

/**
 * GET /api/wishlist?userId=xxx&collectionId=xxx
 * Get wishlist for a user, optionally filtered by collection
 * collectionId=null returns items without a collection ("All Saved")
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
    const collectionId = searchParams.get('collectionId');

    // Build query
    let query = supabase
      .from('wishlist')
      .select(`
        id,
        created_at,
        restaurant_id,
        collection_id,
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

    // Filter by collection if specified
    if (collectionId !== null && collectionId !== undefined) {
      if (collectionId === 'null' || collectionId === '') {
        // Get items without a collection
        query = query.is('collection_id', null);
      } else {
        // Get items in specific collection
        query = query.eq('collection_id', collectionId);
      }
    }

    const { data: wishlistItems, error } = await query;

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
 * Add restaurant to wishlist, optionally to a specific collection
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

    const { restaurantId, googlePlaceId, name, address, imageUrl, collectionId } = await request.json();

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

    // If collectionId provided, verify it belongs to user
    if (collectionId) {
      const { data: collection } = await supabase
        .from('saved_collections')
        .select('id')
        .eq('id', collectionId)
        .eq('user_id', user.id)
        .single();

      if (!collection) {
        return NextResponse.json(
          { error: 'Collection not found' },
          { status: 404 }
        );
      }
    }

    // Check if already in wishlist
    const { data: existing } = await supabase
      .from('wishlist')
      .select('id, collection_id')
      .eq('user_id', user.id)
      .eq('restaurant_id', finalRestaurantId)
      .single();

    if (existing) {
      // If already saved but to different collection, update it
      if (collectionId && existing.collection_id !== collectionId) {
        const { error: updateError } = await supabase
          .from('wishlist')
          .update({ collection_id: collectionId })
          .eq('id', existing.id);

        if (updateError) {
          console.error('Error updating wishlist item:', updateError);
          throw updateError;
        }

        return NextResponse.json({
          success: true,
          message: 'Moved to collection',
          inWishlist: true,
          collectionId,
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Already in wishlist',
        inWishlist: true,
        collectionId: existing.collection_id,
      });
    }

    // Add to wishlist
    const { data: newItem, error: insertError } = await supabase
      .from('wishlist')
      .insert({
        user_id: user.id,
        restaurant_id: finalRestaurantId,
        collection_id: collectionId || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error adding to wishlist:', insertError);
      throw insertError;
    }

    // Add taste signal for adding to wishlist
    try {
      await addTasteSignal(supabase, user.id, {
        signalType: 'wishlist',
        signalStrength: 2,
        isPositive: true,
        restaurantId: finalRestaurantId,
        googlePlaceId: googlePlaceId,
        restaurantName: name,
        content: `Wants to visit ${name}`,
        sourceId: finalRestaurantId,
      });
    } catch (signalError) {
      // Don't fail the wishlist add if signal fails
      console.error('Error adding taste signal for wishlist:', signalError);
    }

    return NextResponse.json({
      success: true,
      message: 'Added to wishlist',
      inWishlist: true,
      wishlistItemId: newItem.id,
      collectionId: collectionId || null,
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
 * PATCH /api/wishlist
 * Move a wishlist item to a different collection
 */
export async function PATCH(request: NextRequest) {
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

    const { wishlistItemId, restaurantId, collectionId } = await request.json();

    // Find the wishlist item
    let query = supabase
      .from('wishlist')
      .select('id')
      .eq('user_id', user.id);

    if (wishlistItemId) {
      query = query.eq('id', wishlistItemId);
    } else if (restaurantId) {
      query = query.eq('restaurant_id', restaurantId);
    } else {
      return NextResponse.json(
        { error: 'wishlistItemId or restaurantId required' },
        { status: 400 }
      );
    }

    const { data: existing } = await query.single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Wishlist item not found' },
        { status: 404 }
      );
    }

    // If collectionId provided, verify it belongs to user
    if (collectionId) {
      const { data: collection } = await supabase
        .from('saved_collections')
        .select('id')
        .eq('id', collectionId)
        .eq('user_id', user.id)
        .single();

      if (!collection) {
        return NextResponse.json(
          { error: 'Collection not found' },
          { status: 404 }
        );
      }
    }

    // Update the collection
    const { error: updateError } = await supabase
      .from('wishlist')
      .update({ collection_id: collectionId || null })
      .eq('id', existing.id);

    if (updateError) {
      console.error('Error updating wishlist item:', updateError);
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: collectionId ? 'Moved to collection' : 'Moved to All Saved',
      collectionId: collectionId || null,
    });
  } catch (error) {
    console.error('Error in wishlist PATCH:', error);
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
