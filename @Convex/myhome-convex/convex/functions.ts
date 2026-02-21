import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Links queries and mutations
export const getLinks = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("links").collect();
  },
});

export const addLink = mutation({
  args: {
    name: v.optional(v.string()),
    group: v.optional(v.string()),
    urls: v.array(v.string()),
    url: v.string(),
    default_type: v.string(),
    text: v.optional(v.string()),
    icon_class: v.optional(v.string()),
    img_src: v.optional(v.string()),
    svg_code: v.optional(v.string()),
    width: v.optional(v.string()),
    height: v.optional(v.string()),
    color: v.optional(v.string()),
    background_color: v.optional(v.string()),
    border_radius: v.optional(v.string()),
    title: v.optional(v.string()),
    click_action: v.optional(v.string()),
    font_family: v.optional(v.string()),
    font_size: v.optional(v.string()),
    li_width: v.optional(v.string()),
    li_height: v.optional(v.string()),
    li_bg_color: v.optional(v.string()),
    li_hover_color: v.optional(v.string()),
    li_border_color: v.optional(v.string()),
    li_border_radius: v.optional(v.string()),
    hidden: v.optional(v.boolean()),
    collapsible: v.optional(v.boolean()),
    box_group: v.optional(v.boolean()),
    group_order: v.optional(v.number()),
    display_style: v.optional(v.string()),
    horizontal_stack: v.optional(v.boolean()),
    password_protect: v.optional(v.boolean()),
    top_name: v.optional(v.string()),
    top_bg_color: v.optional(v.string()),
    top_text_color: v.optional(v.string()),
    top_border_color: v.optional(v.string()),
    top_hover_color: v.optional(v.string()),
    popup_bg_color: v.optional(v.string()),
    popup_text_color: v.optional(v.string()),
    popup_border_color: v.optional(v.string()),
    popup_border_radius: v.optional(v.string()),
    horizontal_bg_color: v.optional(v.string()),
    horizontal_text_color: v.optional(v.string()),
    horizontal_border_color: v.optional(v.string()),
    horizontal_hover_color: v.optional(v.string()),
    top_width: v.optional(v.string()),
    top_height: v.optional(v.string()),
    top_font_family: v.optional(v.string()),
    top_font_size: v.optional(v.string()),
    horizontal_width: v.optional(v.string()),
    horizontal_height: v.optional(v.string()),
    horizontal_font_family: v.optional(v.string()),
    horizontal_font_size: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("links", args);
  },
});

export const updateLink = mutation({
  args: {
    id: v.id("links"),
    name: v.optional(v.string()),
    group: v.optional(v.string()),
    urls: v.array(v.string()),
    url: v.string(),
    default_type: v.string(),
    text: v.optional(v.string()),
    icon_class: v.optional(v.string()),
    img_src: v.optional(v.string()),
    svg_code: v.optional(v.string()),
    width: v.optional(v.string()),
    height: v.optional(v.string()),
    color: v.optional(v.string()),
    background_color: v.optional(v.string()),
    border_radius: v.optional(v.string()),
    title: v.optional(v.string()),
    click_action: v.optional(v.string()),
    font_family: v.optional(v.string()),
    font_size: v.optional(v.string()),
    li_width: v.optional(v.string()),
    li_height: v.optional(v.string()),
    li_bg_color: v.optional(v.string()),
    li_hover_color: v.optional(v.string()),
    li_border_color: v.optional(v.string()),
    li_border_radius: v.optional(v.string()),
    hidden: v.optional(v.boolean()),
    collapsible: v.optional(v.boolean()),
    box_group: v.optional(v.boolean()),
    group_order: v.optional(v.number()),
    display_style: v.optional(v.string()),
    horizontal_stack: v.optional(v.boolean()),
    password_protect: v.optional(v.boolean()),
    top_name: v.optional(v.string()),
    top_bg_color: v.optional(v.string()),
    top_text_color: v.optional(v.string()),
    top_border_color: v.optional(v.string()),
    top_hover_color: v.optional(v.string()),
    popup_bg_color: v.optional(v.string()),
    popup_text_color: v.optional(v.string()),
    popup_border_color: v.optional(v.string()),
    popup_border_radius: v.optional(v.string()),
    horizontal_bg_color: v.optional(v.string()),
    horizontal_text_color: v.optional(v.string()),
    horizontal_border_color: v.optional(v.string()),
    horizontal_hover_color: v.optional(v.string()),
    top_width: v.optional(v.string()),
    top_height: v.optional(v.string()),
    top_font_family: v.optional(v.string()),
    top_font_size: v.optional(v.string()),
    horizontal_width: v.optional(v.string()),
    horizontal_height: v.optional(v.string()),
    horizontal_font_family: v.optional(v.string()),
    horizontal_font_size: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...data } = args;
    await ctx.db.patch(id, data);
  },
});

export const deleteLink = mutation({
  args: { id: v.id("links") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const updateAllLinks = mutation({
  args: { links: v.array(v.any()) },
  handler: async (ctx, args) => {
    // Delete all existing links
    const existing = await ctx.db.query("links").collect();
    for (const link of existing) {
      await ctx.db.delete(link._id);
    }
    
    // Insert new links without _id and _creationTime fields
    for (const link of args.links) {
      const { _id, _creationTime, ...data } = link;
      await ctx.db.insert("links", data);
    }
  },
});

export const updateGroupOrder = mutation({
  args: { groupOrder: v.array(v.object({ name: v.string(), order: v.number() })) },
  handler: async (ctx, args) => {
    const links = await ctx.db.query("links").collect();
    for (const link of links) {
      const groupInfo = args.groupOrder.find(g => g.name === (link.group || 'Ungrouped'));
      if (groupInfo) {
        await ctx.db.patch(link._id, { group_order: groupInfo.order });
      }
    }
  },
});

// Sidebar buttons queries and mutations
export const getSidebarButtons = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("sidebar_buttons").collect();
  },
});

export const addSidebarButton = mutation({
  args: {
    id: v.string(),
    name: v.string(),
    display_type: v.string(),
    icon_class: v.optional(v.string()),
    img_src: v.optional(v.string()),
    svg_code: v.optional(v.string()),
    url: v.string(),
    has_notification: v.boolean(),
    text_color: v.string(),
    bg_color: v.string(),
    hover_color: v.string(),
    border_color: v.string(),
    border_radius: v.string(),
    font_size: v.string(),
    notification_api: v.optional(v.string()),
    mark_seen_api: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("sidebar_buttons", args);
  },
});

export const updateSidebarButton = mutation({
  args: {
    dbId: v.id("sidebar_buttons"),
    id: v.string(),
    name: v.string(),
    display_type: v.string(),
    icon_class: v.optional(v.string()),
    img_src: v.optional(v.string()),
    svg_code: v.optional(v.string()),
    url: v.string(),
    has_notification: v.boolean(),
    text_color: v.string(),
    bg_color: v.string(),
    hover_color: v.string(),
    border_color: v.string(),
    border_radius: v.string(),
    font_size: v.string(),
    notification_api: v.optional(v.string()),
    mark_seen_api: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { dbId, ...data } = args;
    await ctx.db.patch(dbId, data);
  },
});

export const deleteSidebarButton = mutation({
  args: { id: v.id("sidebar_buttons") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
