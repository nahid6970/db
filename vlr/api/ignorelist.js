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
    const action = url.searchParams.get("action");

    if (req.method === "POST" && action === "add") {
      const items = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const updated = await client.mutation(api.ignorelist.add, { items });
      return res.status(200).json({ status: "success", ignorelist: updated });
    } else if (req.method === "POST" && action === "remove") {
      const data = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const updated = await client.mutation(api.ignorelist.remove, { tournament: data.tournament || "" });
      return res.status(200).json({ status: "success", ignorelist: updated });
    } else {
      const list = await client.query(api.ignorelist.get, {});
      return res.status(200).json(list);
    }
  } catch (err) {
    console.error("API /api/ignorelist error:", err);
    return res.status(500).json({ error: err.message });
  }
}
