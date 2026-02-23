# YouTube Title Fetching Issue

## Problem

When adding YouTube video links, the title shows as "youtube.com" instead of the actual video title.

## Background

Previously, YouTube titles were fetched successfully. After implementing YouTube channel icon detection feature, YouTube started rate-limiting the server requests with HTTP 429 errors.

## Current Behavior

- Adding a YouTube video URL results in "youtube.com" as the name
- Console shows: `[ERROR] 'Fetch error:' [Error: HTTP 429]`
- Other websites still fetch titles correctly

## Root Cause

YouTube blocks/rate-limits server-side fetch requests from Convex backend. The `fetchPageTitle` action in `convex/actions.ts` cannot access YouTube pages due to:
1. Rate limiting (HTTP 429)
2. Bot detection
3. Server-side requests being blocked

## Attempted Solutions

### 1. Added User-Agent Header
```typescript
const response = await fetch(args.url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});
```
**Result:** Still rate-limited

### 2. Skip YouTube Fetching
```typescript
if (args.url.includes('youtube.com') || args.url.includes('youtu.be')) {
  return { title: '', domain: domain };
}
```
**Result:** Empty title, not user-friendly

### 3. Revert to Original
Removed all YouTube-specific code, back to simple fetch.
**Result:** Still rate-limited (429 error)

## Possible Solutions

### Option 1: Client-Side Fetching (Recommended)
Instead of fetching from Convex backend, fetch the title from the browser:
- Use a CORS proxy or YouTube API
- Extract title from page in browser before sending to backend
- Avoids server-side rate limiting

### Option 2: YouTube Data API
Use official YouTube Data API v3:
- Requires API key
- Has quota limits (10,000 units/day)
- More reliable than scraping
- Extract video ID from URL and fetch metadata

### Option 3: Manual Entry
For YouTube links, don't auto-fetch:
- Show placeholder "Enter video title"
- User manually enters the title
- Simple but requires extra step

### Option 4: Use YouTube oEmbed API
```javascript
fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
```
- Official YouTube endpoint
- No API key required
- Returns title and thumbnail
- May still have rate limits

## Recommended Implementation

**Use YouTube oEmbed API (Option 4) with fallback:**

```typescript
// In convex/actions.ts
if (args.url.includes('youtube.com') || args.url.includes('youtu.be')) {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(args.url)}&format=json`;
    const response = await fetch(oembedUrl);
    const data = await response.json();
    return {
      title: data.title || domain,
      domain: domain,
      thumbnail: data.thumbnail_url
    };
  } catch (error) {
    // Fallback to manual entry
    return { title: 'YouTube Video', domain: domain };
  }
}
```

## Files Involved

- `convex/actions.ts` - Backend fetch logic
- `links-handler.js` - Frontend that calls the action
- Line ~835-845 in `links-handler.js`

## Testing Steps

1. Run `npx convex dev`
2. Add a YouTube video URL
3. Check if title is fetched correctly
4. Monitor console for 429 errors

## Notes

- The issue appeared after implementing YouTube channel icon detection
- YouTube channel icon feature has been removed
- Rate limiting persists even after reverting changes
- May need to wait for rate limit to reset or use different approach
- Other websites (non-YouTube) still work fine

## Status

🔴 **BROKEN** - YouTube titles not fetching, shows "youtube.com" instead
