# AI Agent Chat - Major Improvements

## Overview
The AI agent chat has been drastically improved to become a central, intelligent component that truly understands user needs and provides highly accurate restaurant recommendations.

## Key Features

### 1. **Intelligent Conversation Flow (1-4 Questions)**
The agent now asks smart, contextual questions based on what information the user provides:

- **If user gives minimal info** (e.g., "I want pizza")
  → Asks 3-4 targeted questions about budget, occasion, timing, distance

- **If user gives moderate info** (e.g., "Looking for romantic Italian for dinner tonight")
  → Asks 1-2 clarifying questions (budget? distance?)

- **If user gives detailed info** (e.g., "Need mid-range sushi for 2, walking distance, tonight at 7pm")
  → Immediately searches without asking questions!

### 2. **Comprehensive Information Gathering**
The agent understands and extracts:

#### **Mood & Cuisine**
- Cuisine types: Italian, Japanese, Chinese, Mexican, Indian, Thai, etc.
- Specific dishes: Pizza, sushi, burgers, seafood, etc.
- Dietary preferences: Vegetarian, vegan, gluten-free

#### **Budget & Price Level**
- Level 1 (₪): Cheap, budget-friendly, under 50 shekels
- Level 2 (₪₪): Moderate, mid-range, 50-100 shekels  
- Level 3 (₪₪₪): Upscale, pricey, 100-150 shekels
- Level 4 (₪₪₪₪): Luxury, fine dining, 150+ shekels

#### **Occasion & Company**
- Solo dining
- Romantic date / anniversary
- Friends / group hangout
- Family / kids
- Business meeting
- Celebration / birthday

#### **Timing**
- Now / ASAP / immediately
- Tonight / this evening
- Tomorrow / next week / weekend
- Specific times: 7pm, 8 o'clock, noon
- Meal types: Breakfast, brunch, lunch, dinner

#### **Distance & Travel**
- Walking distance / nearby / close (searches within 1km)
- Short ride / scooter distance / 5 minutes (searches within 2km)
- Quick drive / anywhere in city (searches within 10km)
- Specific distances: "within 2km", "15 minute walk"

#### **Special Preferences**
- Romantic / quiet / cozy / intimate
- Outdoor seating / patio / terrace
- Pet-friendly / dog-friendly
- Live music / entertainment
- Great views / rooftop / waterfront
- Casual / laid-back / relaxed
- Trendy / hip / Instagram-worthy
- Traditional / authentic / local
- Family-friendly / kid-friendly

### 3. **Focused Search Detection**
The agent now intelligently detects when a user is searching for a specific restaurant:

#### **Direct Search** (Immediate Results)
When user types:
- "Cafe 38"
- "find me Cafe 38"
- "I want to go to Cafe 38"
- "take me to Cafe 38"
- "show me Cafe 38"

→ Agent immediately pulls up the restaurant without questions

#### **Question About a Place** (Conversational)
When user asks:
- "What do you think about Cafe 38?"
- "How is Cafe 38?"
- "Is Cafe 38 good?"
- "Should I go to Cafe 38?"

→ Agent engages in conversation, can provide info about the place, then either:
  - Shows the specific restaurant if user wants it
  - Suggests alternatives if it seems less suitable

### 4. **Advanced Restaurant Matching Algorithm**
Restaurants are scored based on multiple factors:

- **Base Score**: Restaurant rating (0-90 points)
- **Cuisine Match**: +20 points per matching cuisine type
- **Price Match**: +15 points for exact match, -5 per level difference
- **Special Preferences**: +12 points per matching preference (romantic, outdoor, etc.)
- **High Quality Bonus**: +10-15 points for ratings 4.5+
- **Popularity**: +3-15 points based on reviews and friend visits
- **Match Percentage**: Top results get 70-100% match scores

### 5. **Smart Search Strategy**
The agent uses different search approaches based on context:

#### **Focused Search Mode**
- Uses Google Places Text Search API for specific restaurant names
- High match percentage (95%) since it's what they asked for
- Shows up to 3 results (the specific place + similar options)

