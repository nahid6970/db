import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const texts = await ctx.db.query("texts").collect();
    return texts.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.timestamp - a.timestamp;
    });
  },
});

export const add = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("texts", {
      text: args.text,
      timestamp: Date.now(),
      pinned: false,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("texts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const update = mutation({
  args: { id: v.id("texts"), text: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { text: args.text });
  },
});

export const togglePin = mutation({
  args: { id: v.id("texts") },
  handler: async (ctx, args) => {
    const text = await ctx.db.get(args.id);
    if (text) {
      await ctx.db.patch(args.id, { pinned: !text.pinned });
    }
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
