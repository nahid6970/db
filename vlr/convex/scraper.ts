"use node";

import { action } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { v } from "convex/values";
import * as cheerio from "cheerio";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

async function storeImageInConvex(ctx: any, url: string): Promise<string> {
  if (!url) return "";
  if (url.startsWith("//")) url = "https:" + url;
  if (url.startsWith("/")) url = "https://www.vlr.gg" + url;
  if (url.includes(".convex.site") || url.includes(".convex.cloud")) return url;

  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return url;
    const buffer = await res.arrayBuffer();
    const storageId = await ctx.storage.store(new Blob([buffer]));
    const publicUrl = await ctx.storage.getUrl(storageId);
    return publicUrl || url;
  } catch (err) {
    console.error("Failed storing image in Convex storage:", err);
    return url;
  }
}

function parseNyToUnix(dateStr: string): number {
  if (!dateStr) return 0;
  try {
    const [dPart, tPart] = dateStr.split(" ");
    if (!dPart || !tPart) return 0;
    const isoStr = `${dPart}T${tPart}-04:00`;
    return Math.floor(new Date(isoStr).getTime() / 1000);
  } catch {
    return 0;
  }
}

function formatBstTime(unixTs: number): string {
  if (!unixTs) return "N/A";
  const d = new Date(unixTs * 1000 + 6 * 3600 * 1000);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = months[d.getUTCMonth()];
  const day = String(d.getUTCDate()).padStart(2, "0");
  const y = d.getUTCFullYear();
  let hours = d.getUTCHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const mins = String(d.getUTCMinutes()).padStart(2, "0");
  return `${m} ${day}, ${y} - ${String(hours).padStart(2, "0")}:${mins} ${ampm}`;
}

