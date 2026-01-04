import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 1536,
  });
  return response.data[0].embedding;
}

function extractReviewsText(googleReviews: any): string {
  if (!googleReviews || !Array.isArray(googleReviews)) {
    return '';
  }
  
  // Extract text from reviews and join them
  const reviewTexts = googleReviews
    .map((review: any) => {
      const text = review.text || review.originalText || '';
      return text.trim();
    })
    .filter((text: string) => text.length > 0);
  
  // Join with separator and limit to reasonable length
  const combinedText = reviewTexts.join(' | ');
  
  // Limit to ~6000 characters to stay within token limits
  return combinedText.substring(0, 6000);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const body = await request.json().catch(() => ({}));
    const batchSize = body.batchSize || 50;
    const onlySummary = body.onlySummary || false;
    const onlyReviews = body.onlyReviews || false;
    const forceUpdate = body.forceUpdate || false;
    
    console.log('========================================');
    console.log('🧠 STARTING EMBEDDING GENERATION');
    console.log(`📊 Batch size: ${batchSize}`);
    console.log(`🔄 Force update: ${forceUpdate}`);
    console.log(`📝 Only summary: ${onlySummary}`);
    console.log(`💬 Only reviews: ${onlyReviews}`);
    console.log('========================================\n');

    // Build query to get restaurants needing embeddings
    let query = supabase
      .from('restaurant_cache')
      .select('id, name, summary, google_reviews');
    
    if (!forceUpdate) {
      if (onlySummary) {
        query = query.is('summary_embedding', null);
      } else if (onlyReviews) {
        query = query.is('reviews_embedding', null);
      } else {
        // Get restaurants missing either embedding
        query = query.or('summary_embedding.is.null,reviews_embedding.is.null');
      }
    }
    
    const { data: restaurants, error: fetchError } = await query.limit(batchSize);
    
    if (fetchError) {
      console.error('❌ Error fetching restaurants:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    
    if (!restaurants || restaurants.length === 0) {
      console.log('✅ No restaurants need embedding generation');
      return NextResponse.json({ 
        message: 'All embeddings up to date',
        processed: 0 
      });
    }
    
    console.log(`📋 Found ${restaurants.length} restaurants to process\n`);
    
    let processedCount = 0;
    let summaryCount = 0;
    let reviewsCount = 0;
    let errorCount = 0;
    
    for (const restaurant of restaurants) {
      try {
        console.log(`\n[${processedCount + 1}/${restaurants.length}] Processing: ${restaurant.name}`);
        
        const updates: any = {};
        
        // Generate summary embedding
        if (!onlyReviews && restaurant.summary) {
          console.log('  📝 Generating summary embedding...');
          const summaryEmbedding = await generateEmbedding(restaurant.summary);
          updates.summary_embedding = summaryEmbedding;
          summaryCount++;
          console.log('  ✅ Summary embedding generated');
        }
        
        // Generate reviews embedding
        if (!onlySummary && restaurant.google_reviews) {
          const reviewsText = extractReviewsText(restaurant.google_reviews);
          if (reviewsText.length > 50) {
            console.log(`  💬 Generating reviews embedding (${reviewsText.length} chars)...`);
            const reviewsEmbedding = await generateEmbedding(reviewsText);
            updates.reviews_embedding = reviewsEmbedding;
            updates.reviews_text = reviewsText;
            reviewsCount++;
            console.log('  ✅ Reviews embedding generated');
          } else {
            console.log('  ⚠️ Reviews too short, skipping reviews embedding');
          }
        }
        
        // Update database if we have any embeddings
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('restaurant_cache')
            .update(updates)
            .eq('id', restaurant.id);
          
          if (updateError) {
            console.error(`  ❌ Error updating ${restaurant.name}:`, updateError);
            errorCount++;
          } else {
            console.log(`  💾 Saved to database`);
          }
        }
        
        processedCount++;
        
        // Rate limiting - OpenAI allows ~3000 RPM for embeddings
        await delay(100);
        
      } catch (err) {
        console.error(`  ❌ Error processing ${restaurant.name}:`, err);
        errorCount++;
      }
    }
    
    // Check if there are more restaurants to process
    const { count: remainingCount } = await supabase
      .from('restaurant_cache')
      .select('id', { count: 'exact', head: true })
      .or('summary_embedding.is.null,reviews_embedding.is.null');
    
    console.log('\n========================================');
    console.log('✅ EMBEDDING GENERATION COMPLETE');
    console.log(`📊 Processed: ${processedCount} restaurants`);
    console.log(`📝 Summary embeddings: ${summaryCount}`);
    console.log(`💬 Reviews embeddings: ${reviewsCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📋 Remaining: ${remainingCount || 0}`);
    console.log('========================================\n');
    
    return NextResponse.json({
      message: 'Embedding generation completed',
      processed: processedCount,
      summaryEmbeddings: summaryCount,
      reviewsEmbeddings: reviewsCount,
      errors: errorCount,
      remaining: remainingCount || 0,
    });
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint for status check
export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get counts
    const { count: totalCount } = await supabase
      .from('restaurant_cache')
      .select('id', { count: 'exact', head: true });
    
    const { count: withSummaryEmbedding } = await supabase
      .from('restaurant_cache')
      .select('id', { count: 'exact', head: true })
      .not('summary_embedding', 'is', null);
    
    const { count: withReviewsEmbedding } = await supabase
      .from('restaurant_cache')
      .select('id', { count: 'exact', head: true })
      .not('reviews_embedding', 'is', null);
    
    const { count: withBothEmbeddings } = await supabase
      .from('restaurant_cache')
      .select('id', { count: 'exact', head: true })
      .not('summary_embedding', 'is', null)
      .not('reviews_embedding', 'is', null);
    
    return NextResponse.json({
      total: totalCount || 0,
      withSummaryEmbedding: withSummaryEmbedding || 0,
      withReviewsEmbedding: withReviewsEmbedding || 0,
      withBothEmbeddings: withBothEmbeddings || 0,
      missingSummaryEmbedding: (totalCount || 0) - (withSummaryEmbedding || 0),
      missingReviewsEmbedding: (totalCount || 0) - (withReviewsEmbedding || 0),
    });
    
  } catch (error) {
    console.error('❌ Error getting status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
