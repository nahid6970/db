import { action } from "./_generated/server";
import { v } from "convex/values";

export const fetchPageTitle = action({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    try {
      const response = await fetch(args.url);
      const html = await response.text();
      
      // Extract title from HTML
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : null;
      
      // Extract YouTube channel icon if it's a YouTube channel
      let channelIcon = null;
      if (args.url.includes('youtube.com') && (args.url.includes('/@') || args.url.includes('/channel/') || args.url.includes('/c/'))) {
        const iconMatch = html.match(/"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/);
        if (iconMatch) {
          channelIcon = iconMatch[1];
        }
      }
      
      // Extract domain as fallback
      const urlObj = new URL(args.url);
      const domain = urlObj.hostname.replace('www.', '');
      
      return {
        title: title || domain,
        domain: domain,
        channelIcon: channelIcon
      };
    } catch (error) {
      // If fetch fails, return domain from URL
      const urlObj = new URL(args.url);
      const domain = urlObj.hostname.replace('www.', '');
      return {
        title: domain,
        domain: domain,
        channelIcon: null
      };
    }
  },
});
