import { NextRequest, NextResponse } from "next/server";

const CONVEX_SITE_URL = (process.env.CONVEX_SITE_URL ?? "").replace(/\/$/, "");
const CONVEX_SECRET   = process.env.CONVEX_SECRET ?? "";
const SCRAPE_HEADERS  = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

// ─── Convex helpers ────────────────────────────────────────────────────────────

function convexHeaders() {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (CONVEX_SECRET) h["x-convex-secret"] = CONVEX_SECRET;
  return h;
}

async function uploadMatches(matches: unknown[]) {
  if (!matches.length || !CONVEX_SITE_URL) return 0;
  const batchSize = 200;
  let uploaded = 0;
  for (let i = 0; i < matches.length; i += batchSize) {
    const batch = matches.slice(i, i + batchSize);
    const r = await fetch(`${CONVEX_SITE_URL}/ingest-matches`, {
      method: "POST", headers: convexHeaders(),
      body: JSON.stringify({ matches: batch }),
    });
    if (!r.ok) throw new Error(`Convex ingest error ${r.status}: ${await r.text()}`);
    uploaded += batch.length;
  }
  return uploaded;
}

async function uploadSingle(match: unknown) {
  if (!CONVEX_SITE_URL) return;
  try {
    const r = await fetch(`${CONVEX_SITE_URL}/upsert-match`, {
      method: "POST", headers: convexHeaders(),
      body: JSON.stringify({ match }),
    });
    if (!r.ok) console.error(`Convex upsert error ${r.status}: ${await r.text()}`);
  } catch (e) { console.error("Upsert error:", e); }
}

async function fetchPlayerPhoto(playerHref: string): Promise<string> {
  if (!playerHref) return "";
  const html = await fetchHTML(`https://www.vlr.gg${playerHref}`);
  if (!html) return "";

  const avatarMatch = html.match(/<div[^>]+class="[^"]*\bwf-avatar\b[^"]*"[\s\S]*?<img[^>]+src="([^"]+)"/);
  let src = avatarMatch?.[1] ?? "";
  if (src.startsWith("//")) src = "https:" + src;
  else if (src.startsWith("/")) src = "https://www.vlr.gg" + src;
  return src;
}

async function hydratePlayerPhotos(players: Record<string, unknown>) {
  const refs = new Map<string, Record<string, unknown>[]>();

  for (const mapData of Object.values(players)) {
    if (!mapData || typeof mapData !== "object") continue;
    const teams = mapData as { team1?: unknown[]; team2?: unknown[] };
    for (const teamKey of ["team1", "team2"] as const) {
      for (const player of teams[teamKey] ?? []) {
        if (!player || typeof player !== "object") continue;
        const p = player as Record<string, unknown>;
        const href = typeof p.href === "string" ? p.href : "";
        if (href && !p.photo) {
          const list = refs.get(href) ?? [];
          list.push(p);
          refs.set(href, list);
        }
      }
    }
  }

  const hrefs = [...refs.keys()];
  const batchSize = 5;
  for (let i = 0; i < hrefs.length; i += batchSize) {
    const batch = hrefs.slice(i, i + batchSize);
    await Promise.all(batch.map(async (href) => {
      const photo = await fetchPlayerPhoto(href);
      for (const player of refs.get(href) ?? []) {
        player.photo = photo;
      }
    }));
  }
}

// ─── HTML parsing helpers ──────────────────────────────────────────────────────

function getText(el: Element | null): string {
  return el?.textContent?.trim().replace(/\s+/g, " ") ?? "";
}

function getSrc(img: Element | null): string {
  const src = img?.getAttribute("src") ?? "";
  return src.startsWith("//") ? "https:" + src : src;
}

