import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

const DEFAULT_SETTINGS = {
  unchecked_tournaments: [],
  theme: "dark",
  per_page: "50",
  scrape_start: 1,
  scrape_end: 5,
  filter_year: "all",
  filter_custom_series: [],
  tournament_order: {},
  tourney_sort_order: "none",
  white_logo_teams: [],
  white_logo_bg_color: "#eef1f6",
  tournament_colors: {},
  highlight_loaded_tournaments: false,
  thr_show_all_tournaments: false,
};

export const get = query({
  args: {},
  handler: async (ctx) => {
    const record = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "user_settings"))
      .first();
    return record ? { ...DEFAULT_SETTINGS, ...record.data } : DEFAULT_SETTINGS;
  },
});

export const save = mutation({
  args: { settings: v.any() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "user_settings"))
      .first();
    if (record) {
      await ctx.db.patch(record._id, { data: args.settings });
    } else {
      await ctx.db.insert("settings", { key: "user_settings", data: args.settings });
    }
    return { status: "success", settings: args.settings };
  },
});
