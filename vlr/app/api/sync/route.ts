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

  const avatarMatch = html.match(/class="[^"]*wf-avatar[^"]*"[\s\S]*?<img[^>]+src="([^"]+)"/)
    || html.match(/player-header[\s\S]*?<img[^>]+src="([^"]+)"/);
  let src = avatarMatch?.[1] ?? "";
  if (!src || src.includes("vlr.png") || src.includes("blank")) return "";
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
    else if (tourney_logo.startsWith("/")) tourney_logo = "https://www.vlr.gg" + tourney_logo;

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

function parseTeamLogos(html: string) {
  let team1_logo = "", team2_logo = "";

  const t1Match = html.match(/(?:wf-link-mod-1|class="[^"]*\bmod-1\b[^"]*")[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/)
    || html.match(/match-header-vs-team[\s\S]*?mod-1[\s\S]*?<img[^>]+src="([^"]+)"/);
  if (t1Match) {
    let src = t1Match[1];
    if (src.startsWith("//")) src = "https:" + src;
    else if (src.startsWith("/")) src = "https://www.vlr.gg" + src;
    team1_logo = src;
  }

  const t2Match = html.match(/(?:wf-link-mod-2|class="[^"]*\bmod-2\b[^"]*")[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/)
    || html.match(/match-header-vs-team[\s\S]*?mod-2[\s\S]*?<img[^>]+src="([^"]+)"/);
  if (t2Match) {
    let src = t2Match[1];
    if (src.startsWith("//")) src = "https:" + src;
    else if (src.startsWith("/")) src = "https://www.vlr.gg" + src;
    team2_logo = src;
  }

  return { team1_logo, team2_logo };
}

