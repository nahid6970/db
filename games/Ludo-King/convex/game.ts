import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getGameState = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("game_state").order("desc").first();
  },
});

export const setState = mutation({
  args: { patch: v.any() },
  handler: async (ctx, args) => {
    const state = await ctx.db.query("game_state").order("desc").first();
    if (state) {
      await ctx.db.patch(state._id, { ...args.patch, timestamp: Date.now() });
    } else {
      await ctx.db.insert("game_state", { ...args.patch, timestamp: Date.now() });
    }
  },
});