function cleanHtmlText(value: string | undefined): string {
  return (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// ─── Match list parsing ────────────────────────────────────────────────────────

function parseMatches(html: string, forceStatus?: string) {
  // Use regex-based parsing — no DOM library needed in Node.js edge
  const results: Record<string, unknown>[] = [];
  const now = Math.floor(Date.now() / 1000);

  // Split by match-item links
  const matchItemRegex = /<a\b(?=[^>]*\bhref="([^"]+)")(?=[^>]*\bclass="[^"]*\bmatch-item\b[^"]*")[^>]*>([\s\S]*?)<\/a>/g;
  const dateLabelRegex = /<div[^>]+class="[^"]*wf-label[^"]*mod-large[^"]*"[^>]*>([\s\S]*?)<\/div>/g;

  // Extract dates in order
  const dates: { index: number; date: string }[] = [];
  let dm: RegExpExecArray | null;
  while ((dm = dateLabelRegex.exec(html)) !== null) {
    dates.push({ index: dm.index, date: dm[1].trim().replace(/\s+/g, " ") });
  }

  let mm: RegExpExecArray | null;
  while ((mm = matchItemRegex.exec(html)) !== null) {
    const href    = mm[1];
    const inner   = mm[2];
    const matchAt = mm.index;

    // Find the closest date label before this match
    let currentDate = "Unknown Date";
    for (const d of dates) {
      if (d.index < matchAt) currentDate = d.date;
    }

    const idMatch = href.match(/\/(\d+)\//);
    if (!idMatch) continue;
    const match_id = idMatch[1];

    // Time
    const timeMatch = inner.match(/match-item-time[^>]*>([\s\S]*?)<\/div>/);
    const time_text = timeMatch ? timeMatch[1].trim().replace(/\s+/g, " ") : "N/A";

    // Teams
    const teamNameRegex = /match-item-vs-team-name[^>]*>([\s\S]*?)<\/div>/g;
    const scoreRegex    = /match-item-vs-team-score[^>]*>([\s\S]*?)<\/div>/g;

    const teamNames: string[] = [];
    const teamScores: string[] = [];
    let tnm: RegExpExecArray | null;
    while ((tnm = teamNameRegex.exec(inner)) !== null) {
      teamNames.push(cleanHtmlText(tnm[1]));
    }
    let tsm: RegExpExecArray | null;
    while ((tsm = scoreRegex.exec(inner)) !== null) {
      teamScores.push(cleanHtmlText(tsm[1]));
    }

    // Tournament
    const eventMatch   = inner.match(/<div[^>]+class="[^"]*\bmatch-item-event\b[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]+class="[^"]*\bmatch-item-icon\b)/);
    const seriesMatch  = inner.match(/match-item-event-series[^>]*>([\s\S]*?)<\/div>/);
    let tourney_name   = "";
    let tourney_series = "";
    if (seriesMatch) {
      tourney_series = cleanHtmlText(seriesMatch[1]);
      if (eventMatch) {
        tourney_name = cleanHtmlText(eventMatch[1]).replace(tourney_series, "").trim();
      }
    } else if (eventMatch) {
      tourney_name = cleanHtmlText(eventMatch[1]);
    }

    // Logo
    const iconMatch = inner.match(/match-item-icon[\s\S]*?<img[^>]+src="([^"]+)"/);
    let tourney_logo = iconMatch ? iconMatch[1] : "";
    if (tourney_logo.startsWith("//")) tourney_logo = "https:" + tourney_logo;

    // Status
    const etaMatch    = inner.match(/ml-eta[^>]*>([\s\S]*?)<\/div>/);
    const statusMatch = inner.match(/ml-status[^>]*>([\s\S]*?)<\/div>/);
    const eta_text    = etaMatch   ? etaMatch[1].trim().replace(/<[^>]+>/g, "")    : "";
    const status_txt  = statusMatch ? statusMatch[1].trim().replace(/<[^>]+>/g, "") : "";

    let status: string;
    if (forceStatus) {
      status = forceStatus;
    } else if (/live/i.test(eta_text) || /live/i.test(status_txt)) {
      status = "Live";
    } else if (/completed/i.test(status_txt)) {
      status = "Completed";
    } else if (/upcoming/i.test(status_txt)) {
      status = "Upcoming";
    } else {
      status = eta_text ? "Upcoming" : "Completed";
    }

    results.push({
      match_id,
      href,
      date:            currentDate,
      time:            time_text,
      team1:           teamNames[0]  ?? "TBD",
      team2:           teamNames[1]  ?? "TBD",
      score1:          teamScores[0] ?? "",
      score2:          teamScores[1] ?? "",
      tournament:      tourney_name,
      series:          tourney_series,
      tournament_logo: tourney_logo,
      eta:             eta_text,
      status,
      last_updated:    now,
    });
  }
  return results;
}

// ─── Match detail parsing ──────────────────────────────────────────────────────

