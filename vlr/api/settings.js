import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

export default async function handler(req, res) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!convexUrl) {
    return res.status(500).json({ error: "CONVEX_URL is not configured" });
  }
  const client = new ConvexHttpClient(convexUrl);

  try {
    if (req.method === "POST") {
      const data = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const result = await client.mutation(api.settings.save, { settings: data });
      return res.status(200).json(result);
    } else {
      const settings = await client.query(api.settings.get, {});
      return res.status(200).json(settings);
    }
  } catch (err) {
    console.error("API /api/settings error:", err);
    return res.status(500).json({ error: err.message });
  }
}
