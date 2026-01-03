/**
 * Utility functions for managing user taste signals
 */

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

