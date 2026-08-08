import type { Match, TournamentOverview } from "./types";

/** Format a unix timestamp as BST (UTC+6) string */
export function formatBST(unix: number): string {
  if (!unix) return "N/A";
  const date = new Date(unix * 1000);
  return date.toLocaleString("en-US", {
    timeZone: "Asia/Dhaka",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Sort matches: Live → Upcoming (asc time) → Completed (desc time) */
export function sortMatches(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => {
    const order = (m: Match) => {
      if (m.status === "Live") return 1;
      if (m.status === "Upcoming") return 2;
      return 3;
    };
    const oa = order(a);
    const ob = order(b);
    if (oa !== ob) return oa - ob;
    const ta = a.unix_timestamp ?? 0;
    const tb = b.unix_timestamp ?? 0;
    // Completed: newest first; others: soonest first
    return oa === 3 ? tb - ta : ta - tb;
  });
}

/** Compute countdown string from unix timestamp */
export function getCountdown(unix: number): string {
  const now = Date.now() / 1000;
  const diff = unix - now;
  if (diff <= 0) return "Starting soon";
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = Math.floor(diff % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Filter matches by active filters */
export function filterMatches(
  matches: Match[],
  opts: {
    search: string;
    statusFilter: string;
    yearFilter: string;
    seriesTags: string[];
    visibleTournaments: string[];
    ignoredNames: Set<string>;
  }
): Match[] {
  const { search, statusFilter, yearFilter, seriesTags, visibleTournaments, ignoredNames } = opts;
  const visSet = new Set(visibleTournaments);

  return matches.filter((m) => {
    if (ignoredNames.has(m.tournament)) return false;
    if (visibleTournaments.length > 0 && !visSet.has(m.tournament)) return false;

    if (statusFilter !== "all") {
      const s = m.status?.toLowerCase() ?? "";
      if (statusFilter === "live" && s !== "live") return false;
      if (statusFilter === "upcoming" && s !== "upcoming") return false;
      if (statusFilter === "completed" && s !== "completed") return false;
    }

    if (yearFilter !== "all") {
      const hasYear =
        m.date?.includes(yearFilter) || m.bst_time?.includes(yearFilter);
      if (!hasYear) return false;
    }

    if (seriesTags.length > 0) {
      const seriesLower = m.series?.toLowerCase() ?? "";
      if (!seriesTags.every((tag) => seriesLower.includes(tag.toLowerCase()))) return false;
    }

    if (search) {
      const q = search.toLowerCase();
      if (
        !m.team1?.toLowerCase().includes(q) &&
        !m.team2?.toLowerCase().includes(q) &&
        !m.tournament?.toLowerCase().includes(q)
      )
        return false;
    }

    return true;
  });
}

/** Sort tournament sidebar entries */
export function sortTournaments(
  tournaments: TournamentOverview[],
  order: Record<string, number>,
  sortMode: "none" | "asc" | "desc"
): TournamentOverview[] {
  return [...tournaments].sort((a, b) => {
    if (sortMode === "none") {
      const pa = order[a.tournament] ?? 9999;
      const pb = order[b.tournament] ?? 9999;
      return pa - pb || a.tournament.localeCompare(b.tournament);
    }
    const ta = a.first_match ?? 0;
    const tb = b.first_match ?? 0;
    return sortMode === "asc" ? ta - tb : tb - ta;
  });
}