async function scrapeDetailPage(ctx: any, href: string) {
  const url = `https://www.vlr.gg${href}`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    let team1_logo = "";
    let team2_logo = "";

    const matchHeader = $(".match-header");
    if (matchHeader.length) {
      const t1Link = matchHeader.find("a.mod-1 img");
      if (t1Link.length) team1_logo = t1Link.attr("src") || "";
      const t2Link = matchHeader.find("a.mod-2 img");
      if (t2Link.length) team2_logo = t2Link.attr("src") || "";
    }

    const utcDiv = $(".moment-tz-convert");
    const dataUtcTs = utcDiv.attr("data-utc-ts") || "";
    const unix_timestamp = parseNyToUnix(dataUtcTs);
    const bst_time = formatBstTime(unix_timestamp);

    const localTeam1Logo = team1_logo ? await storeImageInConvex(ctx, team1_logo) : "";
    const localTeam2Logo = team2_logo ? await storeImageInConvex(ctx, team2_logo) : "";

    const maps: any[] = [];
    const playersByMap: Record<string, any> = {};

    const gameDivs = $(".vm-stats-game");
    let mapIndex = 0;

    for (let i = 0; i < gameDivs.length; i++) {
      const gEl = $(gameDivs[i]);
      const gameId = gEl.attr("data-game-id") || "";

      const parsePlayerTables = async (container: cheerio.Cheerio<any>) => {
        const result: { team1: any[]; team2: any[] } = { team1: [], team2: [] };
        let tables = container.find("div.ovw-table");
        let isDivTable = true;
        if (!tables.length) {
          tables = container.find("table");
          isDivTable = false;
        }

        for (let tIdx = 0; tIdx < Math.min(2, tables.length); tIdx++) {
          const teamKey = tIdx === 0 ? "team1" : "team2";
          const table = $(tables[tIdx]);
          const rows = isDivTable ? table.find("div.ovw-row:not(.mod-head)") : table.find("tr").slice(1);

          for (let rIdx = 0; rIdx < rows.length; rIdx++) {
            const row = $(rows[rIdx]);
            const cells = isDivTable ? row.find("div.ovw-cell") : row.find("td");
            if (!cells.length) continue;

            const getCellText = (cell: cheerio.Cheerio<any>) => {
              const span = cell.find("span.mod-both");
              return span.length ? span.text().trim() : cell.text().trim();
            };

            let playerName = "";
            let playerHref = "";
            let agents: any[] = [];

            if (isDivTable) {
              const playerTd = $(cells[0]);
              const aTag = playerTd.find("a");
              if (aTag.length) {
                playerHref = aTag.attr("href") || "";
                const nameDiv = aTag.find("div.ovw-player-name, div.text-of");
                playerName = nameDiv.length ? nameDiv.text().trim() : aTag.text().trim();
              }
              const agentImgs = playerTd.find("div.ovw-agents img");
              for (let aI = 0; aI < agentImgs.length; aI++) {
                const aImg = $(agentImgs[aI]);
                const aname = aImg.attr("alt") || "";
                const src = aImg.attr("src") || "";
                const icon = src ? await storeImageInConvex(ctx, src) : "";
                agents.push({ name: aname, icon });
              }
            } else {
              const playerTd = $(cells[0]);
              const aTag = playerTd.find("a");
              if (aTag.length) {
                playerHref = aTag.attr("href") || "";
                const nameDiv = aTag.find("div.text-of");
                playerName = nameDiv.length ? nameDiv.text().trim() : aTag.text().trim();
              }
              const agentTd = $(cells[1]);
              const agentImgs = agentTd.find("img");
              for (let aI = 0; aI < agentImgs.length; aI++) {
                const aImg = $(agentImgs[aI]);
                const icon = aImg.attr("src") ? await storeImageInConvex(ctx, aImg.attr("src")!) : "";
                agents.push({ name: aImg.attr("alt") || "", icon });
              }
            }

            result[teamKey].push({
              name: playerName,
              href: playerHref,
              photo: "",
              agents,
              rating: isDivTable ? getCellText($(cells[1])) : getCellText($(cells[2])),
              acs: isDivTable ? getCellText($(cells[2])) : getCellText($(cells[3])),
              k: isDivTable ? getCellText($(cells[3])) : getCellText($(cells[4])),
              d: isDivTable ? getCellText($(cells[4])) : getCellText($(cells[5])),
              a: isDivTable ? getCellText($(cells[5])) : getCellText($(cells[6])),
              kd_diff: isDivTable ? getCellText($(cells[6])) : getCellText($(cells[7])),
              kast: isDivTable ? getCellText($(cells[7])) : getCellText($(cells[8])),
              adr: isDivTable ? getCellText($(cells[8])) : getCellText($(cells[9])),
              hs: isDivTable ? getCellText($(cells[9])) : getCellText($(cells[10])),
              fk: isDivTable ? getCellText($(cells[10])) : getCellText($(cells[11])),
              fd: isDivTable ? getCellText($(cells[11])) : getCellText($(cells[12])),
              fk_diff: isDivTable ? getCellText($(cells[12])) : getCellText($(cells[13])),
            });
          }
        }
        return result;
      };

      if (gameId === "all") {
        playersByMap["all"] = await parsePlayerTables(gEl);
        continue;
      }

      const header = gEl.find(".vm-stats-game-header");
      if (!header.length) continue;

      const mapName = header.find(".map span").text().trim();
      const teamDivs = header.find(".team");
      const mapScores: string[] = [];
      let mapWinner: number | null = null;

      teamDivs.each((tI, td) => {
        const scoreDiv = $(td).find(".score");
        mapScores.push(scoreDiv.text().trim() || "0");
        if (scoreDiv.hasClass("mod-win")) mapWinner = tI;
      });

      maps.push({
        name: mapName,
        score1: mapScores[0] || "0",
        score2: mapScores[1] || "0",
        winner: mapWinner,
      });

      playersByMap[String(mapIndex)] = await parsePlayerTables(gEl);
      mapIndex++;
    }

    let overall_score1 = "";
    let overall_score2 = "";
    const vsScoreDiv = $(".match-header-vs-score");
    if (vsScoreDiv.length) {
      const scoreSpans = vsScoreDiv.find("span").filter((_, el) => /^\d+$/.test($(el).text().trim()));
      if (scoreSpans.length >= 2) {
        overall_score1 = $(scoreSpans[0]).text().trim();
        overall_score2 = $(scoreSpans[1]).text().trim();
      }
    }

    let status = "Upcoming";
    if (overall_score1 && overall_score2) {
      status = overall_score1 === "0" && overall_score2 === "0" ? "Upcoming" : "Completed";
    }

    return {
      team1_logo: localTeam1Logo,
      team2_logo: localTeam2Logo,
      unix_timestamp,
      bst_time,
      maps,
      players: playersByMap,
      score1: overall_score1,
      score2: overall_score2,
      status,
    };
  } catch (err) {
    console.error("Error scraping match detail:", err);
    return null;
  }
}

