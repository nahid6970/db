import { action } from "./_generated/server";
import { v } from "convex/values";

export const fetchPageTitle = action({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const urlObj = new URL(args.url);
    const domain = urlObj.hostname.replace('www.', '');
    
    try {
      // Special handling for YouTube to avoid 429 rate limiting
      if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
        try {
          const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(args.url)}&format=json`;
          const response = await fetch(oembedUrl);
          if (response.ok) {
            const data = await response.json();
            return {
              title: data.title || domain,
              domain: domain,
              channelIcon: data.thumbnail_url // Use video thumbnail as icon if title is fetched
            };
          }
        } catch (e) {
          console.warn('YouTube oEmbed fetch failed, falling back to direct fetch', e);
        }
      }

      const response = await fetch(args.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const html = await response.text();
      
      // Extract title from HTML
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : null;
      
      // Extract YouTube channel icon if it's a YouTube channel (only if not already handled by oEmbed)
      let channelIcon = null;
      if (domain.includes('youtube.com') && (args.url.includes('/@') || args.url.includes('/channel/') || args.url.includes('/c/'))) {
        const iconMatch = html.match(/"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/);
        if (iconMatch) {
          channelIcon = iconMatch[1];
        }
      }
      
      return {
        title: title || domain,
        domain: domain,
        channelIcon: channelIcon
      };
    } catch (error) {
      console.error('Fetch error:', error);
      return {
        title: domain,
        domain: domain,
        channelIcon: null
      };
    }
  },
});
