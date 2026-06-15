import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { folderId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let images;

    if (args.folderId === "shared") {
      images = await ctx.db
        .query("images")
        .filter((q) => q.eq(q.field("isShared"), true))
        .collect();
    } else if (args.folderId === "none") {
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
      const hiddenFolderIds = new Set(
        folders
          .filter((folder) => folder.password || folder.hideFromAll)
          .map((folder) => String(folder._id))
      );
      images = (await ctx.db.query("images").collect()).filter(
        (image) => !image.folderId || !hiddenFolderIds.has(image.folderId)
      );
    }

    return images.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.timestamp - a.timestamp;
    });
  },
});

export const toggleSharing = mutation({
  args: { id: v.id("images"), isShared: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isShared: args.isShared });
  },
});

export const add = mutation({
  args: { 
    url: v.string(), 
    filename: v.string(),
    fileSize: v.optional(v.number()),
    folderId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("images", { 
      url: args.url,
      filename: args.filename,
      fileSize: args.fileSize,
      timestamp: Date.now(),
      folderId: args.folderId,
      pinned: false,
    });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveStorageImage = mutation({
  args: { 
    storageId: v.id("_storage"), 
    filename: v.string(),
    fileSize: v.optional(v.number()),
    folderId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Failed to get storage URL");
    
    await ctx.db.insert("images", { 
      url,
      storageId: args.storageId,
      filename: args.filename,
      fileSize: args.fileSize,
      timestamp: Date.now(),
      folderId: args.folderId,
      pinned: false,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("images") },
  handler: async (ctx, args) => {
    const image = await ctx.db.get(args.id);
    if (image?.storageId) {
      await ctx.storage.delete(image.storageId);
    }
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
      const hiddenFolderIds = new Set(
        folders
          .filter((folder) => folder.password || folder.hideFromAll)
          .map((folder) => String(folder._id))
      );
      images = (await ctx.db.query("images").collect()).filter(
        (image) => !image.folderId || !hiddenFolderIds.has(image.folderId)
      );
    }

    for (const img of images) {
      if (!img.pinned) {
        if (img.storageId) {
          await ctx.storage.delete(img.storageId);
        }
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

export const renameImage = mutation({
  args: { id: v.id("images"), filename: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { filename: args.filename });
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
  args: { name: v.string(), parentId: v.optional(v.id("folders")) },
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
      parentId: args.parentId,
    });
  },
});

export const updateFolder = mutation({
  args: {
    id: v.id("folders"),
    name: v.string(),
    position: v.optional(v.number()),
    bgColor: v.optional(v.string()),
    fgColor: v.optional(v.string()),
    parentId: v.optional(v.id("folders")),
    fontBold: v.optional(v.boolean()),
    fontItalic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      name: args.name,
      position: args.position,
      bgColor: args.bgColor,
      fgColor: args.fgColor,
      parentId: args.parentId,
      fontBold: args.fontBold,
      fontItalic: args.fontItalic,
    });
  },
});

export const reorderFolders = mutation({
  args: {
    folderIds: v.array(v.id("folders")),
  },
  handler: async (ctx, args) => {
    await Promise.all(
      args.folderIds.map((id, index) =>
        ctx.db.patch(id, { position: index })
      )
    );
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

export const toggleHideFromAll = mutation({
  args: { id: v.id("folders") },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.id);
    if (!folder) return;
    await ctx.db.patch(args.id, {
      hideFromAll: !folder.hideFromAll,
    });
  },
});

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("settings").unique();
    return settings || { 
      storageType: "cloudinary",
      pdfStorageType: "cloudinary",
      megaEmail: "",
      megaPassword: "",
      megaSubfolder: "",
      sortOrder: "newest",
      currentFolderId: null,
      colors: {
        cloudinary: "#0369a1",
        convex: "#ec4899",
        mega: "#ef4444"
      }
    };
  },
});

export const updateSettings = mutation({
  args: { 
    storageType: v.string(),
    pdfStorageType: v.optional(v.string()),
    megaEmail: v.optional(v.string()),
    megaPassword: v.optional(v.string()),
    megaSubfolder: v.optional(v.string()),
    sortOrder: v.optional(v.string()),
    currentFolderId: v.optional(v.union(v.string(), v.null())),
    colors: v.optional(v.object({
      cloudinary: v.string(),
      convex: v.string(),
      mega: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("settings").unique();
    const data: Record<string, unknown> = {};

    if (args.storageType !== undefined) data.storageType = args.storageType;
    if (args.pdfStorageType !== undefined) data.pdfStorageType = args.pdfStorageType;
    if (args.megaEmail !== undefined) data.megaEmail = args.megaEmail;
    if (args.megaPassword !== undefined) data.megaPassword = args.megaPassword;
    if (args.megaSubfolder !== undefined) data.megaSubfolder = args.megaSubfolder;
    if (args.sortOrder !== undefined) data.sortOrder = args.sortOrder;
    if (args.currentFolderId !== undefined) data.currentFolderId = args.currentFolderId;
    if (args.colors !== undefined) data.colors = args.colors;

    if (settings) {
      await ctx.db.patch(settings._id, data);
    } else {
      await ctx.db.insert("settings", {
        storageType: args.storageType,
        pdfStorageType: args.pdfStorageType || args.storageType,
        megaEmail: args.megaEmail || "",
        megaPassword: args.megaPassword || "",
        megaSubfolder: args.megaSubfolder || "",
        sortOrder: args.sortOrder || "newest",
        currentFolderId: args.currentFolderId ?? null,
        colors: args.colors,
      });
    }
  },
});