function parsePlayerTable(tableHtml: string) {
  const headers: string[] = [];
  const thMatches = tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g);
  for (const thm of thMatches) {
    headers.push(cleanHtmlText(thm[1]).toUpperCase());
  }

  let playerIdx = -1, agentsIdx = -1;
  const colMap: Record<string, number> = {};

  headers.forEach((h, idx) => {
    if (h.includes("PLAYER")) playerIdx = idx;
    else if (h.includes("AGENT")) agentsIdx = idx;
    else if (h === "R" || h.includes("RATING")) colMap["rating"] = idx;
    else if (h.includes("ACS")) colMap["acs"] = idx;
    else if (h === "K") colMap["k"] = idx;
    else if (h === "D") colMap["d"] = idx;
    else if (h === "A") colMap["a"] = idx;
    else if (h.includes("KAST")) colMap["kast"] = idx;
    else if (h.includes("ADR")) colMap["adr"] = idx;
    else if (h.includes("HS")) colMap["hs"] = idx;
    else if (h === "FK") colMap["fk"] = idx;
    else if (h === "FD") colMap["fd"] = idx;
    else if (h === "+/-" || h === "KD" || h === "K/D") {
      if (!("kd_diff" in colMap)) colMap["kd_diff"] = idx;
      else colMap["fk_diff"] = idx;
    } else if (h.includes("FK") && h.includes("+")) {
      colMap["fk_diff"] = idx;
    }
  });

  if (playerIdx === -1) playerIdx = 0;
  if (agentsIdx === -1) agentsIdx = 1;

  const tbodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  const tbodyHtml = tbodyMatch ? tbodyMatch[1] : tableHtml;

  const players: Record<string, unknown>[] = [];
  const trMatches = tbodyHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g);

  for (const trm of trMatches) {
    const trHtml = trm[1];
    if (trHtml.includes("mod-head")) continue;

    const tdList: string[] = [];
    const tdMatches = trHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g);
    for (const tdm of tdMatches) {
      tdList.push(tdm[1]);
    }

    if (tdList.length < 3) continue;

    const playerTd = tdList[playerIdx] ?? tdList[0] ?? "";
    const nameMatch = playerTd.match(/text-of[^>]*>([\s\S]*?)<\/div>/)
      || playerTd.match(/class="mod-player"[^>]*>([\s\S]*?)<\/a>/)
      || playerTd.match(/<a[^>]*>([\s\S]*?)<\/a>/);
    const hrefMatch = playerTd.match(/href="(\/[^"]+)"/);

    const playerName = cleanHtmlText(nameMatch ? nameMatch[1] : playerTd);
    const playerHref = hrefMatch ? hrefMatch[1] : "";

    if (!playerName) continue;

    const agentsTd = tdList[agentsIdx] ?? tdList[1] ?? "";
    const agents: { name: string; icon: string }[] = [];
    const imgMatches = agentsTd.matchAll(/<img[^>]+>/g);
    for (const im of imgMatches) {
      const imgTag = im[0];
      const srcM = imgTag.match(/src="([^"]+)"/);
      const titleM = imgTag.match(/(?:title|alt)="([^"]+)"/);
      if (srcM) {
        let icon = srcM[1];
        if (icon.startsWith("//")) icon = "https:" + icon;
        else if (icon.startsWith("/")) icon = "https://www.vlr.gg" + icon;

        let agentName = titleM ? titleM[1] : "";
        if (!agentName) {
          const fn = icon.split("/").pop()?.split(".")[0] ?? "";
          agentName = fn ? fn.charAt(0).toUpperCase() + fn.slice(1) : "Agent";
        }
        agents.push({ name: agentName, icon });
      }
    }

    const getStat = (key: string, fallbackIdx: number) => {
      const idx = colMap[key] ?? fallbackIdx;
      if (idx >= 0 && idx < tdList.length) {
        return cleanHtmlText(tdList[idx]);
      }
      return "";
    };

    players.push({
      name: playerName,
      href: playerHref,
      photo: "",
      agents,
      rating:  getStat("rating", 2),
      acs:     getStat("acs", 3),
      k:       getStat("k", 4),
      d:       getStat("d", 5),
      a:       getStat("a", 6),
      kd_diff: getStat("kd_diff", 7),
      kast:    getStat("kast", 8),
      adr:     getStat("adr", 9),
      hs:      getStat("hs", 10),
      fk:      getStat("fk", 11),
      fd:      getStat("fd", 12),
      fk_diff: getStat("fk_diff", 13),
    });
  }

  return players;
}

