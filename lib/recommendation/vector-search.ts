/**
 * Recommendation Pipeline V2 - Vector Search
 * 
 * Generates embeddings from the conversation and calculates similarity
 * against restaurant embeddings for semantic matching.
 */

import OpenAI from 'openai';
import {
  CachedRestaurant,
  ScoredRestaurant,
  ConversationContext,
} from './types';

// ============================================================================
// EMBEDDING GENERATION
// ============================================================================

/**
 * Generate embedding for a text using OpenAI's text-embedding-3-small model
 */
export async function generateEmbedding(
  text: string,
  openaiApiKey: string
): Promise<number[]> {
  const openai = new OpenAI({ apiKey: openaiApiKey });
  
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 1536,
  });
  
  return response.data[0].embedding;
}

/**
 * Build optimized search text from conversation context
 * This text will be embedded and compared against restaurant embeddings
 */
export function buildSearchText(context: ConversationContext): string {
  const parts: string[] = [];
  
  // Add cuisine preferences
  if (context.cuisinePreferences.length > 0) {
    parts.push(`Looking for: ${context.cuisinePreferences.join(', ')}`);
  }
  
  // Add occasion
  if (context.occasion) {
    parts.push(`Occasion: ${context.occasion}`);
  }
  
  // Add vibe preferences
  if (context.vibe.length > 0) {
    parts.push(`Atmosphere: ${context.vibe.join(', ')}`);
  }
  
  // Add budget
  if (context.budget) {
    parts.push(`Budget: ${context.budget}`);
  }
  
  // Add dietary restrictions
  if (context.dietaryRestrictions.length > 0) {
    parts.push(`Dietary: ${context.dietaryRestrictions.join(', ')}`);
  }
  
  // If we have specific preferences, use them
  if (parts.length > 0) {
    return parts.join('. ') + '.';
  }
  
  // Fallback to full conversation text
  return context.conversationText;
}

// ============================================================================
// COSINE SIMILARITY
// ============================================================================

/**
 * Calculate cosine similarity between two vectors
 * Returns a value between 0 and 1 (higher = more similar)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  // Cosine similarity ranges from -1 to 1
  // We normalize to 0-1 for easier scoring
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return (similarity + 1) / 2; // Normalize to 0-1
}

// ============================================================================
// VECTOR SEARCH
// ============================================================================

/**
 * Perform vector search on filtered restaurants
 * Returns restaurants scored by semantic similarity to user's preferences
 */
export async function performVectorSearch(
  context: ConversationContext,
  restaurants: CachedRestaurant[],
  openaiApiKey: string,
  topK: number = 50
): Promise<ScoredRestaurant[]> {
  console.log(`🧠 Starting vector search on ${restaurants.length} restaurants`);
  
  // Build search text from context
  const searchText = buildSearchText(context);
  console.log(`📝 Search text: "${searchText.substring(0, 100)}..."`);
  
  // Generate embedding for user's preferences
  console.log('🔄 Generating user embedding...');
  const userEmbedding = await generateEmbedding(searchText, openaiApiKey);
  
  // Score each restaurant by similarity
  console.log('📊 Calculating similarities...');
  const scored: ScoredRestaurant[] = restaurants
    .filter(r => r.summary_embedding || r.reviews_embedding)
    .map(restaurant => {
      // Calculate similarity scores
      const summaryScore = restaurant.summary_embedding
        ? cosineSimilarity(userEmbedding, restaurant.summary_embedding)
        : 0;
      
      const reviewsScore = restaurant.reviews_embedding
        ? cosineSimilarity(userEmbedding, restaurant.reviews_embedding)
        : 0;
      
      // Weighted average: 70% summary, 30% reviews
      // If no summary embedding, use reviews only (and vice versa)
      let vectorScore: number;
      if (summaryScore > 0 && reviewsScore > 0) {
        vectorScore = summaryScore * 0.7 + reviewsScore * 0.3;
      } else if (summaryScore > 0) {
        vectorScore = summaryScore;
      } else if (reviewsScore > 0) {
        vectorScore = reviewsScore;
      } else {
        vectorScore = 0.5; // Default score if no embeddings
      }
      
      return {
        ...restaurant,
        vectorScore,
        summaryScore,
        reviewsScore,
      };
    });
  
  // Sort by vector score (descending) and take top K
  const topResults = scored
    .sort((a, b) => b.vectorScore - a.vectorScore)
    .slice(0, topK);
  
  console.log(`✅ Vector search complete. Top scores:`);
  topResults.slice(0, 5).forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.name}: ${(r.vectorScore * 100).toFixed(1)}%`);
  });
  
  return topResults;
}

// ============================================================================
// ALTERNATIVE: SQL-BASED VECTOR SEARCH
// ============================================================================

/**
 * Perform vector search using PostgreSQL pgvector extension
 * This is more efficient for large datasets but requires the embedding
 * to be passed as a parameter to a stored function.
 * 
 * Note: This requires the search_restaurants_by_embedding function
 * to be available in the database.
 */
export async function performVectorSearchSQL(
  context: ConversationContext,
  userLocation: { lat: number; lng: number },
  openaiApiKey: string,
  supabaseUrl: string,
  supabaseKey: string,
  radiusMeters: number = 5000,
  topK: number = 50
): Promise<ScoredRestaurant[]> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🧠 Starting SQL-based vector search');
  
  // Build search text and generate embedding
  const searchText = buildSearchText(context);
  const userEmbedding = await generateEmbedding(searchText, openaiApiKey);
  
  // Call the stored function
  const { data, error } = await supabase.rpc('search_restaurants_by_embedding', {
    query_embedding: userEmbedding,
    user_lat: userLocation.lat,
    user_lng: userLocation.lng,
    radius_meters: radiusMeters,
    max_results: topK,
  });
  
  if (error) {
    console.error('SQL vector search error:', error);
    return [];
  }
  
  // Transform results to ScoredRestaurant format
  return (data || []).map((r: any) => ({
    ...r,
    vectorScore: r.similarity || 0.5,
    summaryScore: r.similarity || 0.5,
    reviewsScore: 0,
    distanceMeters: r.distance_meters,
  }));
}
