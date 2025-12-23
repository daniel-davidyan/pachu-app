# ONTOPO Google Custom Search Setup Guide

This guide explains how to set up Google Custom Search API for finding ONTOPO restaurant reservation pages.

## Why Google Custom Search?

Searching Google for "אונטופו [restaurant name]" or "ontopo [restaurant name]" gives the most accurate ONTOPO links, as Google has already indexed all ONTOPO pages. This is more reliable than ONTOPO's own search API.

## Setup Steps

### 1. Get Google Custom Search API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Custom Search API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Custom Search API"
   - Click "Enable"
4. Create API Key:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the API key
   - **Optional but recommended**: Restrict the key to "Custom Search API" only

### 2. Create Custom Search Engine

1. Go to [Google Programmable Search Engine](https://programmablesearchengine.google.com/)
2. Click "Add" to create new search engine
3. Configure:
   - **Sites to search**: `ontopo.com/*`
   - **Name**: "ONTOPO Restaurant Search"
   - **Language**: Hebrew or English (or both)
4. Click "Create"
5. In the search engine settings:
   - Go to "Setup" > "Basics"
   - Copy the **Search engine ID** (looks like: `a1b2c3d4e5f6g7h8i`)
   - Under "Search the entire web", toggle **ON** (important!)
   - This allows searching for ONTOPO pages across the entire web

### 3. Add Environment Variables

Add these to your `.env.local` file:

```bash
# Google Custom Search API (for ONTOPO restaurant links)
GOOGLE_CUSTOM_SEARCH_API_KEY=your_api_key_here
GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_search_engine_id_here
```

### 4. Test the Integration

1. Restart your development server
2. Visit a restaurant in Israel on your app
3. The ONTOPO button should appear
4. Check the console logs to see if Google search is working:
   - `🔍 Searching Google: "אונטופו Cafe 38"`
   - `✅ Found ONTOPO link via Google: https://ontopo.com/he/il/page/44216694`

## Pricing & Quotas

### Free Tier
- **100 searches per day** - completely free
- Perfect for testing and small-scale usage

### Paid Tier
If you need more than 100 searches/day:
- **$5 per 1,000 queries** (after free 100/day)
- **10,000 queries/day limit** (can request increase)

### Cost Estimation
- If you have 200 users visiting Israeli restaurants per day = ~200 searches
- Cost: First 100 free, next 100 = $0.50/day = ~$15/month
- Very affordable for most use cases!

## Fallback Behavior

The system automatically falls back to direct ONTOPO API search if:
- ❌ Google API not configured (missing env variables)
- ❌ Daily quota exceeded (100 searches)
- ❌ API error or network failure
- ❌ No ONTOPO link found in Google results

**You don't need Google API to get started** - the app will work with the fallback, but Google search is more accurate!

## Testing Without API Key

If you don't set up Google Custom Search:
1. The system will log: `⚠️ Google Custom Search not configured, will use fallback`
2. It will automatically use direct ONTOPO API search
3. ONTOPO buttons will still work, just with slightly less accuracy

## Monitoring Usage

To monitor your Google Custom Search usage:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to "APIs & Services" > "Dashboard"
4. Click on "Custom Search API"
5. View usage graphs and quotas

## Troubleshooting

### "User Rate Limit Exceeded"
- You've hit the 100/day free quota
- The app automatically falls back to direct ONTOPO search
- To increase: Set up billing in Google Cloud Console

### "API Key not valid"
- Check that Custom Search API is enabled in your project
- Verify the API key is correct in `.env.local`
- Restart your development server

### No Results Found
- The restaurant might not be on ONTOPO
- Try searching manually: `אונטופו [restaurant name]` on Google
- If it exists, the API should find it

### Button Doesn't Appear
- Check console logs for errors
- Verify the restaurant is in Israel
- Ensure ONTOPO has this restaurant (not all Israeli restaurants are on ONTOPO)

## Example Console Output

### Successful Google Search:
```
🔍 Looking for ONTOPO page: "Cafe 38" in Tel Aviv
🔍 Searching Google: "אונטופו Cafe 38 Tel Aviv"
✅ Found ONTOPO link via Google: https://ontopo.com/he/il/page/44216694
```

### Fallback to Direct Search:
```
🔍 Looking for ONTOPO page: "Cafe 38" in Tel Aviv
⚠️ Google Custom Search not configured, will use fallback
🔄 Using fallback: Direct ONTOPO API search
✅ Found ONTOPO link via API: https://ontopo.com/he/il/page/44216694
```

## Security Best Practices

1. **Never commit API keys** to version control
2. Add `.env.local` to `.gitignore`
3. Restrict API key to Custom Search API only (in Google Cloud Console)
4. Consider adding HTTP referrer restrictions (limit to your domain)
5. Monitor usage regularly to detect any unusual activity

## Alternative: No Setup Required

If you prefer not to set up Google Custom Search:
- Simply don't add the environment variables
- The app will automatically use direct ONTOPO API search
- ONTOPO buttons will still work for most restaurants
- You'll just miss some edge cases where Google indexing is better

---

**Questions?** The integration works out of the box with or without Google API!

