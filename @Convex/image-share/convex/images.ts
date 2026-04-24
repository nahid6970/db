import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { folderId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let images;

    if (args.folderId === "none") {
      images = await ctx.db
        .query("images")
        .filter((q) => q.eq(q.field("folderId"), undefined))
        .collect();
    } else if (args.folderId) {
      images = await ctx.db
        .query("images")
        .filter((q) => q.eq(q.field("folderId"), args.folderId))
        .collect();
    } else {
      images = await ctx.db.query("images").collect();
    }

    return images.sort((a, b) => b.timestamp - a.timestamp);
  },
});

export const add = mutation({
  args: { 
    url: v.string(), 
    filename: v.string(),
    folderId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("images", { 
      url: args.url,
      filename: args.filename,
      timestamp: Date.now(),
      folderId: args.folderId,
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
  args: { folderId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let images;

    if (args.folderId === "none") {
      images = await ctx.db
        .query("images")
        .filter((q) => q.eq(q.field("folderId"), undefined))
        .collect();
    } else if (args.folderId) {
      images = await ctx.db
        .query("images")
        .filter((q) => q.eq(q.field("folderId"), args.folderId))
        .collect();
    } else {
      images = await ctx.db.query("images").collect();
    }

    for (const img of images) {
      await ctx.db.delete(img._id);
    }
  },
});

export const moveToFolder = mutation({
  args: { imageId: v.id("images"), folderId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.imageId, { folderId: args.folderId });
  },
});

export const listFolders = query({
  args: {},
  handler: async (ctx) => {
    const folders = await ctx.db.query("folders").collect();
    return folders.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  },
});

export const createFolder = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const folders = await ctx.db.query("folders").collect();
    const maxPosition = folders.reduce(
      (max, folder) => Math.max(max, folder.position ?? 0),
      -1
    );

    return await ctx.db.insert("folders", {
      name: args.name,
      position: maxPosition + 1,
    });
  },
});

export const updateFolder = mutation({
  args: {
    id: v.id("folders"),
    name: v.string(),
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      name: args.name,
      position: args.position,
    });
  },
});

export const removeFolder = mutation({
  args: { id: v.id("folders") },
  handler: async (ctx, args) => {
    const images = await ctx.db
      .query("images")
      .filter((q) => q.eq(q.field("folderId"), args.id))
      .collect();

    for (const image of images) {
      await ctx.db.patch(image._id, { folderId: undefined });
    }

    await ctx.db.delete(args.id);
  },
});