#### **General Recommendation Mode**
- Adjusts search radius based on distance preference (1km-10km)
- Uses cuisine-specific search when preferences are clear
- Falls back to nearby search for general exploration
- Returns exactly 3 best-matched restaurants with detailed scoring

### 6. **Natural Expert Conversation Style**
The agent talks like a knowledgeable friend:
- Short, natural questions (like texting)
- Thoughtful and attentive to details
- Uses emojis naturally: 🍽️ 💰 ❤️ 🌮 🎉 👥 🚶 🚗
- Enthusiastic but not over-the-top
- Feels like chatting with a local restaurant expert

## Technical Implementation

### Backend (`app/api/map-chat/route.ts`)
- **Focused Search Detection**: Regex patterns detect direct restaurant searches vs questions
- **Enhanced System Prompt**: Comprehensive instructions for the AI with all context
- **Advanced Data Extraction**: Parses 9+ parameters from user messages
- **Smart Search Logic**: Chooses between Text Search API and Nearby Search API
- **Sophisticated Scoring**: Multi-factor algorithm for ranking restaurants
- **Dynamic Radius**: Adjusts search area based on user's distance preference

### Frontend (`components/map/ai-chat-sheet.tsx`)
- **Improved Placeholders**: More inviting and descriptive text
- **Better Initial Greeting**: Warmer, more expert-sounding welcome message
- **Smooth Conversation Flow**: Handles 1-4 question exchanges gracefully
- **Restaurant Card Display**: Shows match percentages and key details

## Usage Examples

### Example 1: Minimal Info
**User**: "I want sushi"  
**Agent**: "Great choice! 🍣 What's your budget like? Looking to keep it casual or splurge a bit?"  
**User**: "Mid-range"  
**Agent**: "Perfect! Who are you going with? Solo, date, friends?"  
**User**: "Date tonight"  
**Agent**: "How far are you willing to go? Walking distance or happy to take a quick drive?"  
**User**: "Walking distance"  
→ *Shows 3 perfect romantic sushi restaurants within 1km*

### Example 2: Detailed Info
**User**: "Need a cheap Italian place for family dinner tonight, walking distance"  
→ *Immediately shows 3 budget-friendly Italian restaurants with family-friendly vibes within 1km*

### Example 3: Focused Search
**User**: "Cafe 38"  
→ *Immediately shows Cafe 38 and similar cafes*

### Example 4: Question About Place
**User**: "What do you think about Cafe 38?"  
**Agent**: "I'll check it out for you! Would you like me to show you Cafe 38, or are you exploring options?"  
**User**: "Show me"  
→ *Shows Cafe 38*

## Benefits

1. **Smarter Recommendations**: Multi-factor scoring ensures highly relevant results
2. **Faster for Power Users**: Detailed queries get instant results without questions
3. **Better for New Users**: Guided conversation helps those unsure what they want
4. **Flexible Search**: Handles both exploration and direct searches seamlessly
5. **Context-Aware**: Understands nuanced preferences like distance, timing, occasion
6. **Expert Feel**: Natural conversation makes users feel understood and guided

## Testing Recommendations

Test these scenarios manually:

1. **Quick Search**: "Cheap pizza nearby" → Should show results immediately
2. **Guided Search**: "I'm hungry" → Should ask follow-up questions  
3. **Specific Restaurant**: "Cafe 38" → Should show the specific place
4. **Question Mode**: "What about Cafe 38?" → Should engage in conversation
5. **Distance Variations**: Test "walking distance" vs "willing to drive"
6. **Budget Ranges**: Test different price preferences
7. **Occasions**: Test "date night" vs "family dinner" vs "business meeting"
8. **Timing**: Test "now" vs "tonight" vs "next week"

## Future Enhancements

Potential improvements for later:
- Remember user preferences across sessions
- Learn from past choices (if user always picks mid-range Italian)
- Integrate with user's review history for personalized suggestions
- Show "based on your taste" insights
- Time-aware suggestions (breakfast places in morning, bars at night)
- Weather-aware (suggest outdoor places on nice days)

