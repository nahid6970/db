import { query, mutation, internalMutation } from "./_generated/server.js";
import { v } from "convex/values";

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("matches").collect();
  },
});

export const getById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("matches")
      .withIndex("by_match_id", (q) => q.eq("id", args.id))
      .first();
  },
});

export const getDisplayMatches = query({
  args: {
    uncheckedTournaments: v.optional(v.array(v.string())),
    ignoreNames: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("matches").collect();
    const ignoreSet = new Set(args.ignoreNames || []);
    const uncheckedSet = new Set(args.uncheckedTournaments || []);

    const filtered = all.filter((m) => {
      if (!m.tournament) return true;
      if (ignoreSet.has(m.tournament)) return false;
      if (uncheckedSet.size > 0 && uncheckedSet.has(m.tournament)) return false;
      return true;
    });

    // Sort: Live first, Upcoming next (unix_timestamp asc), Completed last (unix_timestamp desc)
    filtered.sort((a, b) => {
      const getStatusOrder = (status?: string) => {
        if (status === "Live") return 1;
        if (status === "Upcoming") return 2;
        return 3;
      };
      const orderA = getStatusOrder(a.status);
      const orderB = getStatusOrder(b.status);
      if (orderA !== orderB) return orderA - orderB;

      const tsA = a.unix_timestamp || 0;
      const tsB = b.unix_timestamp || 0;
      return orderA === 3 ? tsB - tsA : tsA - tsB;
    });

    return filtered.map((m) => {
      let formatted_bst = "N/A";
      let js_timestamp = 0;
      if (m.unix_timestamp) {
        js_timestamp = m.unix_timestamp * 1000;
        const d = new Date(m.unix_timestamp * 1000 + 6 * 3600 * 1000);
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = months[d.getUTCMonth()];
        const day = String(d.getUTCDate()).padStart(2, "0");
        const year = d.getUTCFullYear();
        let hours = d.getUTCHours();
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;
        const mins = String(d.getUTCMinutes()).padStart(2, "0");
        formatted_bst = `${month} ${day}, ${year} - ${String(hours).padStart(2, "0")}:${mins} ${ampm}`;
      }
      return {
        ...m,
        formatted_bst,
        js_timestamp,
      };
    });
  },
});

export const bulkUpsert = mutation({
  args: { matches: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const match of args.matches) {
      if (!match.id) continue;
      const existing = await ctx.db
        .query("matches")
        .withIndex("by_match_id", (q) => q.eq("id", match.id))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          ...match,
          team1_logo: match.team1_logo || existing.team1_logo,
          team2_logo: match.team2_logo || existing.team2_logo,
          unix_timestamp: match.unix_timestamp || existing.unix_timestamp,
          bst_time: match.bst_time || existing.bst_time,
          maps: match.maps && match.maps.length ? match.maps : existing.maps,
          players: match.players && Object.keys(match.players).length ? match.players : existing.players,
          last_updated: Math.floor(Date.now() / 1000),
        });
      } else {
        await ctx.db.insert("matches", {
          ...match,
          last_updated: Math.floor(Date.now() / 1000),
        });
      }
    }
  },
});

export const internalBulkUpsert = internalMutation({
  args: { matches: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const match of args.matches) {
      if (!match.id) continue;
      const existing = await ctx.db
        .query("matches")
        .withIndex("by_match_id", (q) => q.eq("id", match.id))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          ...match,
          team1_logo: match.team1_logo || existing.team1_logo,
          team2_logo: match.team2_logo || existing.team2_logo,
          unix_timestamp: match.unix_timestamp || existing.unix_timestamp,
          bst_time: match.bst_time || existing.bst_time,
          maps: match.maps && match.maps.length ? match.maps : existing.maps,
          players: match.players && Object.keys(match.players).length ? match.players : existing.players,
          last_updated: Math.floor(Date.now() / 1000),
        });
      } else {
        await ctx.db.insert("matches", {
          ...match,
          last_updated: Math.floor(Date.now() / 1000),
        });
      }
    }
  },
});
