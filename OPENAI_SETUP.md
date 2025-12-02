# OpenAI Chat Setup Guide

## 🎯 What We Built

✅ **AI Chat Interface** - Beautiful, modern chat UI with real-time messaging
✅ **OpenAI Integration** - Connected to GPT-4o-mini for restaurant recommendations
✅ **Conversation History** - Maintains context across the conversation
✅ **Mobile-Optimized** - Responsive design matching the app's aesthetic

---

## 🔑 Get Your OpenAI API Key

### **Step 1: Create OpenAI Account**

1. Go to: [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Go to: **API Keys** section

### **Step 2: Create API Key**

1. Click **"Create new secret key"**
2. Give it a name: `Pachu App`
3. **Copy the API key** (it starts with `sk-...`)
4. ⚠️ **Save it immediately** - you won't see it again!

### **Step 3: Add Billing (Required)**

1. Go to: **Settings** → **Billing**
2. Add a payment method
3. Set a usage limit (e.g., $10/month)
4. OpenAI offers **$5 free credits** for new accounts

---

## ⚙️ Configure Your App

### **Add API Key to `.env.local`**

1. Open `c:\Users\dadavidyan\Documents\pachu-app\.env.local`
2. Add this line:

```env
OPENAI_API_KEY=sk-your-actual-api-key-here
```

**Example `.env.local` file:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://pnahahivparjvkefeuux.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
OPENAI_API_KEY=sk-proj-1234567890abcdefghijklmnop...
```

### **Restart Dev Server**

After adding the API key:

1. **Stop the server**: Press `Ctrl+C` in terminal
2. **Start again**:
   ```bash
   npm run dev
   ```

---

## 🧪 Test the Chat

1. **Go to**: http://localhost:3000/chat
2. **Type a message**: "I'm craving Italian food"
3. **Press Enter** or click **Send**
4. **Wait for AI response** (usually 2-5 seconds)

### **Example Conversation:**

**You:** "I'm craving Italian food"

**Pachu AI:** "Great choice! 🍝 To help me find the perfect Italian restaurant for you, could you tell me:
- What's your budget? ($ - $$$$)
- Are you looking for casual or fine dining?
- Any dietary restrictions?
- What area are you in?"

**You:** "Mid-range budget, casual, no restrictions, Tel Aviv"

**Pachu AI:** "Perfect! Here are 3 amazing Italian restaurants in Tel Aviv:

1. **Pasta Basta** - Casual Italian
   - Price: $$
   - Why: Fresh homemade pasta, cozy atmosphere
   
2. **Pronto** - Contemporary Italian
   - Price: $$
   - Why: Modern take on classics, great wine selection
   
3. **Rina's Kitchen** - Traditional Italian
   - Price: $$
   - Why: Family-run, authentic recipes, warm vibe"

---

## 💰 Pricing

**GPT-4o-mini Pricing:**
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens

**Estimated Costs:**
- Average conversation: ~$0.01 - $0.03
- 100 conversations: ~$1 - $3
- Very affordable for testing and development!

---

## 🎨 Features Included

### **Chat UI:**
- ✅ Message bubbles (user vs assistant)
- ✅ Avatars (Bot icon for AI, User icon for you)
- ✅ Timestamps
- ✅ Loading indicator with spinner
- ✅ Auto-scroll to latest message
- ✅ Enter key to send
- ✅ Disabled state while loading
- ✅ Mobile-optimized layout

### **AI Capabilities:**
- ✅ Restaurant recommendations
- ✅ Conversational context
- ✅ Clarifying questions
- ✅ Personalized suggestions
- ✅ Friendly, engaging tone
- ✅ Emoji support

---

## 🔧 Advanced Configuration

### **Change AI Model**

In `app/api/chat/route.ts`, line 50:

```typescript
model: 'gpt-4o-mini',  // Fast and cheap
// OR
model: 'gpt-4o',       // More powerful, more expensive
```

### **Adjust Response Length**

In `app/api/chat/route.ts`, line 52:

```typescript
max_tokens: 500,  // Default (longer responses)
// OR
max_tokens: 300,  // Shorter, cheaper responses
```

### **Modify AI Personality**

Edit the system prompt in `app/api/chat/route.ts`, starting at line 27.

---

## 🚀 Deploy to Production

### **Vercel Deployment:**

1. Go to your Vercel project
2. **Settings** → **Environment Variables**
3. Add:
   ```
   OPENAI_API_KEY = sk-your-actual-key-here
   ```
4. **Redeploy** the app

---

## 🐛 Troubleshooting

**Problem**: "OpenAI API key not configured" error
**Solution**: 
- Check `.env.local` has correct API key
- Restart dev server
- Make sure key starts with `sk-`

**Problem**: "Insufficient quota" error
**Solution**:
- Add billing to OpenAI account
- Check usage limits
- Make sure credits are available

**Problem**: Slow responses
**Solution**:
- This is normal (2-5 seconds)
- Consider using `gpt-3.5-turbo` for faster responses
- Check your internet connection

**Problem**: Chat not sending messages
**Solution**:
- Check browser console for errors
- Verify API route is working: `/api/chat`
- Test with simple message first

---

## 📝 Next Steps

- [ ] Add user profile data to AI context
- [ ] Store chat history in database
- [ ] Add "Clear conversation" button
- [ ] Integrate real restaurant data
- [ ] Add image generation for restaurants
- [ ] Voice input support

---

Need help? Check the OpenAI Platform documentation or console logs for detailed error messages!

