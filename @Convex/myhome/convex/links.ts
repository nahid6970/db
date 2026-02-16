import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const linkValidator = v.object({
  name: v.string(),
  url: v.optional(v.string()),
  title: v.optional(v.string()),
  group: v.optional(v.string()),
  click_action: v.optional(v.string()),
  default_type: v.optional(v.string()),
  icon_class: v.optional(v.string()),
  hidden: v.optional(v.boolean()),
  collapsible: v.optional(v.boolean()),
  display_style: v.optional(v.string()),
  horizontal_stack: v.optional(v.boolean()),
  password_protect: v.optional(v.boolean()),
  top_name: v.optional(v.string()),
  top_bg_color: v.optional(v.string()),
  top_text_color: v.optional(v.string()),
  top_border_color: v.optional(v.string()),
  top_hover_color: v.optional(v.string()),
  top_font_size: v.optional(v.string()),
  top_font_family: v.optional(v.string()),
  popup_bg_color: v.optional(v.string()),
  popup_text_color: v.optional(v.string()),
  popup_border_color: v.optional(v.string()),
  popup_border_radius: v.optional(v.string()),
  horizontal_bg_color: v.optional(v.string()),
  horizontal_text_color: v.optional(v.string()),
  horizontal_border_color: v.optional(v.string()),
  horizontal_hover_color: v.optional(v.string()),
  horizontal_font_size: v.optional(v.string()),
  horizontal_font_family: v.optional(v.string()),
  li_bg_color: v.optional(v.string()),
  li_hover_color: v.optional(v.string()),
  li_border_color: v.optional(v.string()),
  li_border_radius: v.optional(v.string()),
  li_width: v.optional(v.string()),
  li_height: v.optional(v.string()),
  li_font_size: v.optional(v.string()),
  li_font_family: v.optional(v.string()),
  order: v.optional(v.number()),
});

export const getLinks = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("links").order("asc").collect();
  },
});

export const addLink = mutation({
  args: { link: linkValidator },
  handler: async (ctx, args) => {
    const links = await ctx.db.query("links").collect();
    const maxOrder = Math.max(...links.map(l => l.order || 0), 0);
    
    await ctx.db.insert("links", {
      ...args.link,
      default_type: args.link.default_type || "text",
      horizontal_stack: args.link.horizontal_stack ?? false,
      order: maxOrder + 1,
    });
  },
});

export const updateLink = mutation({
  args: { 
    id: v.id("links"),
    link: linkValidator 
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, args.link);
  },
});

export const deleteLink = mutation({
  args: { id: v.id("links") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const reorderLinks = mutation({
  args: { 
    links: v.array(v.object({
      id: v.id("links"),
      order: v.number()
    }))
  },
  handler: async (ctx, args) => {
    for (const link of args.links) {
      await ctx.db.patch(link.id, { order: link.order });
    }
  },
});
