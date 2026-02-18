import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  files: defineTable({
    storageId: v.optional(v.string()),
    url: v.optional(v.string()),
    filename: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    timestamp: v.number(),
    pinned: v.optional(v.boolean()),
    order: v.optional(v.number()),
    group: v.optional(v.string()),
  }),
});