function parseDetail(html: string) {
  // Team logos
  let team1_logo = "", team2_logo = "";
  const t1match = html.match(/mod-1[\s\S]{0,200}?<img[^>]+src="([^"]+)"/);
  const t2match = html.match(/mod-2[\s\S]{0,200}?<img[^>]+src="([^"]+)"/);
  if (t1match) { team1_logo = t1match[1]; if (team1_logo.startsWith("//")) team1_logo = "https:" + team1_logo; }
  if (t2match) { team2_logo = t2match[1]; if (team2_logo.startsWith("//")) team2_logo = "https:" + team2_logo; }

  // Timestamp
  let unix_timestamp = 0, bst_time = "N/A";
  const tsMatch = html.match(/data-utc-ts="([^"]+)"/);
  if (tsMatch) {
    try {
      const raw = tsMatch[1]; // "2026-01-15 18:00:00" in America/New_York
      const [datePart, timePart] = raw.split(" ");
      const [y, mo, d] = datePart.split("-").map(Number);
      const [h, mi, s] = timePart.split(":").map(Number);
      // NY is UTC-5 (EST) or UTC-4 (EDT) — approximate with UTC-5 (close enough for display)
      const utcMs = Date.UTC(y, mo - 1, d, h + 5, mi, s);
      unix_timestamp = Math.floor(utcMs / 1000);
      const bstDate = new Date(utcMs + 6 * 3600 * 1000);
      bst_time = bstDate.toISOString().replace("T", " ").slice(0, 16);
    } catch { /* ignore */ }
  }

  // Maps
  const maps: unknown[] = [];
  const players_by_map: Record<string, unknown> = {};
  let map_index = 0;

  const gameRegex = /<div[^>]+class="[^"]*vm-stats-game[^"]*"[^>]+data-game-id="([^"]*)"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  let gm: RegExpExecArray | null;

  while ((gm = gameRegex.exec(html)) !== null) {
    const game_id  = gm[1];
    const game_html = gm[2];

    // Parse player rows — extract name, stats from ovw-row divs
    const parsePlayerRows = (teamHtml: string) => {
      const players: unknown[] = [];
      const rowRegex = /ovw-row(?![^"]*mod-head)[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
      let rm: RegExpExecArray | null;
      while ((rm = rowRegex.exec(teamHtml)) !== null) {
        const row = rm[1];
        const nameMatch   = row.match(/(?:ovw-player-name|text-of)[^>]*>([\s\S]*?)<\/div>/);
        const hrefMatch   = row.match(/href="(\/[^"]+)"/);
        const ratingMatch = row.match(/data-col="rating2"[^>]*>([\s\S]*?)<\/div>/);
        const acsMatch    = row.match(/data-col="acs"[^>]*>([\s\S]*?)<\/div>/);
        const killsMatch  = row.match(/data-col="kills"[^>]*>([\s\S]*?)<\/span>/);
        const deathsMatch = row.match(/data-col="deaths"[^>]*>([\s\S]*?)<\/span>/);
        const assistMatch = row.match(/data-col="assists"[^>]*>([\s\S]*?)<\/span>/);
        const kdMatch     = row.match(/data-col="kd-diff"[^>]*>([\s\S]*?)<\/div>/);
        const kastMatch   = row.match(/data-col="kast"[^>]*>([\s\S]*?)<\/div>/);
        const adrMatch    = row.match(/data-col="adr"[^>]*>([\s\S]*?)<\/div>/);
        const hsMatch     = row.match(/data-col="hsp"[^>]*>([\s\S]*?)<\/div>/);
        const fkMatch     = row.match(/data-col="fb"[^>]*>([\s\S]*?)<\/div>/);
        const fdMatch     = row.match(/data-col="fd"[^>]*>([\s\S]*?)<\/div>/);
        const fkdMatch    = row.match(/data-col="fk-diff"[^>]*>([\s\S]*?)<\/div>/);

        const clean = (s: string | undefined) =>
          (s ?? "").replace(/<[^>]+>/g, "").trim().replace(/\s+/g, " ");

        // Agents
        const agents: { name: string; icon: string }[] = [];
        const agentRegex = /<img[^>]+alt="([^"]*)"[^>]+src="([^"]+)"/g;
        const agentsSection = row.match(/ovw-agents[\s\S]*?<\/div>/)?.[0] ?? "";
        let am: RegExpExecArray | null;
        while ((am = agentRegex.exec(agentsSection)) !== null) {
          let icon = am[2];
          if (icon.startsWith("//")) icon = "https:" + icon;
          else if (icon.startsWith("/")) icon = "https://www.vlr.gg" + icon;
          agents.push({ name: am[1], icon });
        }

        players.push({
          name:     clean(nameMatch?.[1]),
          href:     hrefMatch?.[1] ?? "",
          photo:    "",
          agents,
          rating:   clean(ratingMatch?.[1]),
          acs:      clean(acsMatch?.[1]),
          k:        clean(killsMatch?.[1]),
          d:        clean(deathsMatch?.[1]),
          a:        clean(assistMatch?.[1]),
          kd_diff:  clean(kdMatch?.[1]),
          kast:     clean(kastMatch?.[1]),
          adr:      clean(adrMatch?.[1]),
          hs:       clean(hsMatch?.[1]),
          fk:       clean(fkMatch?.[1]),
          fd:       clean(fdMatch?.[1]),
          fk_diff:  clean(fkdMatch?.[1]),
        });
      }
      return players;
    };

    // Split game html into two team tables
    const tableMatches = [...game_html.matchAll(/ovw-table[\s\S]*?(?=ovw-table|$)/g)];
    const team1_players = tableMatches[0] ? parsePlayerRows(tableMatches[0][0]) : [];
    const team2_players = tableMatches[1] ? parsePlayerRows(tableMatches[1][0]) : [];
    const playerData = { team1: team1_players, team2: team2_players };

    if (game_id === "all") {
      players_by_map["all"] = playerData;
      continue;
    }

    // Map name and score
    const mapNameMatch  = game_html.match(/class="map"[\s\S]*?<span>([\s\S]*?)<\/span>/);
    const map_name      = mapNameMatch ? mapNameMatch[1].trim() : "";
    const scoreMatches  = [...game_html.matchAll(/class="score(?:[^"]*)"[^>]*>([\s\S]*?)<\/div>/g)];
    const map_scores    = scoreMatches.map((m) => m[1].trim());
    const winnerMatch   = game_html.match(/class="score[^"]*mod-win[^"]*"[\s\S]{0,50}?(\d)/);
    const winnerSection = game_html.indexOf("mod-win");
    // Determine winner by position of mod-win relative to teams
    const firstTeamEnd  = game_html.indexOf("</div>", game_html.indexOf('class="team"'));
    const map_winner    = winnerMatch
      ? (winnerSection < firstTeamEnd ? 0 : 1)
      : null;

    maps.push({
      name:   map_name,
      score1: map_scores[0] ?? "0",
      score2: map_scores[1] ?? "0",
      winner: map_winner,
    });
    players_by_map[String(map_index)] = playerData;
    map_index++;
  }

  // Overall score
  let score1 = "", score2 = "";
  const vsScoreMatch = html.match(/match-header-vs-score[\s\S]*?(\d+)[\s\S]*?(\d+)/);
  if (vsScoreMatch) { score1 = vsScoreMatch[1]; score2 = vsScoreMatch[2]; }

  // Status
  let status = "Upcoming";
  const vsNote = html.match(/match-header-vs-note[^>]*>([\s\S]*?)<\/div>/);
  const vsText = (vsNote?.[1] ?? "").toLowerCase();
  if (/live/.test(vsText) || /match-header-vs-note-live/.test(html)) {
    status = "Live";
  } else if (score1 && score2 && !(score1 === "0" && score2 === "0")) {
    status = "Completed";
  }

  return { team1_logo, team2_logo, unix_timestamp, bst_time, maps, players: players_by_map, score1, score2, status };
}

