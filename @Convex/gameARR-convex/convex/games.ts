import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("games").collect();
  },
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const games = await ctx.db.query("games").collect();
    return games.filter(game => 
      game.name.toLowerCase().includes(args.query.toLowerCase())
    );
  },
});

export const add = mutation({
  args: { 
    name: v.string(), 
    year: v.optional(v.string()),
    image: v.optional(v.string()),
    rating: v.optional(v.number()),
    progression: v.optional(v.string()),
    url: v.optional(v.string()),
    collection: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("games", { 
      name: args.name,
      year: args.year || "",
      image: args.image || "",
      rating: args.rating || 0,
      progression: args.progression || "Unplayed🆕",
      url: args.url || "",
      collection: args.collection || ""
    });
  },
});

export const update = mutation({
  args: { 
    id: v.id("games"),
    name: v.optional(v.string()),
    year: v.optional(v.string()),
    image: v.optional(v.string()),
    rating: v.optional(v.number()),
    progression: v.optional(v.string()),
    url: v.optional(v.string()),
    collection: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("games") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
