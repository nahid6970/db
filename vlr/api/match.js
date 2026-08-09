import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

export default async function handler(req, res) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!convexUrl) {
    return res.status(500).json({ error: "CONVEX_URL is not configured" });
  }
  const client = new ConvexHttpClient(convexUrl);

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const id = url.searchParams.get("id") || url.pathname.split("/").pop();
    const refresh = url.searchParams.get("refresh") === "true";

    if (!id) {
      return res.status(400).json({ error: "Match ID required" });
    }

    let match = await client.query(api.matches.getById, { id });

    if (refresh || !match || !match.maps || match.maps.length === 0) {
      if (match?.href) {
        const details = await client.action(api.scraper.scrapeDetail, { href: match.href });
        if (details) {
          match = { ...match, ...details };
        }
      }
    }

    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }

    return res.status(200).json(match);
  } catch (err) {
    console.error("API /api/match error:", err);
    return res.status(500).json({ error: err.message });
  }
}
