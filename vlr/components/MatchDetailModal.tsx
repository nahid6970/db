"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import type { Match, MapPlayers, PlayerStat } from "@/lib/types";

interface MatchDetailModalProps {
  matchId: string;
  allMatchIds: string[];
  whiteLogoTeams: Set<string>;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

export default function MatchDetailModal({
  matchId, allMatchIds, whiteLogoTeams, onClose, onNavigate,
}: MatchDetailModalProps) {
  const match = useQuery(api.matches.getById, { match_id: matchId }) as Match | null | undefined;
  const [activeMap, setActiveMap] = useState<string>("all");

  // Reset active map when match changes
  useEffect(() => { setActiveMap("all"); }, [matchId]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      const idx = allMatchIds.indexOf(matchId);
      if (e.key === "ArrowLeft" && idx > 0) onNavigate(allMatchIds[idx - 1]);
      if (e.key === "ArrowRight" && idx < allMatchIds.length - 1) onNavigate(allMatchIds[idx + 1]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [matchId, allMatchIds, onClose, onNavigate]);

  const idx = allMatchIds.indexOf(matchId);
  const canPrev = idx > 0;
  const canNext = idx < allMatchIds.length - 1;

  if (match === undefined) {
    return (
      <div className="match-detail-overlay" onClick={onClose}>
        <div className="match-detail-modal" onClick={(e) => e.stopPropagation()}>
          <div style={{ padding:"40px", textAlign:"center", color:"var(--text-muted)" }}>
            <i className="fa-solid fa-spinner" style={{ animation:"spin 1s infinite linear", fontSize:"24px" }} />
          </div>
        </div>
      </div>
    );
  }

  if (!match) return null;

  const maps = match.maps ?? [];
  const players = (match.players ?? {}) as Record<string, MapPlayers>;
  const hasStats = Object.keys(players).length > 0;
  const mapKeys = ["all", ...maps.map((_, i) => String(i))].filter((k) => players[k]);

  const s1 = parseInt(match.score1 ?? "", 10);
  const s2 = parseInt(match.score2 ?? "", 10);
  const t1Wins = !isNaN(s1) && !isNaN(s2) && s1 > s2;
  const t2Wins = !isNaN(s1) && !isNaN(s2) && s2 > s1;

  const currentPlayers: MapPlayers | undefined = players[activeMap];

  const renderStatTable = (teamPlayers: PlayerStat[], teamName: string) => {
    if (!teamPlayers?.length) return null;
    const maxAcs = Math.max(...teamPlayers.map((p) => parseFloat(p.acs) || 0));

    return (
      <div className="mdm-stats-row">
        <div className="mdm-stats-team-sidebar">{teamName}</div>
        <div className="mdm-stats-table-wrapper">
          <table className="mdm-stats-table">
            <thead>
              <tr>
                <th><span>Player</span></th>
                <th><span>Agents</span></th>
                <th className="r"><span>R</span></th>
                <th className="r"><span>ACS</span></th>
                <th className="r"><span>K</span></th>
                <th className="r"><span>D</span></th>
                <th className="r"><span>A</span></th>
                <th className="r"><span>+/-</span></th>
                <th className="r"><span>KAST</span></th>
                <th className="r"><span>ADR</span></th>
                <th className="r"><span>HS%</span></th>
                <th className="r"><span>FK</span></th>
                <th className="r"><span>FD</span></th>
              </tr>
            </thead>
            <tbody>
              {teamPlayers.map((p, i) => {
                const acs = parseFloat(p.acs) || 0;
                const isTopAcs = acs === maxAcs && acs > 0;
                const diff = parseInt(p.kd_diff ?? "", 10);
                return (
                  <tr key={i}>
                    <td>
                      <div className="mdm-player-cell">
                        {p.photo ? (
                          <img
                            src={p.photo}
                            alt={p.name}
                            className="mdm-player-photo"
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                          />
                        ) : (
                          <div className="mdm-player-photo-placeholder">
                            <i className="fa-solid fa-user" style={{ fontSize: "12px", color: "var(--text-muted)" }} />
                          </div>
                        )}
                        <span>{p.name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="mdm-agents-container">
                        {p.agents?.map((a, ai) => (
                          <img
                            key={ai}
                            src={a.icon}
                            alt={a.name}
                            title={a.name}
                            className="mdm-agent-icon"
                            onError={(e) => (e.currentTarget.style.display = "none")}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="r">{p.rating}</td>
                    <td className={`r${isTopAcs ? " mdm-acs-top" : ""}`}>{p.acs}</td>
                    <td className="r">{p.k}</td>
                    <td className="r">{p.d}</td>
                    <td className="r">{p.a}</td>
                    <td className={`r ${!isNaN(diff) ? (diff > 0 ? "diff-positive" : diff < 0 ? "diff-negative" : "diff-neutral") : ""}`}>
                      {p.kd_diff}
                    </td>
                    <td className="r">{p.kast}</td>
                    <td className="r">{p.adr}</td>
                    <td className="r">{p.hs}</td>
                    <td className="r">{p.fk}</td>
                    <td className="r">{p.fd}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="match-detail-overlay" onClick={onClose}>
      <button className="mdm-nav-btn prev" onClick={(e) => { e.stopPropagation(); canPrev && onNavigate(allMatchIds[idx-1]); }} disabled={!canPrev}>
        <i className="fa-solid fa-chevron-left" />
      </button>

      <div className="match-detail-modal" onClick={(e) => e.stopPropagation()}>
        <button className="mdm-close-btn" id="mdm-close" onClick={onClose}>×</button>

        {/* Score line */}
        <div className="mdm-scoreline">
          <div className="mdm-team">
            {match.team1_logo && (
              <img
                src={match.team1_logo}
                id="mdm-logo1"
                alt={match.team1}
                className={whiteLogoTeams.has(match.team1) ? "white-bg-logo" : ""}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            )}
            <div className="mdm-team-name">{match.team1}</div>
          </div>
          <div className="mdm-score" id="mdm-score">
            <span className={`score-num${t1Wins ? " winner" : ""}`}>{match.score1 || "–"}</span>
            <span className="score-divider">:</span>
            <span className={`score-num${t2Wins ? " winner" : ""}`}>{match.score2 || "–"}</span>
          </div>
          <div className="mdm-team mdm-team-right">
            {match.team2_logo && (
              <img
                src={match.team2_logo}
                id="mdm-logo2"
                alt={match.team2}
                className={whiteLogoTeams.has(match.team2) ? "white-bg-logo" : ""}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            )}
            <div className="mdm-team-name">{match.team2}</div>
          </div>
        </div>

        {/* Map tabs */}
        {maps.length > 0 && (
          <div id="mdm-maps-section">
            <div className="mdm-maps">
              {mapKeys.map((key) => {
                const mapIdx = key === "all" ? null : parseInt(key, 10);
                const mapObj = mapIdx !== null ? maps[mapIdx] : null;
                const isWin  = mapObj ? (mapObj.winner === 0 ? "mdm-map-win" : mapObj.winner === 1 ? "mdm-map-lose" : "") : "";
                return (
                  <div
                    key={key}
                    className={`mdm-map-card ${isWin}${activeMap === key ? " active" : ""}`}
                    data-key={key}
                    onClick={() => setActiveMap(key)}
                  >
                    <div className="mdm-map-name">{key === "all" ? "Overall" : mapObj?.name ?? `Map ${parseInt(key)+1}`}</div>
                    {mapObj && (
                      <div className="mdm-map-score">
                        <span className={mapObj.winner === 0 ? "mdm-win" : "mdm-lose"}>{mapObj.score1}</span>
                        {" – "}
                        <span className={mapObj.winner === 1 ? "mdm-win" : "mdm-lose"}>{mapObj.score2}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Player stats */}
        {hasStats && currentPlayers ? (
          <div id="mdm-stats-section" style={{ marginTop:"14px" }}>
            {renderStatTable(currentPlayers.team1, match.team1)}
            {renderStatTable(currentPlayers.team2, match.team2)}
          </div>
        ) : (
          <div id="mdm-no-stats" className="mdm-no-stats">
            Stats not yet available for this match.
          </div>
        )}

        {/* Footer */}
        <div className="mdm-footer">
          <span className="mdm-tourney-match-count">{match.tournament}</span>
          <a
            href={`https://www.vlr.gg${match.href}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mdm-vlr-btn"
          >
            VLR.gg ↗
          </a>
        </div>
      </div>

      <button className="mdm-nav-btn next" onClick={(e) => { e.stopPropagation(); canNext && onNavigate(allMatchIds[idx+1]); }} disabled={!canNext}>
        <i className="fa-solid fa-chevron-right" />
      </button>
    </div>
  );
}
