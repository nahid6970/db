import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

export default async function handler(req, res) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!convexUrl) {
    return res.status(500).json({ error: "CONVEX_URL is not configured in Vercel environment variables" });
  }
  const client = new ConvexHttpClient(convexUrl);

  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const action = url.searchParams.get("action");
    const loadMissing = url.searchParams.get("load_missing") === "true";
    const startPage = parseInt(url.searchParams.get("start") || "1");
    const endPage = parseInt(url.searchParams.get("end") || "5");

    if (action === "all" || url.pathname.endsWith("/all")) {
      const allMatches = await client.query(api.matches.getAll, {});
      return res.status(200).json(allMatches);
    }

    if (req.method === "GET" && action !== "view" && !url.pathname.endsWith("/view")) {
      await client.action(api.scraper.sync, { startPage, endPage, loadMissing });
    }

    const settings = await client.query(api.settings.get, {});
    const ignorelist = await client.query(api.ignorelist.get, {});
    const ignoreNames = ignorelist.map((i) => i.name);

    const matches = await client.query(api.matches.getDisplayMatches, {
      uncheckedTournaments: settings.unchecked_tournaments || [],
      ignoreNames,
    });

    return res.status(200).json(matches);
  } catch (err) {
    console.error("API /api/matches error:", err);
    return res.status(500).json({ error: err.message });
  }
}
