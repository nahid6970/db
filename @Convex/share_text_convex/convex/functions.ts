import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { folderId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let texts;
    if (args.folderId === "none") {
      texts = await ctx.db
        .query("texts")
        .filter((q) => q.eq(q.field("folderId"), undefined))
        .collect();
    } else if (args.folderId) {
      texts = await ctx.db
        .query("texts")
        .filter((q) => q.eq(q.field("folderId"), args.folderId))
        .collect();
    } else {
      texts = await ctx.db.query("texts").collect();
    }
    
    return texts.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.timestamp - a.timestamp;
    });
  },
});

export const add = mutation({
  args: { 
    text: v.string(),
    color: v.optional(v.string()),
    bgColor: v.optional(v.string()),
    folderId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("texts", {
      text: args.text,
      timestamp: Date.now(),
      pinned: false,
      color: args.color,
      bgColor: args.bgColor,
      folderId: args.folderId
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
  args: { 
    id: v.id("texts"), 
    text: v.string(),
    color: v.optional(v.string()),
    bgColor: v.optional(v.string()),
    folderId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { 
      text: args.text,
      color: args.color,
      bgColor: args.bgColor,
      folderId: args.folderId
    });
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
  args: { folderId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let all;
    if (args.folderId === "none") {
      all = await ctx.db.query("texts").filter(q => q.eq(q.field("folderId"), undefined)).collect();
    } else if (args.folderId) {
      all = await ctx.db.query("texts").filter(q => q.eq(q.field("folderId"), args.folderId)).collect();
    } else {
      all = await ctx.db.query("texts").collect();
    }
    for (const item of all) {
      await ctx.db.delete(item._id);
    }
  },
});

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("settings").unique();
    return settings || { customSyntaxes: [] };
  },
});

export const updateSettings = mutation({
  args: { customSyntaxes: v.array(v.object({ 
    trigger: v.string(), 
    color: v.string(),
    bgColor: v.optional(v.string()),
    description: v.optional(v.string())
  })) },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("settings").unique();
    if (existing) {
      await ctx.db.patch(existing._id, { customSyntaxes: args.customSyntaxes });
    } else {
      await ctx.db.insert("settings", { customSyntaxes: args.customSyntaxes });
    }
  },
});

// Folder Logic
export const listFolders = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("folders").collect();
  },
});

export const createFolder = mutation({
  args: { 
    name: v.string(),
    color: v.optional(v.string()),
    bgColor: v.optional(v.string()),
    borderColor: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("folders", { 
      name: args.name,
      color: args.color,
      bgColor: args.bgColor,
      borderColor: args.borderColor
    });
  },
});

export const updateFolder = mutation({
  args: { 
    id: v.id("folders"),
    name: v.string(),
    color: v.optional(v.string()),
    bgColor: v.optional(v.string()),
    borderColor: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { 
      name: args.name,
      color: args.color,
      bgColor: args.bgColor,
      borderColor: args.borderColor
    });
  },
});

export const removeFolder = mutation({
  args: { id: v.id("folders") },
  handler: async (ctx, args) => {
    // Optionally move notes to "All" or delete them.
    // Let's set their folderId to undefined.
    const notes = await ctx.db.query("texts").filter(q => q.eq(q.field("folderId"), args.id)).collect();
    for (const note of notes) {
      await ctx.db.patch(note._id, { folderId: undefined });
    }
    await ctx.db.delete(args.id);
  },
});

export const moveToFolder = mutation({
  args: { textId: v.id("texts"), folderId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.textId, { folderId: args.folderId });
  },
});
