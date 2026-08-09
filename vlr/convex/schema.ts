import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  matches: defineTable({
    id: v.optional(v.string()),
    match_id: v.optional(v.string()),
    href: v.string(),
    date: v.optional(v.string()),
    time: v.optional(v.string()),
    team1: v.optional(v.string()),
    team2: v.optional(v.string()),
    score1: v.optional(v.string()),
    score2: v.optional(v.string()),
    tournament: v.optional(v.string()),
    series: v.optional(v.string()),
    tournament_logo: v.optional(v.string()),
    eta: v.optional(v.string()),
    status: v.optional(v.string()),
    team1_logo: v.optional(v.string()),
    team2_logo: v.optional(v.string()),
    unix_timestamp: v.optional(v.number()),
    bst_time: v.optional(v.string()),
    maps: v.optional(v.any()),
    players: v.optional(v.any()),
    last_updated: v.optional(v.number()),
  })
    .index("by_match_id", ["id"])
    .index("by_tournament", ["tournament"])
    .index("by_status", ["status"]),

  settings: defineTable({
    key: v.string(),
    data: v.any(),
  }).index("by_key", ["key"]),

  ignorelist: defineTable({
    name: v.string(),
    logo: v.optional(v.string()),
  }).index("by_name", ["name"]),
});
