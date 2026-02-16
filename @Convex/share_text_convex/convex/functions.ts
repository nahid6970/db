import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("texts").order("desc").collect();
  },
});

export const add = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("texts", {
      text: args.text,
      timestamp: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("texts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const clean = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("texts").collect();
    for (const item of all) {
      await ctx.db.delete(item._id);
    }
  },
});
