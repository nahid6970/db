import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getAppSettings = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("app_settings")
      .filter((q) => q.eq(q.field("key"), "global"))
      .first();
  },
});

export const upsertAppSettings = mutation({
  args: {
    key: v.string(),
    hideGroupNames: v.optional(v.boolean()),
    openSameTab: v.optional(v.boolean()),
    autoFitScaleMinPercent: v.optional(v.number()),
    autoFitScaleMaxPercent: v.optional(v.number()),
    autoFitScaleDefaultPercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("app_settings")
      .filter((q) => q.eq(q.field("key"), args.key))
      .first();

    if (existing) {
      const { key: _, ...data } = args;
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }

    return await ctx.db.insert("app_settings", args);
  },
});

// Links queries and mutations
export const getLinks = query({
  args: {},
  handler: async (ctx) => {
    const links = await ctx.db.query("links").collect();
    // Sort by group_order (asc), then by _creationTime (asc)
    return links.sort((a, b) => {
      const orderA = a.group_order ?? 0;
      const orderB = b.group_order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a._creationTime - b._creationTime;
    });
  },
});

export const addLink = mutation({
  args: {
    name: v.optional(v.string()),
    group: v.optional(v.string()),
    urls: v.optional(v.array(v.string())),
    url: v.optional(v.string()),
    default_type: v.optional(v.string()),
    is_separator: v.optional(v.boolean()),
    start_new_line: v.optional(v.boolean()),
    group_start_new_line: v.optional(v.boolean()),
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
    group_password: v.optional(v.string()),
    li_auto_fit: v.optional(v.boolean()),
    li_auto_fit_scale: v.optional(v.number()),
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
    reminder_enabled: v.optional(v.boolean()),
    reminder_mode: v.optional(v.string()),
    reminder_frequency: v.optional(v.string()),
    reminder_interval_days: v.optional(v.number()),
    reminder_datetime: v.optional(v.string()),
    reminder_next_trigger_at: v.optional(v.number()),
    reminder_last_triggered_at: v.optional(v.number()),
    click_tracking_enabled: v.optional(v.boolean()),
    click_tracking_last_clicked_at: v.optional(v.number()),
    youtube_channel_id: v.optional(v.string()),
    youtube_last_video_id: v.optional(v.string()),
    youtube_new_video_count: v.optional(v.number()),
    youtube_notification_started_at: v.optional(v.number()),
    note: v.optional(v.string()),
    note_enabled: v.optional(v.boolean()),
    folder_picker: v.optional(v.boolean()),
    folder_path: v.optional(v.string()),
    thumbnail_refresh_enabled: v.optional(v.boolean()),
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
    start_new_line: v.optional(v.boolean()),
    group_start_new_line: v.optional(v.boolean()),
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
    group_password: v.optional(v.string()),
    li_auto_fit: v.optional(v.boolean()),
    li_auto_fit_scale: v.optional(v.number()),
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
    reminder_enabled: v.optional(v.boolean()),
    reminder_mode: v.optional(v.string()),
    reminder_frequency: v.optional(v.string()),
    reminder_interval_days: v.optional(v.number()),
    reminder_datetime: v.optional(v.string()),
    reminder_next_trigger_at: v.optional(v.number()),
    reminder_last_triggered_at: v.optional(v.number()),
    click_tracking_enabled: v.optional(v.boolean()),
    click_tracking_last_clicked_at: v.optional(v.number()),
    youtube_channel_id: v.optional(v.string()),
    youtube_last_video_id: v.optional(v.string()),
    youtube_new_video_count: v.optional(v.number()),
    youtube_notification_started_at: v.optional(v.number()),
    note: v.optional(v.string()),
    note_enabled: v.optional(v.boolean()),
    folder_picker: v.optional(v.boolean()),
    folder_path: v.optional(v.string()),
    thumbnail_refresh_enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...data } = args;
    await ctx.db.patch(id, data);
  },
});

