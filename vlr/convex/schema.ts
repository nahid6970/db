import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  matches: defineTable({
    match_id: v.string(),       // VLR numeric match ID (e.g. "123456")
    href: v.string(),           // e.g. "/123456/team-a-vs-team-b/..."
    date: v.string(),
    time: v.string(),
    team1: v.string(),
    team2: v.string(),
    score1: v.string(),
    score2: v.string(),
    tournament: v.string(),
    series: v.string(),
    tournament_logo: v.optional(v.string()),
    eta: v.optional(v.string()),
    status: v.string(),         // "Upcoming" | "Live" | "Completed"
    team1_logo: v.optional(v.string()),
    team2_logo: v.optional(v.string()),
    unix_timestamp: v.optional(v.number()),
    bst_time: v.optional(v.string()),
    maps: v.optional(v.any()),      // array of map objects
    players: v.optional(v.any()),   // players_by_map object
    last_updated: v.optional(v.number()),
  })
    .index("by_match_id", ["match_id"])
    .index("by_tournament", ["tournament"])
    .index("by_status", ["status"])
    .index("by_unix_timestamp", ["unix_timestamp"]),

  settings: defineTable({
    key: v.string(),   // always "global"
    unchecked_tournaments: v.array(v.string()),
    white_logo_teams: v.array(v.string()),
    tournament_colors: v.any(),    // { [tournamentName]: hexColor }
    tournament_order: v.any(),     // { [tournamentName]: number }
    highlight_loaded_tournaments: v.optional(v.boolean()),
    thr_show_all_tournaments: v.optional(v.boolean()),
    scrape_start: v.optional(v.number()),
    scrape_end: v.optional(v.number()),
    per_page: v.optional(v.string()),
    theme: v.optional(v.string()),
  }).index("by_key", ["key"]),

  ignorelist: defineTable({
    name: v.string(),   // tournament name
    logo: v.optional(v.string()),
  }).index("by_name", ["name"]),
});
