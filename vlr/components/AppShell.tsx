"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Match, Settings, IgnoreEntry, TournamentOverview } from "@/lib/types";
import { sortMatches, filterMatches, sortTournaments, formatBST } from "@/lib/utils";
import Sidebar from "./Sidebar";
import MatchCard from "./MatchCard";
import MatchDetailModal from "./MatchDetailModal";
import SettingsModal from "./SettingsModal";
import TeamHistoryModal from "./TeamHistoryModal";
import LeaderboardModal from "./LeaderboardModal";
import StandingsModal from "./StandingsModal";

export default function AppShell() {
  // ── Convex subscriptions (live-updating) ─────────────────────────────────
  const rawMatches   = useQuery(api.matches.list)        as Match[]           | undefined;
  const tourOverview = useQuery(api.matches.tournamentOverview) as TournamentOverview[] | undefined;
  const settings     = useQuery(api.settings.getSettings) as Settings         | undefined;
  const ignorelist   = useQuery(api.settings.getIgnorelist) as IgnoreEntry[]  | undefined;
  const saveSettings = useMutation(api.settings.saveSettings);

  // ── Local UI state ────────────────────────────────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [statusFilter,     setStatusFilter]     = useState("all");
  const [yearFilter,       setYearFilter]       = useState("all");
  const [search,           setSearch]           = useState("");
  const [seriesTags,       setSeriesTags]       = useState<string[]>([]);
  const [seriesInput,      setSeriesInput]      = useState("");
  const [sortMode,         setSortMode]         = useState<"none"|"asc"|"desc">("none");
  const [perPage,          setPerPage]          = useState("50");
  const [theme,            setTheme]            = useState("dark");
  const [syncing,          setSyncing]          = useState(false);
  const [loadingStats,     setLoadingStats]     = useState(false);
  const [syncError,        setSyncError]        = useState("");
  const [currentPage,      setCurrentPage]      = useState(1);

  // Modal states
  const [detailMatchId,    setDetailMatchId]    = useState<string | null>(null);
  const [showSettings,     setShowSettings]     = useState(false);
  const [showTeamHistory,  setShowTeamHistory]  = useState(false);
  const [showLeaderboard,  setShowLeaderboard]  = useState(false);
  const [showStandings,    setShowStandings]    = useState(false);

  // ── Sync settings into local state once loaded ────────────────────────────
  useEffect(() => {
    if (!settings) return;
    if (settings.per_page)  setPerPage(settings.per_page);
    if (settings.theme)     setTheme(settings.theme);
  }, [settings]);

  // Apply theme to body
  useEffect(() => {
    document.body.classList.toggle("light", theme === "light");
  }, [theme]);

  // Restore sidebar collapse from sessionStorage
  useEffect(() => {
    if (sessionStorage.getItem("sidebarCollapsed") === "1") setSidebarCollapsed(true);
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const ignoredNames = useMemo(
    () => new Set((ignorelist ?? []).map((e) => e.name)),
    [ignorelist]
  );

  const unchecked = useMemo(
    () => new Set(settings?.unchecked_tournaments ?? []),
    [settings]
  );

  const visibleTournaments = useMemo(() => {
    if (!tourOverview) return [];
    return tourOverview
      .filter((t) => !ignoredNames.has(t.tournament) && !unchecked.has(t.tournament))
      .map((t) => t.tournament);
  }, [tourOverview, ignoredNames, unchecked]);

  const filteredMatches = useMemo(() => {
    if (!rawMatches) return [];
    const sorted = sortMatches(rawMatches);
    return filterMatches(sorted, {
      search,
      statusFilter,
      yearFilter,
      seriesTags,
      visibleTournaments,
      ignoredNames,
    });
  }, [rawMatches, search, statusFilter, yearFilter, seriesTags, visibleTournaments, ignoredNames]);

  const paginatedMatches = useMemo(() => {
    if (perPage === "all") return filteredMatches;
    const n = parseInt(perPage, 10);
    const start = (currentPage - 1) * n;
    return filteredMatches.slice(start, start + n);
  }, [filteredMatches, perPage, currentPage]);

  const totalPages = useMemo(() => {
    if (perPage === "all") return 1;
    return Math.max(1, Math.ceil(filteredMatches.length / parseInt(perPage, 10)));
  }, [filteredMatches, perPage]);

  const sortedTournaments = useMemo(() => {
    if (!tourOverview) return [];
    return sortTournaments(
      tourOverview.filter((t) => !ignoredNames.has(t.tournament)),
      settings?.tournament_order ?? {},
      sortMode
    );
  }, [tourOverview, ignoredNames, settings, sortMode]);

  const tournamentColors = settings?.tournament_colors ?? {};
  const whiteLogoTeams   = useMemo(() => new Set(settings?.white_logo_teams ?? []), [settings]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncError("");
    try {
      // POST to the Vercel route handler.
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scrape_start: settings?.scrape_start ?? 1,
          scrape_end:   settings?.scrape_end   ?? 5,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncError(j.error ?? "Sync failed");
      } else if (j.ok === false) {
        setSyncError(j.error ?? "Sync did not load any matches");
      }
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setSyncing(false);
    }
  }, [settings]);

  const hasMissingStats = useMemo(
    () => sortedTournaments.some((t) => !t.fully_loaded),
    [sortedTournaments]
  );

  const handleLoadStats = useCallback(async () => {
    setLoadingStats(true);
    setSyncError("");
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scrape_start: settings?.scrape_start ?? 1,
          scrape_end:   settings?.scrape_end   ?? 5,
          load_details: true,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncError(j.error ?? "Stats load failed");
      } else if (j.ok === false) {
        setSyncError(j.error ?? "Stats load did not load any matches");
      }
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setLoadingStats(false);
    }
  }, [settings]);

  // Note: /api/sync is served by the Next route handler.

  const toggleTheme = useCallback(async () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (settings) {
      await saveSettings({ settings: { ...settings, theme: next } });
    }
  }, [theme, settings, saveSettings]);

  const toggleTournament = useCallback(async (name: string) => {
    if (!settings) return;
    const current = new Set(settings.unchecked_tournaments);
    if (current.has(name)) current.delete(name); else current.add(name);
    await saveSettings({ settings: { ...settings, unchecked_tournaments: [...current] } });
  }, [settings, saveSettings]);

  const handlePerPageChange = useCallback(async (val: string) => {
    setPerPage(val);
    setCurrentPage(1);
    if (settings) await saveSettings({ settings: { ...settings, per_page: val } });
  }, [settings, saveSettings]);

  // Navigation indexes for detail modal
  const visibleMatchIds = useMemo(
    () => paginatedMatches.map((m) => m.match_id),
    [paginatedMatches]
  );

  return (
    <div className="app-container">
      {/* ── Header ── */}
      <header className="app-header" id="app-header-main">
        <div className="logo-area">
          <div className="sidebar-toggles">
            {!sidebarCollapsed ? (
              <button
                className="sidebar-toggle-btn"
                title="Hide sidebar"
                onClick={() => { setSidebarCollapsed(true); sessionStorage.setItem("sidebarCollapsed","1"); }}
              >
                <i className="fa-solid fa-angles-left" />
              </button>
            ) : (
              <button
                className="sidebar-toggle-btn"
                title="Show sidebar"
                onClick={() => { setSidebarCollapsed(false); sessionStorage.setItem("sidebarCollapsed","0"); }}
              >
                <i className="fa-solid fa-angles-right" />
              </button>
            )}
          </div>
          <i className="fa-solid fa-crosshairs logo-icon" />
          <select
            className="sidebar-select sort-tourney-select"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as "none"|"asc"|"desc")}
            title="Sort tournaments"
          >
            <option value="none">Pin order</option>
            <option value="asc">Date ↑</option>
            <option value="desc">Date ↓</option>
          </select>
        </div>

        <div className="header-right">
          <div className="status-filters">
            {hasMissingStats && (
              <button
                className="status-btn"
                style={{ color: "var(--accent-green)", borderColor: "rgba(0,245,155,0.3)", background: "rgba(0,245,155,0.05)" }}
                title="Load missing match and player stats"
                onClick={handleLoadStats}
                disabled={loadingStats}
              >
                {loadingStats ? (
                  <><i className="fa-solid fa-arrows-rotate spinning" /> Stats…</>
                ) : (
                  <>Load Stats</>
                )}
              </button>
            )}
            {(["all","live","upcoming","completed"] as const).map((s) => (
              <button
                key={s}
                className={`status-btn${statusFilter === s ? " active" : ""}`}
                data-status={s}
                onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
              >
                {s === "live" ? "🔴 Live" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <select
            className="per-page-select"
            value={perPage}
            onChange={(e) => handlePerPageChange(e.target.value)}
          >
            {["10","20","50","100","200","300","400","500","all"].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          <div className="header-divider" />

          <button
            className="refresh-btn"
            style={{ background:"rgba(0,245,155,0.1)", borderColor:"var(--accent-green)", color:"var(--accent-green)" }}
            title="Player Stats Leaderboard"
            onClick={() => setShowLeaderboard(true)}
          >
            <i className="fa-solid fa-chart-simple" />
          </button>
          <button
            className="refresh-btn"
            style={{ background:"rgba(59,130,246,0.1)", borderColor:"#3b82f6", color:"#3b82f6" }}
            title="Team Match History"
            onClick={() => setShowTeamHistory(true)}
          >
            <i className="fa-solid fa-people-group" />
          </button>
          <button
            className="refresh-btn"
            style={{ background:"rgba(255,165,0,0.1)", borderColor:"orange", color:"orange" }}
            title="Tournament Standings"
            onClick={() => setShowStandings(true)}
          >
            <i className="fa-solid fa-ranking-star" />
          </button>
          <button className="refresh-btn" title="Sync matches data" onClick={handleSync}>
            <i className={`fa-solid fa-arrows-rotate${syncing ? " spinning" : ""}`} />
          </button>

          <div className="header-divider" />

          <button id="theme-toggle-btn" title="Toggle theme" onClick={toggleTheme}>
            <i className={`fa-solid ${theme === "light" ? "fa-sun" : "fa-moon"}`} />
          </button>
          <button id="settings-btn" title="Settings" onClick={() => setShowSettings(true)}>
            <i className="fa-solid fa-gear" />
          </button>
        </div>
      </header>

      {syncError && (
        <div style={{ background:"rgba(255,70,85,0.1)", border:"1px solid var(--accent-red)", padding:"8px 24px", fontSize:"12px", color:"var(--accent-red)" }}>
          Sync error: {syncError}
        </div>
      )}

      {/* ── Main Layout ── */}
      <div className="main-layout">
        <Sidebar
          collapsed={sidebarCollapsed}
          tournaments={sortedTournaments}
          unchecked={unchecked}
          settings={settings}
          ignorelist={ignorelist ?? []}
          search={search}
          onSearchChange={setSearch}
          yearFilter={yearFilter}
          onYearChange={setYearFilter}
          seriesInput={seriesInput}
          onSeriesInputChange={setSeriesInput}
          seriesTags={seriesTags}
          onAddSeriesTag={() => {
            const v = seriesInput.trim();
            if (v && !seriesTags.includes(v)) setSeriesTags([...seriesTags, v]);
            setSeriesInput("");
          }}
          onRemoveSeriesTag={(t) => setSeriesTags(seriesTags.filter((x) => x !== t))}
          onToggleTournament={toggleTournament}
          onSelectAll={async () => {
            if (!settings) return;
            await saveSettings({ settings: { ...settings, unchecked_tournaments: [] } });
          }}
          onDeselectAll={async () => {
            if (!settings) return;
            const all = sortedTournaments.map((t) => t.tournament);
            await saveSettings({ settings: { ...settings, unchecked_tournaments: all } });
          }}
          onSaveSettings={saveSettings}
          tournamentColors={tournamentColors}
        />

        <main className="content-area">
          <div className="matches-grid" id="matches-grid-container">
            {rawMatches === undefined ? (
              <div className="no-matches-fallback">
                <i className="fa-solid fa-spinner fallback-icon" style={{ animation:"spin 1s infinite linear" }} />
                <h3>Loading…</h3>
              </div>
            ) : paginatedMatches.length === 0 ? (
              <div className="no-matches-fallback">
                <i className="fa-solid fa-gamepad fallback-icon" />
                <h3>No Schedules Found</h3>
                <p>Click the sync button to fetch latest matches from VLR.gg.</p>
              </div>
            ) : (
              <>
                {paginatedMatches.map((match, idx) => {
                  // Insert separator before first completed match
                  const prevMatch = paginatedMatches[idx - 1];
                  const separator =
                    match.status === "Completed" &&
                    (idx === 0 || prevMatch?.status !== "Completed") ? (
                      <div key={`sep-${match.match_id}`} className="grid-separator">
                        <div className="grid-separator-line" />
                        <span className="grid-separator-text">
                          <i className="fa-solid fa-clock-rotate-left" /> Past Results
                        </span>
                        <div className="grid-separator-line" />
                      </div>
                    ) : null;

                  return (
                    <>
                      {separator}
                      <MatchCard
                        key={match.match_id}
                        match={match}
                        tournamentColor={tournamentColors[match.tournament]}
                        whiteLogoTeams={whiteLogoTeams}
                        onClick={() => setDetailMatchId(match.match_id)}
                      />
                    </>
                  );
                })}
              </>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display:"flex", justifyContent:"center", gap:"8px", padding:"24px 0", flexWrap:"wrap" }}>
              <button className="status-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>«</button>
              <button className="status-btn" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>‹</button>
              <span style={{ padding:"6px 14px", color:"var(--text-secondary)", fontSize:"13px" }}>
                {currentPage} / {totalPages}
              </span>
              <button className="status-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>›</button>
              <button className="status-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>»</button>
            </div>
          )}
        </main>
      </div>

      {/* ── Modals ── */}
      {detailMatchId && (
        <MatchDetailModal
          matchId={detailMatchId}
          allMatchIds={visibleMatchIds}
          whiteLogoTeams={whiteLogoTeams}
          onClose={() => setDetailMatchId(null)}
          onNavigate={setDetailMatchId}
        />
      )}
      {showSettings && settings && (
        <SettingsModal
          settings={settings}
          ignorelist={ignorelist ?? []}
          onClose={() => setShowSettings(false)}
          onSaveSettings={saveSettings}
        />
      )}
      {showTeamHistory && rawMatches && (
        <TeamHistoryModal
          matches={rawMatches.filter((m) => !ignoredNames.has(m.tournament))}
          settings={settings}
          whiteLogoTeams={whiteLogoTeams}
          onClose={() => setShowTeamHistory(false)}
        />
      )}
      {showLeaderboard && rawMatches && (
        <LeaderboardModal
          matches={rawMatches.filter((m) => !ignoredNames.has(m.tournament))}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
      {showStandings && rawMatches && (
        <StandingsModal
          matches={rawMatches.filter((m) => !ignoredNames.has(m.tournament))}
          onClose={() => setShowStandings(false)}
        />
      )}
    </div>
  );
}
