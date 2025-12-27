# AI Agent Chat - Quick Reference Guide

## 🎯 What Changed?

### Before
- Simple 1-2 question flow
- Basic cuisine preference extraction
- Limited context understanding
- No specific restaurant search
- Simple scoring algorithm

### After
- **Smart 1-4 question flow** based on user input detail
- **Comprehensive preference extraction** (9+ parameters)
- **Deep context understanding** (budget, timing, distance, occasion, mood)
- **Focused search detection** for specific restaurants
- **Advanced multi-factor scoring** for perfect matches

---

## 🗣️ Conversation Intelligence

### The Agent Now Understands:

| Category | What It Extracts | Examples |
|----------|------------------|----------|
| **Cuisine & Mood** | Food types, dishes, dietary needs | "Italian", "sushi", "vegan options" |
| **Budget** | Price range (1-4 levels) | "cheap", "mid-range", "fine dining" |
| **Occasion** | Who & why dining | "date night", "family dinner", "solo" |
| **Timing** | When dining | "now", "tonight", "next Saturday at 7pm" |
| **Distance** | Travel preference | "walking distance", "quick ride", "anywhere" |
| **Special Vibes** | Atmosphere & features | "romantic", "outdoor", "pet-friendly" |

---

## 🔍 Search Modes

### Mode 1: Direct Search
```
User: "Cafe 38"
User: "find me Cafe 38"
→ INSTANT RESULTS (no questions)
```

### Mode 2: Question About Place
```
User: "What about Cafe 38?"
User: "Is Cafe 38 good?"
→ CONVERSATION → then shows results
```

### Mode 3: General Recommendation
```
User: "I want Italian food"
→ ASKS SMART QUESTIONS → shows top 3 matches
```

---

## 🎓 Question Strategy

### Scenario A: User Gives LOTS of Detail
```
User: "Need cheap Italian for family, tonight, walking distance"
→ NO QUESTIONS - Search immediately! ✅
```

### Scenario B: User Gives SOME Detail
```
User: "Looking for romantic Italian tonight"
Agent: "What's your budget like? 💰"
→ 1-2 QUESTIONS ✅
```

### Scenario C: User Gives MINIMAL Detail
```
User: "I'm hungry"
Agent: "What are you craving? 🍽️"
User: "Pizza"
Agent: "Budget preference?"
User: "Cheap"
Agent: "Who's joining you?"
→ 3-4 QUESTIONS ✅
```

**HARD LIMIT**: Maximum 4 questions, then must show results!

---

## 🏆 Matching Algorithm

### How Restaurants Are Scored:

```
Base Score (0-90)
+ Cuisine Match (+20 per match)
+ Exact Price Match (+15)
+ Special Preferences (+12 each)
+ High Rating Bonus (+10-15)
+ Popular/Reviewed (+8-15)
+ Friend Visits (+3-15)
= TOTAL SCORE
```

### Match Percentage Display:
- **90-100%**: Perfect match! 🎯
- **80-89%**: Great match! ✨
- **70-79%**: Good match! ✓
- **60-69%**: Decent option

Top result always gets boosted to at least 85%!

---

## 📍 Distance Logic

| User Says | Search Radius |
|-----------|---------------|
| "walking distance", "nearby", "close" | **1 km** 🚶 |
| "scooter", "short ride", "5 minutes" | **2 km** 🛴 |
| "drive", "anywhere", "don't care" | **10 km** 🚗 |
| *(no preference)* | **3 km** (default) |

---

## 💡 Usage Tips

### For Quick Results:
Be specific! Include:
- Cuisine type
- Budget level
- Distance preference
- Who you're with

**Example**: "Cheap sushi for 2, walking distance, tonight"

### For Exploration:
Start broad:
- "I'm in the mood for something good"
- "What should I eat?"
- Let the agent guide you through questions

### For Specific Places:
Just type the name:
- "Cafe 38"
- "find me Cafe 38"
- "take me to Cafe 38"

---

## 🧪 Test Scenarios

Try these to see the magic:

1. **"I want pizza"** → Should ask follow-ups
2. **"Cheap Italian nearby for date tonight"** → Instant results
3. **"Cafe 38"** → Shows the place immediately  
4. **"What's good around here?"** → Guided conversation
5. **"Mid-range sushi, walking distance"** → Smart results in 1km
6. **"Romantic dinner spot"** → Asks about budget/distance
7. **"I'm hungry"** → Full guided experience

---

## 🎨 User Experience

### Conversation Style:
- ✅ Natural, like texting a friend
- ✅ Expert knowledge, confident recommendations
- ✅ Short questions (1-2 sentences)
- ✅ Smart use of emojis
- ✅ Adapts to how much info you give

### Placeholders & Messages:
- Floating bar: "What are you craving? 🍽️"
- Empty state: "Your Personal Dining Expert"
- Initial greeting: "Hey! 👋 I'm here to help you find the perfect spot..."

---

## 🚀 Ready to Use!

The AI agent is now live and ready to impress users with intelligent, contextual restaurant recommendations. The conversation feels natural, the results are accurate, and it handles everything from quick searches to guided discovery.

**Go to**: http://localhost:3000/map

**Try it out!** 🎉

