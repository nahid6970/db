import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  events: defineTable({
    eventId: v.string(),
    name: v.string(),
    date_str: v.string(),
    venue: v.string(),
    location: v.string(),
    notes: v.string(),
    status: v.string(),
    logo_url: v.string(),
    seen: v.number(),
    hidden: v.number(),
  }).index("by_eventId", ["eventId"]),
});
