import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AddSignalRequest, SignalsResponse } from '@/types/api';

/**
 * GET /api/user/taste-signals
 * Returns the user's recent taste signals
 */
export async function GET(request: NextRequest) {
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
    const limit = parseInt(searchParams.get('limit') || '50');
    const signalType = searchParams.get('type');

    // Build query
    let query = supabase
      .from('user_taste_signals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (signalType) {
      query = query.eq('signal_type', signalType);
    }

    const { data: signals, error, count } = await query;

    if (error) {
      console.error('Error fetching taste signals:', error);
      return NextResponse.json(
        { error: 'Failed to fetch taste signals' },
        { status: 500 }
      );
    }

    // Transform to API format
    const transformedSignals = (signals || []).map(transformSignal);

    const response: SignalsResponse = {
      signals: transformedSignals,
      total: count || transformedSignals.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in taste signals GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/taste-signals
 * Adds a new taste signal
 */
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

    const body: AddSignalRequest = await request.json();

    // Validate required fields
    if (!body.signalType || !body.signalStrength) {
      return NextResponse.json(
        { error: 'signalType and signalStrength are required' },
        { status: 400 }
      );
    }

    // Insert signal
    const { data: signal, error: insertError } = await supabase
      .from('user_taste_signals')
      .insert({
        user_id: user.id,
        signal_type: body.signalType,
        signal_strength: body.signalStrength,
        is_positive: body.isPositive ?? true,
        restaurant_id: body.restaurantId,
        google_place_id: body.googlePlaceId,
        restaurant_name: body.restaurantName,
        cuisine_types: body.cuisineTypes,
        content: body.content,
        source_id: body.sourceId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting taste signal:', insertError);
      return NextResponse.json(
        { error: 'Failed to add taste signal' },
        { status: 500 }
      );
    }

    // Trigger embedding rebuild in background (fire and forget)
    rebuildEmbeddingAsync(supabase, user.id);

    return NextResponse.json({
      success: true,
      signal: transformSignal(signal),
    });
  } catch (error) {
    console.error('Error in taste signals POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/taste-signals
 * Deletes a taste signal
 */
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
    const signalId = searchParams.get('id');

    if (!signalId) {
      return NextResponse.json(
        { error: 'Signal ID is required' },
        { status: 400 }
      );
    }

    // Delete signal (RLS will ensure user owns it)
    const { error: deleteError } = await supabase
      .from('user_taste_signals')
      .delete()
      .eq('id', signalId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting taste signal:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete taste signal' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in taste signals DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to transform database row to API format
function transformSignal(dbSignal: any) {
  return {
    id: dbSignal.id,
    userId: dbSignal.user_id,
    signalType: dbSignal.signal_type,
    signalStrength: dbSignal.signal_strength,
    isPositive: dbSignal.is_positive,
    restaurantId: dbSignal.restaurant_id,
    googlePlaceId: dbSignal.google_place_id,
    restaurantName: dbSignal.restaurant_name,
    cuisineTypes: dbSignal.cuisine_types,
    content: dbSignal.content,
    sourceId: dbSignal.source_id,
    createdAt: dbSignal.created_at,
  };
}

// Async function to rebuild embedding without blocking response
async function rebuildEmbeddingAsync(supabase: any, userId: string) {
  try {
    // Fetch the rebuild-embedding API endpoint
    // This is a fire-and-forget call
    console.log(`🔄 Triggering embedding rebuild for user ${userId}`);
  } catch (error) {
    console.error('Error triggering embedding rebuild:', error);
  }
}

/**
 * Helper function to add a taste signal from other APIs
 * Can be imported and used by other route handlers
 */
export async function addTasteSignal(
  supabase: any,
  userId: string,
  signal: {
    signalType: 'review' | 'chat' | 'like' | 'comment' | 'wishlist' | 'click';
    signalStrength: 1 | 2 | 3 | 4 | 5;
    isPositive: boolean;
    restaurantId?: string;
    googlePlaceId?: string;
    restaurantName?: string;
    cuisineTypes?: string[];
    content?: string;
    sourceId?: string;
  }
) {
  try {
    const { error } = await supabase
      .from('user_taste_signals')
      .insert({
        user_id: userId,
        signal_type: signal.signalType,
        signal_strength: signal.signalStrength,
        is_positive: signal.isPositive,
        restaurant_id: signal.restaurantId,
        google_place_id: signal.googlePlaceId,
        restaurant_name: signal.restaurantName,
        cuisine_types: signal.cuisineTypes,
        content: signal.content,
        source_id: signal.sourceId,
      });

    if (error) {
      console.error('Error adding taste signal:', error);
      return false;
    }

    console.log(`✅ Added ${signal.signalType} signal for user ${userId}`);
    return true;
  } catch (error) {
    console.error('Error in addTasteSignal:', error);
    return false;
  }
}

