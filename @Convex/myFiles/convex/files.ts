import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const files = await ctx.db.query("files").order("desc").collect();
    return files.sort((a, b) => {
      if (a.pinned !== b.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      return (a.order || 0) - (b.order || 0);
    });
  },
});

export const add = mutation({
  args: { 
    storageId: v.optional(v.string()),
    url: v.optional(v.string()), 
    filename: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("files", { 
      storageId: args.storageId,
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
    const file = await ctx.db.get(args.id);
    if (file?.storageId) {
      await ctx.storage.delete(file.storageId);
    }
    await ctx.db.delete(args.id);
  },
});

export const togglePin = mutation({
  args: { id: v.id("files") },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.id);
    await ctx.db.patch(args.id, { pinned: !file?.pinned });
  },
});

export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const files = await ctx.db.query("files").collect();
    for (const file of files) {
      if (!file.pinned) {
        if (file.storageId) {
          await ctx.storage.delete(file.storageId);
        }
        await ctx.db.delete(file._id);
      }
    }
  },
});

export const reorder = mutation({
  args: { fileIds: v.array(v.id("files")) },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.fileIds.length; i++) {
      await ctx.db.patch(args.fileIds[i], { order: i });
    }
  },
});