export const updateYouTubeStatus = mutation({
  args: {
    id: v.union(v.id("links"), v.id("sidebar_buttons")),
    table: v.string(), // "links" or "sidebar_buttons"
    click_tracking_enabled: v.optional(v.boolean()),
    click_tracking_last_clicked_at: v.optional(v.number()),
    youtube_channel_id: v.optional(v.string()),
    youtube_last_video_id: v.optional(v.string()),
    youtube_new_video_count: v.optional(v.number()),
    youtube_notification_started_at: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, table, ...data } = args;
    if (table === "links") {
      await ctx.db.patch(id as any, data);
    } else if (table === "sidebar_buttons") {
      await ctx.db.patch(id as any, data);
    }
  },
});

export const updateLinkImage = mutation({
  args: {
    id: v.id("links"),
    img_src: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...data } = args;
    await ctx.db.patch(id, data);
  },
});



export const deleteLink = mutation({
  args: { id: v.id("links") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (existing) await ctx.db.delete(args.id);
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

export const updateAllLinksAutoFitScale = mutation({
  args: {
    li_auto_fit_scale: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("links").collect();
    for (const link of existing) {
      await ctx.db.patch(link._id, {
        li_auto_fit_scale: args.li_auto_fit_scale,
      });
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
    const buttons = await ctx.db.query("sidebar_buttons").collect();
    return buttons.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
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
    order: v.optional(v.number()),
    click_tracking_enabled: v.optional(v.boolean()),
    click_tracking_last_clicked_at: v.optional(v.number()),
    youtube_channel_id: v.optional(v.string()),
    youtube_last_video_id: v.optional(v.string()),
    youtube_new_video_count: v.optional(v.number()),
    youtube_notification_started_at: v.optional(v.number()),
    thumbnail_refresh_enabled: v.optional(v.boolean()),
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
    order: v.optional(v.number()),
    click_tracking_enabled: v.optional(v.boolean()),
    click_tracking_last_clicked_at: v.optional(v.number()),
    youtube_channel_id: v.optional(v.string()),
    youtube_last_video_id: v.optional(v.string()),
    youtube_new_video_count: v.optional(v.number()),
    youtube_notification_started_at: v.optional(v.number()),
    thumbnail_refresh_enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { dbId, ...data } = args;
    await ctx.db.patch(dbId, data);
  },
});

export const updateSidebarOrder = mutation({
  args: { order: v.array(v.object({ id: v.string(), order: v.number() })) },
  handler: async (ctx, args) => {
    const buttons = await ctx.db.query("sidebar_buttons").collect();
    for (const btn of buttons) {
      const orderInfo = args.order.find(o => o.id === btn.id);
      if (orderInfo) {
        await ctx.db.patch(btn._id, { order: orderInfo.order });
      }
    }
  },
});

export const deleteSidebarButton = mutation({
  args: { id: v.id("sidebar_buttons") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const updateAllSidebarButtons = mutation({
  args: { buttons: v.array(v.any()) },
  handler: async (ctx, args) => {
    // Delete all existing sidebar buttons
    const existing = await ctx.db.query("sidebar_buttons").collect();
    for (const btn of existing) {
      await ctx.db.delete(btn._id);
    }
    
    // Insert new buttons without _id and _creationTime fields
    for (const btn of args.buttons) {
      const { _id, _creationTime, ...data } = btn;
      await ctx.db.insert("sidebar_buttons", data);
    }
  },
});

export const resetAllYouTubeTracking = mutation({
  args: {},
  handler: async (ctx) => {
    const links = await ctx.db.query("links").collect();
    for (const link of links) {
      if (link.youtube_channel_id) {
        await ctx.db.patch(link._id, {
          youtube_last_video_id: "",
          youtube_new_video_count: 0,
          youtube_notification_started_at: 0,
        });
      }
    }

    const buttons = await ctx.db.query("sidebar_buttons").collect();
    for (const btn of buttons) {
      if (btn.youtube_channel_id) {
        await ctx.db.patch(btn._id, {
          youtube_last_video_id: "",
          youtube_new_video_count: 0,
          youtube_notification_started_at: 0,
        });
      }
    }
  },
});

export const updateItemImage = mutation({
  args: {
    id: v.union(v.id("links"), v.id("sidebar_buttons")),
    table: v.string(), // "links" or "sidebar_buttons"
    img_src: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, table, img_src } = args;
    if (table === "links") {
      await ctx.db.patch(id as any, { img_src });
    } else if (table === "sidebar_buttons") {
      await ctx.db.patch(id as any, { img_src });
    }
  },
});
