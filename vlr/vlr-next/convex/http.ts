import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

/**
 * POST /ingest-matches
 * Body: { secret: string, matches: MatchObject[] }
 *
 * The Python scraper posts batches of scraped matches here.
 * Protected by a shared secret stored in CONVEX_SECRET env var.
 */
http.route({
  path: "/ingest-matches",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Validate secret
    const secret = process.env.CONVEX_SECRET;
    if (secret) {
      const auth = request.headers.get("x-convex-secret");
      if (auth !== secret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    let body: { matches?: unknown[] };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const matches = body.matches;
    if (!Array.isArray(matches) || matches.length === 0) {
      return new Response(JSON.stringify({ error: "No matches provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await ctx.runMutation(api.matches.bulkUpsert, { matches });

    return new Response(
      JSON.stringify({ ok: true, count: matches.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }),
});

/**
 * POST /upsert-match
 * Body: { secret: string, match: MatchObject }
 *
 * Used by the scraper to push a single fully-detailed match (with maps/players).
 */
http.route({
  path: "/upsert-match",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.CONVEX_SECRET;
    if (secret) {
      const auth = request.headers.get("x-convex-secret");
      if (auth !== secret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    let body: { match?: unknown };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!body.match) {
      return new Response(JSON.stringify({ error: "No match provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await ctx.runMutation(api.matches.upsertOne, { match: body.match });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
