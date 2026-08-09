import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Return all matches (used by frontend live subscription). */
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("matches").collect();
  },
});

/** Return a single match by VLR match ID. */
export const getById = query({
  args: { match_id: v.string() },
  handler: async (ctx, { match_id }) => {
    return await ctx.db
      .query("matches")
      .withIndex("by_match_id", (q) => q.eq("match_id", match_id))
      .unique();
  },
});

/** Return a lightweight tournament overview (used by sidebar). */
export const tournamentOverview = query({
  handler: async (ctx) => {
    const matches = await ctx.db.query("matches").collect();
    const map: Record<
      string,
      { tournament_logo: string; first_match: number; missing_stats: number }
    > = {};

    const now = Date.now() / 1000;

    for (const m of matches) {
      const t = m.tournament;
      if (!t) continue;
      if (!map[t]) {
        map[t] = { tournament_logo: m.tournament_logo ?? "", first_match: m.unix_timestamp ?? 0, missing_stats: 0 };
      }
      // Track earliest match
      if ((m.unix_timestamp ?? 0) < map[t].first_match) {
        map[t].first_match = m.unix_timestamp ?? 0;
      }
      // Keep best logo
      if (!map[t].tournament_logo && m.tournament_logo) {
        map[t].tournament_logo = m.tournament_logo;
      }
      // Count missing stats
      const status = (m.status ?? "").toLowerCase();
      const hasMaps = Array.isArray(m.maps) && m.maps.length > 0;
      const hasPlayers =
        m.players &&
        typeof m.players === "object" &&
        Object.keys(m.players).length > 0 &&
        "all" in m.players;
      if (status === "completed" && (!hasMaps || !hasPlayers)) {
        map[t].missing_stats++;
      } else if (
        ["upcoming", "live"].includes(status) &&
        ((m.unix_timestamp ?? 0) <= now || !(m.unix_timestamp ?? 0))
      ) {
        map[t].missing_stats++;
      }
    }

    return Object.entries(map).map(([tournament, data]) => ({
      tournament,
      tournament_logo: data.tournament_logo,
      first_match: data.first_match,
      fully_loaded: data.missing_stats === 0,
    }));
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Bulk upsert matches from the scraper. Preserves existing logos/stats if new data is empty. */
export const bulkUpsert = mutation({
  args: { matches: v.array(v.any()) },
  handler: async (ctx, { matches }) => {
    for (const m of matches) {
      const id = String(m.match_id ?? m.id ?? "");
      if (!id) continue;

      const existing = await ctx.db
        .query("matches")
        .withIndex("by_match_id", (q) => q.eq("match_id", id))
        .unique();

      // Build payload, preserving existing logos/stats when incoming is empty
      const payload = {
        match_id: id,
        href: m.href ?? existing?.href ?? "",
        date: m.date ?? existing?.date ?? "",
        time: m.time ?? existing?.time ?? "",
        team1: m.team1 ?? existing?.team1 ?? "",
        team2: m.team2 ?? existing?.team2 ?? "",
        score1: m.score1 ?? existing?.score1 ?? "",
        score2: m.score2 ?? existing?.score2 ?? "",
        tournament: m.tournament ?? existing?.tournament ?? "",
        series: m.series ?? existing?.series ?? "",
        tournament_logo: m.tournament_logo || existing?.tournament_logo || "",
        eta: m.eta ?? existing?.eta ?? "",
        status: m.status ?? existing?.status ?? "Upcoming",
        team1_logo: m.team1_logo || existing?.team1_logo || "",
        team2_logo: m.team2_logo || existing?.team2_logo || "",
        unix_timestamp: m.unix_timestamp || existing?.unix_timestamp || 0,
        bst_time: m.bst_time || existing?.bst_time || "",
        maps: (Array.isArray(m.maps) && m.maps.length > 0)
          ? m.maps
          : existing?.maps ?? [],
        players:
          m.players && typeof m.players === "object" && Object.keys(m.players).length > 0
            ? m.players
            : existing?.players ?? {},
        last_updated: m.last_updated ?? Math.floor(Date.now() / 1000),
      };

      if (existing) {
        await ctx.db.patch(existing._id, payload);
      } else {
        await ctx.db.insert("matches", payload);
      }
    }
  },
});

/** Full update for a single match (used by match detail fetch). */
export const upsertOne = mutation({
  args: { match: v.any() },
  handler: async (ctx, { match }) => {
    const id = String(match.match_id ?? match.id ?? "");
    if (!id) return;

    const existing = await ctx.db
      .query("matches")
      .withIndex("by_match_id", (q) => q.eq("match_id", id))
      .unique();

    const payload = {
      ...existing,
      ...match,
      match_id: id,
      team1_logo: match.team1_logo || existing?.team1_logo || "",
      team2_logo: match.team2_logo || existing?.team2_logo || "",
      tournament_logo: match.tournament_logo || existing?.tournament_logo || "",
      maps: (Array.isArray(match.maps) && match.maps.length > 0) ? match.maps : (existing?.maps ?? []),
      players: (match.players && typeof match.players === "object" && Object.keys(match.players).length > 0) ? match.players : (existing?.players ?? {}),
      last_updated: Math.floor(Date.now() / 1000),
    };
    delete payload.id;
    delete payload._id;
    delete payload._creationTime;

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("matches", payload);
    }
  },
});
