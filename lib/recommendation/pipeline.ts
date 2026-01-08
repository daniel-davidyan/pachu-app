/**
 * Recommendation Pipeline V2 - Main Orchestrator
 * 
 * This is the main entry point for the recommendation system.
 * It orchestrates all the steps:
 * 1. Extract context from conversation (WHERE, WHEN, WHAT)
 * 2. Apply hard filters (location, opening hours)
 * 3. Perform vector search (semantic similarity)
 * 4. Re-rank results (ratings, popularity, distance)
 * 5. LLM selection (final 3 with personal reasons)
 */

import {
  ChatMessage,
  UserLocation,
  PipelineResult,
  PipelineDebug,
  Recommendation,
} from './types';

import { extractConversationContext } from './extract-context';
import { applyHardFilters } from './hard-filters';
import { performVectorSearch } from './vector-search';
import { rerankRestaurants, enhanceDiversity } from './reranking';
import { selectWithLLM, buildRecommendations } from './llm-selection';

// ============================================================================
// PIPELINE CONFIGURATION
// ============================================================================

export interface PipelineConfig {
  openaiApiKey: string;
  supabaseUrl: string;
  supabaseKey: string;
  
  // Optional configuration
  vectorSearchTopK?: number;      // Default: 50
  rerankTopN?: number;            // Default: 15
  enableDiversity?: boolean;      // Default: true
  enableDebug?: boolean;          // Default: true
}

// ============================================================================
// MAIN PIPELINE FUNCTION
// ============================================================================

/**
 * Run the full recommendation pipeline
 * 
 * @param messages - Conversation history with the user
 * @param userLocation - User's current GPS location
 * @param config - Pipeline configuration (API keys, etc.)
 * @returns PipelineResult with recommendations and optional debug info
 */
