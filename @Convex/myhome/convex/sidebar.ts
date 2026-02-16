import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const buttonValidator = v.object({
  id: v.string(),
  name: v.string(),
  display_type: v.string(),
  icon_class: v.optional(v.string()),
  img_src: v.optional(v.string()),
  url: v.string(),
  has_notification: v.optional(v.boolean()),
  notification_api: v.optional(v.string()),
  mark_seen_api: v.optional(v.string()),
  text_color: v.optional(v.string()),
  bg_color: v.optional(v.string()),
  hover_color: v.optional(v.string()),
  border_color: v.optional(v.string()),
  border_radius: v.optional(v.string()),
  font_size: v.optional(v.string()),
  order: v.optional(v.number()),
});

export const getButtons = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("sidebar_buttons").order("asc").collect();
  },
});

export const addButton = mutation({
  args: { button: buttonValidator },
  handler: async (ctx, args) => {
    const buttons = await ctx.db.query("sidebar_buttons").collect();
    const maxOrder = Math.max(...buttons.map(b => b.order || 0), 0);
    
    await ctx.db.insert("sidebar_buttons", {
      ...args.button,
      order: maxOrder + 1,
    });
  },
});

export const updateButton = mutation({
  args: { 
    id: v.id("sidebar_buttons"),
    button: buttonValidator 
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, args.button);
  },
});

export const deleteButton = mutation({
  args: { id: v.id("sidebar_buttons") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
