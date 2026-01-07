import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/collections/[id]
 * Get a specific collection with its items
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get collection
    const { data: collection, error: collectionError } = await supabase
      .from('saved_collections')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (collectionError || !collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Get wishlist items in this collection
    const { data: items, error: itemsError } = await supabase
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
      .eq('collection_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (itemsError) {
      console.error('Error fetching collection items:', itemsError);
      throw itemsError;
    }

    return NextResponse.json({
      collection: {
        ...collection,
        items_count: items?.length || 0,
      },
      items: items || [],
    });
  } catch (error) {
    console.error('Error in collection GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/collections/[id]
 * Update a collection (name or cover image)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { name, coverImageUrl } = await request.json();

    // Verify ownership
    const { data: existing } = await supabase
      .from('saved_collections')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      const trimmedName = name.trim();
      if (trimmedName.length === 0) {
        return NextResponse.json(
          { error: 'Collection name cannot be empty' },
          { status: 400 }
        );
      }

      // Check if another collection has this name
      const { data: duplicate } = await supabase
        .from('saved_collections')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', trimmedName)
        .neq('id', id)
        .single();

      if (duplicate) {
        return NextResponse.json(
          { error: 'A collection with this name already exists' },
          { status: 409 }
        );
      }

      updateData.name = trimmedName;
    }

    if (coverImageUrl !== undefined) {
      updateData.cover_image_url = coverImageUrl || null;
    }

    // Update collection
    const { data: collection, error: updateError } = await supabase
      .from('saved_collections')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating collection:', updateError);
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      collection,
    });
  } catch (error) {
    console.error('Error in collection PATCH:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/collections/[id]
 * Delete a collection (items move to "All Saved" - collection_id becomes NULL)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('saved_collections')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Delete collection (items will have collection_id set to NULL due to ON DELETE SET NULL)
    const { error: deleteError } = await supabase
      .from('saved_collections')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting collection:', deleteError);
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: 'Collection deleted',
    });
  } catch (error) {
    console.error('Error in collection DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