export async function runRecommendationPipeline(
  messages: ChatMessage[],
  userLocation: UserLocation,
  config: PipelineConfig
): Promise<PipelineResult> {
  const startTime = Date.now();
  
  console.log('\n' + '='.repeat(60));
  console.log('🚀 RECOMMENDATION PIPELINE V2 STARTED');
  console.log('='.repeat(60) + '\n');
  
  try {
    // =========================================================================
    // STEP 1: Extract Context
    // =========================================================================
    console.log('📝 STEP 1: Extracting conversation context...');
    
    const context = await extractConversationContext(
      messages,
      config.openaiApiKey
    );
    
    console.log('   Location:', context.locationPreference, context.specificCity || '');
    console.log('   Timing:', context.timing, context.specificTime || '');
    console.log('   Cuisine:', context.cuisinePreferences.join(', ') || 'Any');
    console.log('   Occasion:', context.occasion || 'Not specified');
    console.log('   Language:', context.language);
    console.log('');
    
    // =========================================================================
    // STEP 2: Hard Filters
    // =========================================================================
    console.log('🔧 STEP 2: Applying hard filters...');
    
    const filteredRestaurants = await applyHardFilters(
      context,
      userLocation,
      config.supabaseUrl,
      config.supabaseKey
    );
    
    if (filteredRestaurants.length === 0) {
      console.log('⚠️ No restaurants after hard filters. Returning empty result.');
      return {
        recommendations: [],
        debug: config.enableDebug !== false ? {
          context,
          hardFilterCount: 0,
          vectorSearchCount: 0,
          rerankCount: 0,
          processingTimeMs: Date.now() - startTime,
        } : undefined,
      };
    }
    
    console.log(`   Found ${filteredRestaurants.length} restaurants after filters`);
    console.log('');
    
    // =========================================================================
    // STEP 3: Vector Search
    // =========================================================================
    console.log('🧠 STEP 3: Performing vector search...');
    
    const vectorTopK = config.vectorSearchTopK || 50;
    const vectorResults = await performVectorSearch(
      context,
      filteredRestaurants,
      config.openaiApiKey,
      vectorTopK
    );
    
    console.log(`   Top ${vectorResults.length} by semantic similarity`);
    console.log('');
    
    // =========================================================================
    // STEP 4: Re-ranking
    // =========================================================================
    console.log('📊 STEP 4: Re-ranking results...');
    
    const rerankTopN = config.rerankTopN || 15;
    let rankedRestaurants = rerankRestaurants(
      vectorResults,
      context,
      userLocation,
      rerankTopN
    );
    
    // Optional: enhance diversity
    if (config.enableDiversity !== false) {
      rankedRestaurants = enhanceDiversity(rankedRestaurants, rerankTopN);
    }
    
    console.log(`   Top ${rankedRestaurants.length} candidates ready for LLM`);
    console.log('');
    
    // =========================================================================
    // STEP 5: LLM Selection
    // =========================================================================
    console.log('🤖 STEP 5: LLM selecting final 3...');
    
    const selections = await selectWithLLM(
      rankedRestaurants,
      context,
      messages,
      config.openaiApiKey
    );
    
    const recommendations = buildRecommendations(selections, rankedRestaurants);
    
    console.log(`   Selected ${recommendations.length} final recommendations`);
    console.log('');
    
    // =========================================================================
    // DONE
    // =========================================================================
    const processingTimeMs = Date.now() - startTime;
    
    console.log('='.repeat(60));
    console.log('✅ PIPELINE COMPLETE');
    console.log(`   Processing time: ${processingTimeMs}ms`);
    console.log('='.repeat(60) + '\n');
    
    // Log final recommendations
    recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec.restaurant.name} (${rec.matchPercentage}%)`);
      console.log(`      "${rec.reason}"`);
    });
    console.log('');
    
    return {
      recommendations,
      debug: config.enableDebug !== false ? {
        context,
        hardFilterCount: filteredRestaurants.length,
        vectorSearchCount: vectorResults.length,
        rerankCount: rankedRestaurants.length,
        processingTimeMs,
      } : undefined,
    };
    
  } catch (error) {
    console.error('❌ Pipeline error:', error);
    
    return {
      recommendations: [],
      debug: config.enableDebug !== false ? {
        context: {
          locationPreference: 'anywhere',
          timing: 'anytime',
          cuisinePreferences: [],
          occasion: '',
          vibe: [],
          budget: '',
          dietaryRestrictions: [],
          conversationText: '',
          language: 'en',
        },
        hardFilterCount: 0,
        vectorSearchCount: 0,
        rerankCount: 0,
        processingTimeMs: Date.now() - startTime,
      } : undefined,
    };
  }
}

// ============================================================================
// SIMPLIFIED PIPELINE (for quick recommendations)
// ============================================================================

/**
 * Run a simplified pipeline with just vector search and re-ranking
 * Useful for faster responses or when LLM selection isn't needed
 */
export async function runQuickPipeline(
  searchText: string,
  userLocation: UserLocation,
  config: PipelineConfig,
  topK: number = 10
): Promise<Recommendation[]> {
  console.log('⚡ Running quick pipeline...');
  
  // Create minimal context
  const context = {
    locationPreference: 'tel_aviv' as const,
    timing: 'anytime' as const,
    cuisinePreferences: [] as string[],
    occasion: '',
    vibe: [] as string[],
    budget: '',
    dietaryRestrictions: [] as string[],
    conversationText: searchText,
    language: 'he' as const,
  };
  
  // Get filtered restaurants
  const filtered = await applyHardFilters(
    context,
    userLocation,
    config.supabaseUrl,
    config.supabaseKey
  );
  
  // Vector search
  const vectorResults = await performVectorSearch(
    context,
    filtered,
    config.openaiApiKey,
    topK * 2
  );
  
  // Re-rank
  const ranked = rerankRestaurants(
    vectorResults,
    context,
    userLocation,
    topK
  );
  
  // Build simple recommendations (no LLM)
  return ranked.map(r => ({
    restaurant: r,
    reason: '',
    matchPercentage: Math.max(70, Math.round(r.finalScore * 100)),
  }));
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  extractConversationContext,
  applyHardFilters,
  performVectorSearch,
  rerankRestaurants,
  selectWithLLM,
  buildRecommendations,
};

export * from './types';
