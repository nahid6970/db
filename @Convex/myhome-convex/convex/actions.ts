import { action } from "./_generated/server";
import { v } from "convex/values";

export const fetchPageTitle = action({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const urlObj = new URL(args.url);
    const domain = urlObj.hostname.replace('www.', '');
    
    try {
      // 1. Try oEmbed for YouTube (best for titles and thumbnails)
      if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
        try {
          const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(args.url)}&format=json`;
          const response = await fetch(oembedUrl);
          if (response.ok) {
            const data = await response.json();
            return {
              title: data.title || domain,
              domain: domain,
              channelIcon: data.thumbnail_url
            };
          }
        } catch (e) {
          console.warn('YouTube oEmbed fetch failed', e);
        }
      }

      // 2. Fallback to direct fetch
      const response = await fetch(args.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const html = await response.text();
      
      // Extract title from HTML
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : null;
      
      let channelIcon = null;

      // 3. Specific icon extraction logic
      
      // YouTube Channel Icon (if not handled by oEmbed)
      if (domain.includes('youtube.com') && (args.url.includes('/@') || args.url.includes('/channel/') || args.url.includes('/c/'))) {
        const iconMatch = html.match(/"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/);
        if (iconMatch) {
          channelIcon = iconMatch[1];
        }
      }
      
      // GitHub Icon (Owner avatar)
      if (!channelIcon && domain.includes('github.com')) {
        const parts = urlObj.pathname.split('/').filter(p => p);
        if (parts.length >= 1) {
          channelIcon = `https://github.com/${parts[0]}.png`;
        }
      }

      // General og:image extraction (covers Facebook, Chrome Web Store, and many others)
      if (!channelIcon) {
        const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i) || 
                             html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/i);
        if (ogImageMatch) {
          channelIcon = ogImageMatch[1];
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
