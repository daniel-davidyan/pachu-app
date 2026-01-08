/**
 * Recommendation Pipeline V2
 * 
 * Usage:
 * ```typescript
 * import { runRecommendationPipeline } from '@/lib/recommendation';
 * 
 * const result = await runRecommendationPipeline(
 *   messages,
 *   userLocation,
 *   {
 *     openaiApiKey: process.env.OPENAI_API_KEY!,
 *     supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
 *     supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
 *   }
 * );
 * 
 * // result.recommendations contains the final 3 restaurants
 * // result.debug contains pipeline statistics
 * ```
 */

export {
  runRecommendationPipeline,
  runQuickPipeline,
  type PipelineConfig,
} from './pipeline';

export {
  extractConversationContext,
} from './extract-context';

export {
  applyHardFilters,
  calculateDistanceMeters,
} from './hard-filters';

export {
  performVectorSearch,
  generateEmbedding,
  cosineSimilarity,
  buildSearchText,
} from './vector-search';

export {
  rerankRestaurants,
  enhanceDiversity,
} from './reranking';

export {
  selectWithLLM,
  buildRecommendations,
} from './llm-selection';

export * from './types';
