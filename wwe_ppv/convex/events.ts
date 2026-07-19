import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const list = await ctx.db.query("events").collect();
    // Map _id and eventId to structure expected by frontend (like id)
    return list.map(e => ({
      ...e,
      id: e.eventId
    }));
  },
});

export const insertOrUpdate = mutation({
  args: {
    eventId: v.string(),
    name: v.string(),
    date_str: v.string(),
    venue: v.string(),
    location: v.string(),
    notes: v.string(),
    status: v.string(),
    logo_url: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("events")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        date_str: args.date_str,
        venue: args.venue,
        location: args.location,
        status: args.status,
        logo_url: args.logo_url,
      });
    } else {
      await ctx.db.insert("events", {
        ...args,
        seen: 0,
        hidden: 0,
      });
    }
  },
});

export const toggleSeen = mutation({
  args: { eventId: v.string(), seen: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("events")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { seen: args.seen });
    }
  },
});

export const toggleHidden = mutation({
  args: { eventId: v.string(), hidden: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("events")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { hidden: args.hidden });
    }
  },
});