function parseDetail(html: string) {
  const { team1_logo, team2_logo } = parseTeamLogos(html);

  // Timestamp
  let unix_timestamp = 0, bst_time = "N/A";
  const tsMatch = html.match(/data-utc-ts="([^"]+)"/);
  if (tsMatch) {
    try {
      const raw = tsMatch[1];
      const [datePart, timePart] = raw.split(" ");
      const [y, mo, d] = datePart.split("-").map(Number);
      const [h, mi, s] = timePart.split(":").map(Number);
      const utcMs = Date.UTC(y, mo - 1, d, h + 5, mi, s);
      unix_timestamp = Math.floor(utcMs / 1000);
      const bstDate = new Date(utcMs + 6 * 3600 * 1000);
      bst_time = bstDate.toISOString().replace("T", " ").slice(0, 16);
    } catch { /* ignore */ }
  }

  const maps: { name: string; score1: string; score2: string; winner: number | null }[] = [];
  const players_by_map: Record<string, { team1: unknown[]; team2: unknown[] }> = {};

  const gameBlocks = html.split(/<div[^>]+class="[^"]*\bvm-stats-game\b[^"]*"/);
  let mapIndex = 0;

  for (let i = 1; i < gameBlocks.length; i++) {
    const block = gameBlocks[i];
    const gameIdMatch = block.match(/data-game-id="([^"]*)"/);
    const game_id = gameIdMatch ? gameIdMatch[1] : "";

    const tableMatches = [...block.matchAll(/<table[^>]*class="[^"]*(?:wf-table-mod-stats|mod-game|table)[^"]*"[^>]*>([\s\S]*?)<\/table>/g)];
    const team1_players = tableMatches[0] ? parsePlayerTable(tableMatches[0][1]) : [];
    const team2_players = tableMatches[1] ? parsePlayerTable(tableMatches[1][1]) : [];
    const playerData = { team1: team1_players, team2: team2_players };

    if (game_id === "all") {
      players_by_map["all"] = playerData;
      continue;
    }

    const mapNameMatch = block.match(/class="map"[\s\S]*?<span>([\s\S]*?)<\/span>/)
      || block.match(/<div[^>]+class="[^"]*\bmap\b[^"]*"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/);
    const map_name = mapNameMatch ? cleanHtmlText(mapNameMatch[1]) : `Map ${mapIndex + 1}`;

    const scoreDivs = [...block.matchAll(/<div[^>]+class="score([^"]*)"[^>]*>([\s\S]*?)<\/div>/g)];
    let score1 = "0", score2 = "0", winner: number | null = null;

    if (scoreDivs.length >= 2) {
      score1 = cleanHtmlText(scoreDivs[0][2]);
      score2 = cleanHtmlText(scoreDivs[1][2]);
      if (scoreDivs[0][1].includes("mod-win")) winner = 0;
      else if (scoreDivs[1][1].includes("mod-win")) winner = 1;
    }

    maps.push({ name: map_name, score1, score2, winner });
    players_by_map[String(mapIndex)] = playerData;
    mapIndex++;
  }

  if (!players_by_map["all"] && Object.keys(players_by_map).length > 0) {
    const firstKey = Object.keys(players_by_map)[0];
    if (firstKey) {
      players_by_map["all"] = players_by_map[firstKey];
    }
  }

  let score1 = "", score2 = "";
  const vsScoreMatch = html.match(/match-header-vs-score[\s\S]*?(\d+)[\s\S]*?(\d+)/);
  if (vsScoreMatch) { score1 = vsScoreMatch[1]; score2 = vsScoreMatch[2]; }

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
  const target = url.startsWith("http") ? url : `https://www.vlr.gg${url.startsWith("/") ? "" : "/"}${url}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(target, { headers: SCRAPE_HEADERS });
      if (r.ok) return await r.text();
      console.error(`Failed ${target}: status ${r.status} (attempt ${attempt})`);
    } catch (e) {
      console.error(`Fetch error ${target} (attempt ${attempt}):`, e);
    }
    if (attempt < 3) await new Promise((res) => setTimeout(res, 500 * attempt));
  }
  return null;
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
        const html = await fetchHTML(href);
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

  let body: {
    scrape_start?: number;
    scrape_end?: number;
    load_details?: boolean;
    match?: Record<string, unknown>;
  } = {};
  try { body = await req.json(); } catch { /* no body fine */ }

  if (body.match) {
    const href = typeof body.match.href === "string" ? body.match.href : "";
    const match_id = String(body.match.match_id ?? body.match.id ?? "");
    if (!match_id) {
      return NextResponse.json({ ok: false, error: "match.match_id is required" }, { status: 400 });
    }

    const targetPath = href || `/${match_id}`;

    try {
      const html = await fetchHTML(targetPath);
      if (!html) {
        return NextResponse.json({ ok: false, error: `Unable to fetch detail page for ${match_id}` }, { status: 502 });
      }
      const details = parseDetail(html);
      await hydratePlayerPhotos(details.players);
      await uploadSingle({ ...body.match, match_id, ...details });
      return NextResponse.json({ ok: true, match_id, detailed: 1 });
    } catch (e) {
      return NextResponse.json({ ok: false, error: String(e), match_id }, { status: 500 });
    }
  }

  const scrapeStart = Number(body.scrape_start ?? 1);
  const scrapeEnd   = Number(body.scrape_end   ?? 5);
  const loadDetails = body.load_details !== false;

  try {
    const result = await runScrape(scrapeStart, scrapeEnd, loadDetails);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "VLR sync endpoint ready. Use POST to trigger." });
}
