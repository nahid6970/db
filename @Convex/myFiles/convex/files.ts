import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("files").order("desc").collect();
  },
});

export const add = mutation({
  args: { 
    url: v.string(), 
    filename: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("files", { 
      url: args.url,
      filename: args.filename,
      fileType: args.fileType,
      fileSize: args.fileSize,
      timestamp: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("files") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const files = await ctx.db.query("files").collect();
    for (const file of files) {
      await ctx.db.delete(file._id);
    }
  },
});
