"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { TournamentOverview, Settings, IgnoreEntry } from "@/lib/types";

interface SidebarProps {
  collapsed: boolean;
  tournaments: TournamentOverview[];
  unchecked: Set<string>;
  settings?: Settings;
  ignorelist: IgnoreEntry[];
  search: string;
  onSearchChange: (v: string) => void;
  yearFilter: string;
  onYearChange: (v: string) => void;
  seriesInput: string;
  onSeriesInputChange: (v: string) => void;
  seriesTags: string[];
  onAddSeriesTag: () => void;
  onRemoveSeriesTag: (t: string) => void;
  onToggleTournament: (name: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSaveSettings: (args: { settings: unknown }) => Promise<unknown>;
  tournamentColors: Record<string, string>;
}

export default function Sidebar({
  collapsed,
  tournaments,
  unchecked,
  settings,
  ignorelist,
  search,
  onSearchChange,
  yearFilter,
  onYearChange,
  seriesInput,
  onSeriesInputChange,
  seriesTags,
  onAddSeriesTag,
  onRemoveSeriesTag,
  onToggleTournament,
  onSelectAll,
  onDeselectAll,
  onSaveSettings,
  tournamentColors,
}: SidebarProps) {
  const addToIgnorelist   = useMutation(api.settings.addToIgnorelist);
  const removeFromIgnore  = useMutation(api.settings.removeFromIgnorelist);

  const handleColorChange = async (tourneyName: string, color: string) => {
    if (!settings) return;
    const colors = { ...(settings.tournament_colors ?? {}), [tourneyName]: color };
    await onSaveSettings({ settings: { ...settings, tournament_colors: colors } });
  };

  const handleIgnoreUnchecked = async () => {
    if (!settings) return;
    const toIgnore = tournaments.filter((t) => unchecked.has(t.tournament));
    if (!toIgnore.length) return;
    await addToIgnorelist({ entries: toIgnore.map((t) => ({ name: t.tournament, logo: t.tournament_logo })) });
    const remaining = settings.unchecked_tournaments.filter(
      (n) => !toIgnore.find((t) => t.tournament === n)
    );
    await onSaveSettings({ settings: { ...settings, unchecked_tournaments: remaining } });
  };

  const handleIgnoreChecked = async () => {
    if (!settings) return;
    const toIgnore = tournaments.filter((t) => !unchecked.has(t.tournament));
    if (!toIgnore.length) return;
    await addToIgnorelist({ entries: toIgnore.map((t) => ({ name: t.tournament, logo: t.tournament_logo })) });
  };

  const years = Array.from({ length: 7 }, (_, i) => 2026 - i);

  return (
    <aside className={`sidebar${collapsed ? " sidebar-collapsed" : ""}`} id="filter-sidebar">
      <div className="sidebar-header">
        <h2><i className="fa-solid fa-sliders" /> Filters &amp; Tournaments</h2>
      </div>

      {/* Filters row */}
      <div className="sidebar-filters">
        <select
          id="filter-year"
          className="sidebar-select"
          value={yearFilter}
          onChange={(e) => onYearChange(e.target.value)}
        >
          <option value="all">All Years</option>
          {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
        </select>
        <div className="series-filter-group">
          <input
            type="text"
            id="filter-series-input"
            className="ignore-search-input"
            placeholder="Filter series..."
            value={seriesInput}
            onChange={(e) => onSeriesInputChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAddSeriesTag()}
          />
        </div>
      </div>

      {seriesTags.length > 0 && (
        <div id="custom-series-tags" className="custom-series-tags">
          {seriesTags.map((tag) => (
            <span key={tag} className="series-tag">
              {tag}
              <button className="series-tag-remove" onClick={() => onRemoveSeriesTag(tag)}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="search-box">
        <i className="fa-solid fa-magnifying-glass search-icon" />
        <input
          type="text"
          id="team-search"
          placeholder="Search teams..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Tournament list */}
      <div className="filter-group tourney-group">
        <div className="tourney-group-header">
          <h3>Tournaments <span id="tourney-count">({tournaments.length})</span></h3>
          <div className="tourney-actions">
            <button className="text-btn" onClick={onSelectAll}>All</button>
            <button className="text-btn" onClick={onDeselectAll}>Clear</button>
          </div>
        </div>
        <div
          className={`tourney-list${settings?.highlight_loaded_tournaments ? " highlight-tournaments" : ""}`}
          id="tournament-checklist"
        >
          {tournaments.length === 0 ? (
            <div className="no-tournaments-fallback">
              <p>No active tournaments found.</p>
            </div>
          ) : (
            tournaments.map((t) => {
              const checked = !unchecked.has(t.tournament);
              const color   = tournamentColors[t.tournament] ?? "#1e293b";
              return (
                <label
                  key={t.tournament}
                  className={`tourney-item ${t.fully_loaded ? "tourney-fully-loaded" : "tourney-not-loaded"}`}
                  data-tourney-name={t.tournament}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    className="tourney-checkbox"
                    value={t.tournament}
                    onChange={() => onToggleTournament(t.tournament)}
                  />
                  <span className="custom-checkbox" />
                  {t.tournament_logo ? (
                    <img
                      src={t.tournament_logo}
                      alt=""
                      className="sidebar-tourney-logo"
                      referrerPolicy="no-referrer"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                      loading="lazy"
                    />
                  ) : (
                    <div className="sidebar-tourney-placeholder">
                      <i className="fa-solid fa-trophy" />
                    </div>
                  )}
                  <span className="tourney-label-text" title={t.tournament}>
                    {t.tournament}
                  </span>
                  {(settings?.tournament_order ?? {})[t.tournament] !== undefined && (
                    <span className="tourney-pin-badge">
                      #{settings!.tournament_order[t.tournament]}
                    </span>
                  )}
                  <input
                    type="color"
                    className="tourney-color-picker"
                    title="Customize card color"
                    data-tourney-name={t.tournament}
                    defaultValue={color}
                    onBlur={(e) => handleColorChange(t.tournament, e.target.value)}
                  />
                </label>
              );
            })
          )}
        </div>
      </div>

      <div className="ignore-btns-row">
        <button className="ignore-unchecked-btn" title="Ignore unchecked tournaments" onClick={handleIgnoreUnchecked}>
          <i className="fa-solid fa-eye-slash" /> Unchecked
        </button>
        <button className="ignore-unchecked-btn" title="Ignore checked tournaments" onClick={handleIgnoreChecked}>
          <i className="fa-solid fa-eye-slash" /> Checked
        </button>
      </div>
    </aside>
  );
}
