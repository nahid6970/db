import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const importLinks = mutation({
  args: { links: v.any() },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.links.length; i++) {
      await ctx.db.insert("links", {
        ...args.links[i],
        order: i
      });
    }
  },
});