// ─── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchHTML(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: SCRAPE_HEADERS });
    if (!r.ok) { console.error(`Failed ${url}: ${r.status}`); return null; }
    return await r.text();
  } catch (e) { console.error(`Fetch error ${url}:`, e); return null; }
}

// ─── Main scrape ───────────────────────────────────────────────────────────────

async function runScrape(scrapeStart: number, scrapeEnd: number, loadDetails: boolean) {
  const allScraped: Record<string, unknown>[] = [];

  const upcomingHtml = await fetchHTML("https://www.vlr.gg/matches");
  if (upcomingHtml) {
    const upcoming = parseMatches(upcomingHtml);
    allScraped.push(...upcoming);
    console.log(`Scraped ${upcoming.length} upcoming/live matches.`);
  }

  for (let page = scrapeStart; page <= scrapeEnd; page++) {
    const html = await fetchHTML(`https://www.vlr.gg/matches/results?page=${page}`);
    if (html) {
      const completed = parseMatches(html, "Completed");
      allScraped.push(...completed);
      console.log(`Scraped ${completed.length} completed matches from page ${page}.`);
    }
  }

  if (!allScraped.length) return { ok: false, error: "No matches scraped" };

  // Upload lightweight list first
  const uploaded = await uploadMatches(allScraped);

  if (!loadDetails) {
    return { ok: true, scraped: allScraped.length, uploaded, detailed: 0 };
  }

  // Fetch details in parallel (batches of 8)
  const batchSize = 8;
  let detailed = 0;
  for (let i = 0; i < allScraped.length; i += batchSize) {
    const batch = allScraped.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (m) => {
        const href = m.href as string;
        if (!href) return;
        const html = await fetchHTML(`https://www.vlr.gg${href}`);
        if (!html) return;
        const details = parseDetail(html);
        await hydratePlayerPhotos(details.players);
        await uploadSingle({ ...m, ...details });
        detailed++;
      })
    );
  }

  return { ok: true, scraped: allScraped.length, detailed };
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!CONVEX_SITE_URL) {
    return NextResponse.json({ error: "CONVEX_SITE_URL not configured" }, { status: 500 });
  }

  let body: { scrape_start?: number; scrape_end?: number; load_details?: boolean } = {};
  try { body = await req.json(); } catch { /* no body fine */ }

  const scrapeStart = Number(body.scrape_start ?? 1);
  const scrapeEnd   = Number(body.scrape_end   ?? 5);

  try {
    const result = await runScrape(scrapeStart, scrapeEnd, body.load_details === true);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "VLR sync endpoint ready. Use POST to trigger." });
}
