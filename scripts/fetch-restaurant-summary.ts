// Script to fetch LLM summaries for specific restaurants
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchRestaurantSummaries(names: string[]) {
  console.log(`\n🔍 Searching for restaurants: ${names.join(', ')}\n`);
  
  for (const name of names) {
    const { data, error } = await supabase
      .from('restaurant_cache')
      .select('name, summary, google_reviews, google_rating, google_reviews_count, address, categories')
      .ilike('name', `%${name}%`);
    
    if (error) {
      console.error(`Error fetching ${name}:`, error.message);
      continue;
    }
    
    if (!data || data.length === 0) {
      console.log(`❌ Restaurant "${name}" not found\n`);
      continue;
    }
    
    for (const restaurant of data) {
      console.log('═'.repeat(60));
      console.log(`🍽️  ${restaurant.name}`);
      console.log('═'.repeat(60));
      console.log(`📍 Address: ${restaurant.address}`);
      console.log(`⭐ Google Rating: ${restaurant.google_rating} (${restaurant.google_reviews_count} reviews)`);
      console.log(`🏷️  Categories: ${restaurant.categories?.join(', ') || 'N/A'}`);
      console.log('\n📝 LLM Summary:');
      console.log('─'.repeat(40));
      console.log(restaurant.summary || 'No summary available');
      console.log('─'.repeat(40));
      
      if (restaurant.google_reviews) {
        console.log('\n📖 Original Google Reviews (top 5):');
        console.log('─'.repeat(40));
        const reviews = Array.isArray(restaurant.google_reviews) 
          ? restaurant.google_reviews 
          : [];
        
        reviews.slice(0, 5).forEach((review: any, idx: number) => {
          console.log(`\n[${idx + 1}] ⭐ ${review.rating}/5 - ${review.author_name || 'Anonymous'}`);
          console.log(`   "${review.text?.substring(0, 300)}${review.text?.length > 300 ? '...' : ''}"`);
        });
      }
      console.log('\n');
    }
  }
}

// Run with the specified restaurants
fetchRestaurantSummaries(['Biga', 'Agatha']);
