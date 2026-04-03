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
      // Normalize URL using URL constructor to handle all special characters correctly
      let targetUrl = args.url.trim();
      try {
        const tempUrl = new URL(targetUrl);
        targetUrl = tempUrl.href;
      } catch (e) {
        console.warn('URL normalization failed, using original:', targetUrl);
      }
      
      let response;
      try {
        // Try with browser headers first
        response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          }
        });

        // If we get a 400 or other error, try one more time WITHOUT special headers
        // Some servers (like Facebook's edge) reject requests if headers look "suspicious"
        if (!response.ok && (response.status === 400 || response.status === 403)) {
          response = await fetch(targetUrl);
        }
      } catch (e) {
        console.error('Fetch attempt failed:', e);
        // Last ditch effort: try without headers if the whole fetch threw
        response = await fetch(targetUrl);
      }
      
      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'No body');
        console.error(`Fetch failed with ${response.status}: ${errorBody.substring(0, 200)}`);
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

      // General og:image and twitter:image extraction
      if (!channelIcon) {
        const patterns = [
          /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
          /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
          /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
          /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i,
          /<link[^>]*rel=["']image_src["'][^>]*href=["']([^"']+)["']/i,
          /<meta[^>]*itemprop=["']image["'][^>]*content=["']([^"']+)["']/i
        ];

        for (const pattern of patterns) {
          const match = html.match(pattern);
          if (match && match[1]) {
            channelIcon = match[1];
            channelIcon = channelIcon.replace(/&amp;/g, '&');
            break;
          }
        }
      }

      // 4. Facebook specific handling (SVG, Profiles, and JSON patterns)
      if (domain.includes('facebook.com')) {
        const fbPatterns = [
          // SVG image tag (common for profile pics in newer FB UI)
          /<image[^>]*xlink:href=["']([^"']+)["']/i,
          /<image[^>]*href=["']([^"']+)["']/i,
          // JSON patterns (common in script tags)
          /"profile_pic":\{"uri":"([^"]+)"/,
          /"group_icon":\{"uri":"([^"]+)"/,
          /"image":\{"uri":"([^"]+)"/,
          /"Thumbnail":\{"uri":"([^"]+)"/
        ];

        if (!channelIcon) {
          for (const pattern of fbPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
              channelIcon = match[1].replace(/\\/g, '').replace(/&amp;/g, '&');
              break;
            }
          }
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
