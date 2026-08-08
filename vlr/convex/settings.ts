import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const SETTINGS_KEY = "global";

// ─── Settings ─────────────────────────────────────────────────────────────────

export const getSettings = query({
  handler: async (ctx) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique();
    return (
      row ?? {
        key: SETTINGS_KEY,
        unchecked_tournaments: [],
        white_logo_teams: [],
        tournament_colors: {},
        tournament_order: {},
        highlight_loaded_tournaments: false,
        thr_show_all_tournaments: false,
        scrape_start: 1,
        scrape_end: 5,
        per_page: "50",
        theme: "dark",
      }
    );
  },
});

export const saveSettings = mutation({
  args: { settings: v.any() },
  handler: async (ctx, { settings }) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique();

    const payload = { ...settings, key: SETTINGS_KEY };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("settings", payload);
    }
  },
});

// ─── Ignore List ──────────────────────────────────────────────────────────────

export const getIgnorelist = query({
  handler: async (ctx) => {
    return await ctx.db.query("ignorelist").collect();
  },
});

export const addToIgnorelist = mutation({
  args: { entries: v.array(v.object({ name: v.string(), logo: v.optional(v.string()) })) },
  handler: async (ctx, { entries }) => {
    for (const entry of entries) {
      const existing = await ctx.db
        .query("ignorelist")
        .withIndex("by_name", (q) => q.eq("name", entry.name))
        .unique();
      if (!existing) {
        await ctx.db.insert("ignorelist", { name: entry.name, logo: entry.logo ?? "" });
      }
    }
  },
});

export const removeFromIgnorelist = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const existing = await ctx.db
      .query("ignorelist")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
