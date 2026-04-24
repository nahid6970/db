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
      const folders = await ctx.db.query("folders").collect();
      const protectedFolderIds = new Set(
        folders.filter((folder) => folder.password).map((folder) => String(folder._id))
      );
      images = (await ctx.db.query("images").collect()).filter(
        (image) => !image.folderId || !protectedFolderIds.has(image.folderId)
      );
    }

    return images.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.timestamp - a.timestamp;
    });
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
      pinned: false,
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
      const folders = await ctx.db.query("folders").collect();
      const protectedFolderIds = new Set(
        folders.filter((folder) => folder.password).map((folder) => String(folder._id))
      );
      images = (await ctx.db.query("images").collect()).filter(
        (image) => !image.folderId || !protectedFolderIds.has(image.folderId)
      );
    }

    for (const img of images) {
      if (!img.pinned) {
        await ctx.db.delete(img._id);
      }
    }
  },
});

export const togglePin = mutation({
  args: { id: v.id("images") },
  handler: async (ctx, args) => {
    const image = await ctx.db.get(args.id);
    if (!image) {
      return;
    }

    await ctx.db.patch(args.id, {
      pinned: !image.pinned,
    });
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
      password: undefined,
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

export const setFolderPassword = mutation({
  args: {
    id: v.id("folders"),
    password: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      password: args.password,
    });
  },
});

export const removeFolder = mutation({
  args: { id: v.id("folders"), password: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.id);
    if (!folder) {
      return;
    }

    if (folder.password && folder.password !== args.password) {
      throw new Error("Incorrect folder password.");
    }

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
