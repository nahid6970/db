import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("ignorelist").collect();
    return items.map((item) => ({ name: item.name, logo: item.logo || "" }));
  },
});

export const add = mutation({
  args: {
    items: v.array(v.object({ name: v.string(), logo: v.optional(v.string()) })),
  },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      if (!item.name) continue;
      const existing = await ctx.db
        .query("ignorelist")
        .withIndex("by_name", (q) => q.eq("name", item.name))
        .first();
      if (!existing) {
        await ctx.db.insert("ignorelist", { name: item.name, logo: item.logo || "" });
      }
    }
    const all = await ctx.db.query("ignorelist").collect();
    return all.map((i) => ({ name: i.name, logo: i.logo || "" }));
  },
});

export const remove = mutation({
  args: { tournament: v.string() },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("ignorelist")
      .withIndex("by_name", (q) => q.eq("name", args.tournament))
      .collect();
    for (const item of items) {
      await ctx.db.delete(item._id);
    }
    const all = await ctx.db.query("ignorelist").collect();
    return all.map((i) => ({ name: i.name, logo: i.logo || "" }));
  },
});
