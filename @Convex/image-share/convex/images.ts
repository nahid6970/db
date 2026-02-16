import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("images").order("desc").collect();
  },
});

export const add = mutation({
  args: { 
    url: v.string(), 
    filename: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("images", { 
      url: args.url,
      filename: args.filename,
      timestamp: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("images") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const images = await ctx.db.query("images").collect();
    for (const img of images) {
      await ctx.db.delete(img._id);
    }
  },
});
