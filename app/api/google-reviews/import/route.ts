import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface GoogleReview {
  placeId: string;
  placeName: string;
  placeAddress: string;
  rating: number;
  text: string;
  photos: string[];
  timestamp: number; // Unix timestamp in milliseconds
}

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

    const { reviews } = await request.json() as { reviews: GoogleReview[] };
    
    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      return NextResponse.json(
        { error: 'Invalid reviews data' },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Places API key not configured' },
        { status: 500 }
      );
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const review of reviews) {
      try {
        let placeId = review.placeId;
        let place: any = null;

        // If placeId looks like hex format (0x...:0x...) or doesn't start with ChIJ, 
        // we need to search by name and address
        if (!placeId.startsWith('ChIJ') || placeId.includes('0x')) {
          // Search for the place by name and address
          const searchQuery = `${review.placeName} ${review.placeAddress}`;
          const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${apiKey}`;
          
          console.log('Searching for place:', { name: review.placeName, query: searchQuery });
          
          const searchResponse = await fetch(searchUrl);
          const searchData = await searchResponse.json();

          console.log('Google Places search result:', { 
            status: searchData.status, 
            resultCount: searchData.results?.length || 0,
            firstResult: searchData.results?.[0]?.name 
          });

          if (searchData.status === 'OK' && searchData.results && searchData.results.length > 0) {
            // Use the first result
            place = searchData.results[0];
            placeId = place.place_id;
            console.log('Found place:', { name: place.name, placeId });
          } else {
            console.error('Could not find place:', review.placeName, 'Status:', searchData.status);
            results.errors.push(`Could not find ${review.placeName} on Google Maps (${searchData.status})`);
            results.skipped++;
            continue;
          }
        }

        // If we don't have place details yet, fetch them
        if (!place) {
          const placeDetailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}&fields=name,formatted_address,geometry,types,photos`;
          const placeResponse = await fetch(placeDetailsUrl);
          const placeData = await placeResponse.json();

          if (placeData.status !== 'OK' || !placeData.result) {
            console.error('Could not fetch place details for:', review.placeName);
            results.errors.push(`Could not fetch details for ${review.placeName}`);
            results.skipped++;
            continue;
          }

          place = placeData.result;
        }

        // Check if restaurant exists in our database
        const { data: existingRestaurant } = await supabase
          .from('restaurants')
          .select('id')
          .eq('google_place_id', placeId)
          .single();

        let restaurantId: string;

        if (!existingRestaurant) {
          // Create new restaurant
          const lat = place.geometry?.location?.lat || 0;
          const lng = place.geometry?.location?.lng || 0;
          
          const newRestaurant = {
            google_place_id: placeId,
            name: place.name || review.placeName,
            address: place.formatted_address || review.placeAddress,
            cuisine_types: place.types?.filter((t: string) => 
              !['point_of_interest', 'establishment', 'food'].includes(t)
            ) || [],
            image_url: place.photos?.[0]
              ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${place.photos[0].photo_reference}&key=${apiKey}`
              : null,
            created_by: user.id,
          };

          const { data: createdRestaurant, error: createError } = await supabase
            .from('restaurants')
            .insert(newRestaurant)
            .select('id')
            .single();

          if (createError || !createdRestaurant) {
            console.error('Failed to create restaurant:', {
              error: createError,
              restaurant: newRestaurant,
              message: createError?.message,
              details: createError?.details,
              hint: createError?.hint,
            });
            const errorMsg = createError?.message || 'Unknown database error';
            results.errors.push(`Failed to add ${review.placeName}: ${errorMsg}`);
            results.skipped++;
            continue;
          }

          restaurantId = createdRestaurant.id;
          
          // Update location separately using SQL if PostGIS is set up
          if (lat && lng && lat !== 0 && lng !== 0) {
            try {
              await supabase.rpc('update_restaurant_location', {
                p_restaurant_id: restaurantId,
                p_longitude: lng,
                p_latitude: lat,
              });
            } catch (e) {
              // Location update is optional, continue without it
              console.log('Location update skipped (PostGIS function may not exist)');
            }
          }
        } else {
          restaurantId = existingRestaurant.id;
        }

        // Check if user already has a review for this restaurant
        const { data: existingReview } = await supabase
          .from('reviews')
          .select('id')
          .eq('user_id', user.id)
          .eq('restaurant_id', restaurantId)
          .single();

        if (existingReview) {
          // User already has a review for this restaurant
          results.skipped++;
          continue;
        }

        // Create the review
        const newReview = {
          user_id: user.id,
          restaurant_id: restaurantId,
          rating: review.rating,
          content: review.text || '',
          created_at: new Date(review.timestamp).toISOString(),
          updated_at: new Date(review.timestamp).toISOString(),
          is_published: false, // Import as unpublished by default
        };

        const { data: createdReview, error: reviewError } = await supabase
          .from('reviews')
          .insert(newReview)
          .select('id')
          .single();

        if (reviewError || !createdReview) {
          console.error('Failed to create review:', reviewError);
          results.errors.push(`Failed to import review for ${review.placeName}`);
          results.skipped++;
          continue;
        }

        // Add photos if provided
        if (review.photos && review.photos.length > 0) {
          const photoInserts = review.photos.slice(0, 5).map((photoUrl: string, index: number) => ({
            review_id: createdReview.id,
            photo_url: photoUrl,
            sort_order: index,
          }));

          await supabase.from('review_photos').insert(photoInserts);
        }

        results.imported++;
      } catch (error) {
        console.error('Error processing review:', error);
        results.errors.push(`Error processing ${review.placeName}`);
        results.skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      message: `Successfully imported ${results.imported} review(s). ${results.skipped} skipped.`,
    });
  } catch (error) {
    console.error('Error importing Google reviews:', error);
    return NextResponse.json(
      { error: 'Failed to import reviews' },
      { status: 500 }
    );
  }
}

