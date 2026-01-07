import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/collections
 * Get all collections for the current user with item counts and preview images
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

    // Get collections with counts using the database function
    const { data: collections, error } = await supabase
      .rpc('get_user_collections_with_counts', { p_user_id: user.id });

    if (error) {
      console.error('Error fetching collections:', error);
      
      // Fallback to manual query if function doesn't exist
      const { data: fallbackCollections, error: fallbackError } = await supabase
        .from('saved_collections')
        .select(`
          id,
          name,
          cover_image_url,
          created_at,
          updated_at
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (fallbackError) {
        throw fallbackError;
      }

      // Get counts and previews manually
      const collectionsWithCounts = await Promise.all(
        (fallbackCollections || []).map(async (collection) => {
          const { count } = await supabase
            .from('wishlist')
            .select('*', { count: 'exact', head: true })
            .eq('collection_id', collection.id);

          const { data: previewItems } = await supabase
            .from('wishlist')
            .select('restaurants(image_url)')
            .eq('collection_id', collection.id)
            .order('created_at', { ascending: false })
            .limit(4);

          const previewImages = previewItems
            ?.map((item: any) => item.restaurants?.image_url)
            .filter(Boolean) || [];

          return {
            ...collection,
            items_count: count || 0,
            preview_images: previewImages,
          };
        })
      );

      return NextResponse.json({ 
        collections: collectionsWithCounts,
        count: collectionsWithCounts.length
      });
    }

    return NextResponse.json({ 
      collections: collections || [],
      count: collections?.length || 0
    });
  } catch (error) {
    console.error('Error in collections API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/collections
 * Create a new collection
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

    const { name, coverImageUrl } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Collection name is required' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    // Check if collection with same name exists
    const { data: existing } = await supabase
      .from('saved_collections')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', trimmedName)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'A collection with this name already exists' },
        { status: 409 }
      );
    }

    // Create collection
    const { data: collection, error: insertError } = await supabase
      .from('saved_collections')
      .insert({
        user_id: user.id,
        name: trimmedName,
        cover_image_url: coverImageUrl || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating collection:', insertError);
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      collection: {
        ...collection,
        items_count: 0,
        preview_images: [],
      },
    });
  } catch (error) {
    console.error('Error in collections POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
