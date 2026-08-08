"use client";

import { useMemo, useState } from "react";
import type { Match, Settings } from "@/lib/types";

interface TeamHistoryModalProps {
  matches: Match[];
  settings?: Settings;
  whiteLogoTeams: Set<string>;
  onClose: () => void;
}

export default function TeamHistoryModal({ matches, settings, whiteLogoTeams, onClose }: TeamHistoryModalProps) {
  const [selectedTeam, setSelectedTeam] = useState("");
  const [teamSearch, setTeamSearch]     = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFuture, setShowFuture]     = useState(false);

  // Build list of unique teams (with logo from latest match)
  const allTeams = useMemo(() => {
    const map = new Map<string, { name: string; logo: string }>();
    for (const m of matches) {
      if (m.team1 && m.team1 !== "TBD") map.set(m.team1, { name: m.team1, logo: m.team1_logo ?? "" });
      if (m.team2 && m.team2 !== "TBD") map.set(m.team2, { name: m.team2, logo: m.team2_logo ?? "" });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [matches]);

  const filteredTeams = useMemo(() =>
    allTeams.filter((t) => !teamSearch || t.name.toLowerCase().includes(teamSearch.toLowerCase())),
    [allTeams, teamSearch]
  );

  const selectedTeamData = allTeams.find((t) => t.name === selectedTeam);

  // Matches for selected team
  const teamMatches = useMemo(() => {
    if (!selectedTeam) return [];
    const filtered = matches.filter((m) => {
      const isInvolved = m.team1 === selectedTeam || m.team2 === selectedTeam;
      if (!isInvolved) return false;
      if (!showFuture && (m.status === "Upcoming" || m.status === "Live")) return false;
      return true;
    });
    // Sort: completed/live recent first, upcoming last
    return filtered.sort((a, b) => {
      const ta = a.unix_timestamp ?? 0;
      const tb = b.unix_timestamp ?? 0;
      if (a.status === "Completed" && b.status === "Completed") return tb - ta;
      if (a.status === "Upcoming" && b.status === "Upcoming") return ta - tb;
      if (a.status === "Completed") return -1;
      if (b.status === "Completed") return 1;
      return ta - tb;
    });
  }, [matches, selectedTeam, showFuture]);

  // Stats for left panel
  const stats = useMemo(() => {
    const completed = teamMatches.filter((m) => m.status === "Completed");
    let wins = 0, losses = 0;
    for (const m of completed) {
      const s1 = parseInt(m.score1 ?? "0", 10);
      const s2 = parseInt(m.score2 ?? "0", 10);
      if (isNaN(s1) || isNaN(s2)) continue;
      if (m.team1 === selectedTeam ? s1 > s2 : s2 > s1) wins++;
      else losses++;
    }
    const total = wins + losses;
    return { wins, losses, winrate: total ? Math.round((wins / total) * 100) : 0 };
  }, [teamMatches, selectedTeam]);

  // Group by tournament
  const grouped = useMemo(() => {
    const map = new Map<string, { logo: string; matches: Match[] }>();
    for (const m of teamMatches) {
      if (!map.has(m.tournament)) map.set(m.tournament, { logo: m.tournament_logo ?? "", matches: [] });
      map.get(m.tournament)!.matches.push(m);
    }
    return [...map.entries()];
  }, [teamMatches]);

  const getResult = (m: Match) => {
    if (m.status !== "Completed") return m.status.toLowerCase();
    const s1 = parseInt(m.score1 ?? "0", 10);
    const s2 = parseInt(m.score2 ?? "0", 10);
    if (isNaN(s1) || isNaN(s2)) return "draw";
    const myScore = m.team1 === selectedTeam ? s1 : s2;
    const theirScore = m.team1 === selectedTeam ? s2 : s1;
    if (myScore > theirScore) return "win";
    if (myScore < theirScore) return "loss";
    return "draw";
  };

  const getOpponent = (m: Match) => (m.team1 === selectedTeam ? m.team2 : m.team1);
  const getScore    = (m: Match) => {
    const myScore    = m.team1 === selectedTeam ? m.score1 : m.score2;
    const theirScore = m.team1 === selectedTeam ? m.score2 : m.score1;
    return `${myScore ?? "–"} – ${theirScore ?? "–"}`;
  };

  return (
    <div id="team-history-modal" className="match-detail-overlay" onClick={onClose}>
      <div className="match-detail-modal" style={{ maxWidth:"900px" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom:"none", padding:"10px 0 18px 0" }}>
          <h2><i className="fa-solid fa-people-group" /> Team Match History &amp; Results</h2>
          <button className="modal-close-btn" style={{ fontSize:"24px", color:"var(--text-muted)" }} onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body" style={{ padding:0, position:"relative" }}>
          {/* Controls row */}
          <div className="thr-controls-row" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingRight:"20px" }}>
            <div className="thr-dropdown-popover-wrapper">
              <button className="thr-trigger-btn" onClick={() => setShowDropdown((v) => !v)}>
                <span style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  {selectedTeamData?.logo
                    ? <img src={selectedTeamData.logo} className="thr-team-logo" alt="" onError={(e) => (e.currentTarget.style.display="none")} />
                    : <i className="fa-solid fa-people-group" />}
                  <span>{selectedTeam || "Select Team"}</span>
                </span>
                <i className="fa-solid fa-chevron-down thr-trigger-arrow" />
              </button>

              {showDropdown && (
                <div id="team-history-popover-panel" className="custom-search-dropdown-container popover-panel">
                  <div className="csd-search-wrapper">
                    <i className="fa-solid fa-magnifying-glass csd-search-icon" />
                    <input
                      type="text"
                      className="csd-search-input"
                      placeholder="Search team..."
                      autoFocus
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
                    />
                  </div>
                  <div className="csd-options-list">
                    {filteredTeams.length === 0
                      ? <div className="csd-empty-msg">No teams found</div>
                      : filteredTeams.map((t) => (
                          <div
                            key={t.name}
                            className={`csd-option-item${selectedTeam === t.name ? " active" : ""}`}
                            onClick={() => { setSelectedTeam(t.name); setShowDropdown(false); setTeamSearch(""); }}
                          >
                            {t.logo
                              ? <img src={t.logo} className="csd-option-logo" alt="" onError={(e) => (e.currentTarget.style.display="none")} />
                              : <div className="csd-option-placeholder"><i className="fa-solid fa-people-group" /></div>}
                            {t.name}
                          </div>
                        ))
                    }
                  </div>
                </div>
              )}
            </div>

            {selectedTeam && (
              <div className="thr-profile-actions" style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                <button
                  className={`thr-action-btn${showFuture ? " active" : ""}`}
                  title="Toggle upcoming matches"
                  onClick={() => setShowFuture((v) => !v)}
                >
                  <i className="fa-regular fa-calendar-days" style={{ fontSize:"16px" }} />
                </button>
              </div>
            )}
          </div>

          {/* Split layout */}
          <div className="thr-split-container">
            <div className="thr-left-profile" id="thr-left-profile">
              <div className="thr-profile-card">
                <div className="thr-profile-logo-wrapper">
                  {selectedTeamData?.logo
                    ? <img src={selectedTeamData.logo} alt="" style={{ width:64, height:64, objectFit:"contain" }} onError={(e) => (e.currentTarget.style.display="none")} />
                    : <i className="fa-solid fa-people-group" />}
                </div>
                <h3 className="thr-profile-name">{selectedTeam || "Select a Team"}</h3>
                {selectedTeam && (
                  <div className="thr-profile-stats" style={{ display:"flex" }}>
                    <div className="thr-stat-item">
                      <div className="thr-stat-value">{stats.winrate}%</div>
                      <div className="thr-stat-label">Win Rate</div>
                    </div>
                    <div className="thr-stat-item">
                      <div className="thr-stat-value" id="thr-stat-wins">{stats.wins}</div>
                      <div className="thr-stat-label">Wins</div>
                    </div>
                    <div className="thr-stat-item">
                      <div className="thr-stat-value" id="thr-stat-losses">{stats.losses}</div>
                      <div className="thr-stat-label">Losses</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="thr-right-history">
              {!selectedTeam && (
                <p style={{ textAlign:"center", padding:"40px", color:"var(--text-muted)", fontSize:"14px" }}>
                  Select a team from the dropdown above to view match results.
                </p>
              )}
              {selectedTeam && grouped.length === 0 && (
                <p style={{ textAlign:"center", padding:"40px", color:"var(--text-muted)", fontSize:"14px" }}>
                  No match history found for {selectedTeam}.
                </p>
              )}
              {grouped.map(([tourney, data]) => (
                <div key={tourney}>
                  <div className="thr-tourney-group-header">
                    {data.logo && <img src={data.logo} className="thr-logo" alt="" onError={(e) => (e.currentTarget.style.display="none")} />}
                    <span className="thr-name">{tourney}</span>
                  </div>
                  {data.matches.map((m) => {
                    const result   = getResult(m);
                    const opponent = getOpponent(m);
                    const score    = getScore(m);
                    return (
                      <div key={m.match_id} className="team-history-row">
                        <div className="thr-row-bottom">
                          <div className="thr-opponent">
                            <span className="thr-vs-label">VS</span>
                            <span className="thr-opp-name">{opponent}</span>
                          </div>
                          <div className="thr-score-container">
                            <span className="thr-score-val">{score}</span>
                          </div>
                          <span className={`thr-status ${result}`}>{result.toUpperCase()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