export const sync = action({
  args: {
    startPage: v.optional(v.number()),
    endPage: v.optional(v.number()),
    loadMissing: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const start = args.startPage || 1;
    const end = args.endPage || 5;

    const matchesToUpsert: any[] = [];

    // 1. Scrape upcoming matches
    try {
      const res = await fetch("https://www.vlr.gg/matches", { headers: HEADERS });
      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);
        const matchCards = $("a.match-item");

        for (let i = 0; i < matchCards.length; i++) {
          const match = $(matchCards[i]);
          const href = match.attr("href") || "";
          const mIdMatch = href.match(/\/(\d+)\//);
          if (!mIdMatch) continue;
          const id = mIdMatch[1];

          const timeText = match.find(".match-item-time").text().trim();
          const teams = match.find(".match-item-vs-team-name").map((_, el) => $(el).text().trim()).get();
          const scores = match.find(".match-item-vs-team-score").map((_, el) => $(el).text().trim()).get();
          const tourney = match.find(".match-item-event").text().trim();
          const logoSrc = match.find(".match-item-icon img").attr("src") || "";

          const logoUrl = logoSrc ? await storeImageInConvex(ctx, logoSrc) : "";

          matchesToUpsert.push({
            id,
            href,
            time: timeText,
            team1: teams[0] || "TBD",
            team2: teams[1] || "TBD",
            score1: scores[0] || "",
            score2: scores[1] || "",
            tournament: tourney,
            tournament_logo: logoUrl,
            status: "Upcoming",
          });
        }
      }
    } catch (e) {
      console.error("Error scraping upcoming matches:", e);
    }

    // 2. Scrape results pages
    for (let page = start; page <= end; page++) {
      try {
        const res = await fetch(`https://www.vlr.gg/matches/results?page=${page}`, { headers: HEADERS });
        if (!res.ok) continue;
        const html = await res.text();
        const $ = cheerio.load(html);
        const matchCards = $("a.match-item");

        for (let i = 0; i < matchCards.length; i++) {
          const match = $(matchCards[i]);
          const href = match.attr("href") || "";
          const mIdMatch = href.match(/\/(\d+)\//);
          if (!mIdMatch) continue;
          const id = mIdMatch[1];

          const timeText = match.find(".match-item-time").text().trim();
          const teams = match.find(".match-item-vs-team-name").map((_, el) => $(el).text().trim()).get();
          const scores = match.find(".match-item-vs-team-score").map((_, el) => $(el).text().trim()).get();
          const tourney = match.find(".match-item-event").text().trim();
          const logoSrc = match.find(".match-item-icon img").attr("src") || "";

          const logoUrl = logoSrc ? await storeImageInConvex(ctx, logoSrc) : "";

          matchesToUpsert.push({
            id,
            href,
            time: timeText,
            team1: teams[0] || "TBD",
            team2: teams[1] || "TBD",
            score1: scores[0] || "",
            score2: scores[1] || "",
            tournament: tourney,
            tournament_logo: logoUrl,
            status: "Completed",
          });
        }
      } catch (e) {
        console.error(`Error scraping results page ${page}:`, e);
      }
    }

    if (matchesToUpsert.length > 0) {
      await ctx.runMutation(internal.matches.internalBulkUpsert, { matches: matchesToUpsert });
    }

    return { status: "success", count: matchesToUpsert.length };
  },
});

export const scrapeDetail = action({
  args: { href: v.string() },
  handler: async (ctx, args) => {
    const details = await scrapeDetailPage(ctx, args.href);
    if (!details) return null;

    const mIdMatch = args.href.match(/\/(\d+)\//);
    if (mIdMatch) {
      await ctx.runMutation(internal.matches.internalBulkUpsert, {
        matches: [{ id: mIdMatch[1], href: args.href, ...details }],
      });
    }
    return details;
  },
});
