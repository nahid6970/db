"use client";

import { useMemo, useState } from "react";
import type { Match } from "@/lib/types";

interface StandingsModalProps {
  matches: Match[];
  onClose: () => void;
}

interface TeamStanding {
  team: string;
  logo: string;
  wins: number;
  losses: number;
  maps_won: number;
  maps_lost: number;
  win_rate: number;
}

export default function StandingsModal({ matches, onClose }: StandingsModalProps) {
  const [search, setSearch] = useState("");

  // Build standings per tournament
  const tournamentStandings = useMemo(() => {
    const byTourney = new Map<string, { logo: string; teams: Map<string, TeamStanding> }>();

    for (const m of matches) {
      if (m.status !== "Completed") continue;
      const s1 = parseInt(m.score1 ?? "0", 10);
      const s2 = parseInt(m.score2 ?? "0", 10);
      if (isNaN(s1) || isNaN(s2)) continue;

      if (!byTourney.has(m.tournament)) {
        byTourney.set(m.tournament, { logo: m.tournament_logo ?? "", teams: new Map() });
      }
      const tourney = byTourney.get(m.tournament)!;

      const ensureTeam = (name: string, logo: string) => {
        if (!tourney.teams.has(name)) {
          tourney.teams.set(name, { team: name, logo, wins: 0, losses: 0, maps_won: 0, maps_lost: 0, win_rate: 0 });
        }
        return tourney.teams.get(name)!;
      };

      const t1 = ensureTeam(m.team1, m.team1_logo ?? "");
      const t2 = ensureTeam(m.team2, m.team2_logo ?? "");

      if (s1 > s2) { t1.wins++; t2.losses++; }
      else if (s2 > s1) { t2.wins++; t1.losses++; }

      t1.maps_won  += s1; t1.maps_lost += s2;
      t2.maps_won  += s2; t2.maps_lost += s1;
    }

    // Compute win rates and sort
    const result: Array<{ tourney: string; logo: string; standings: TeamStanding[] }> = [];
    for (const [tourney, data] of byTourney) {
      const standings = [...data.teams.values()].map((t) => ({
        ...t,
        win_rate: t.wins + t.losses > 0 ? Math.round((t.wins / (t.wins + t.losses)) * 100) : 0,
      })).sort((a, b) => b.wins - a.wins || b.win_rate - a.win_rate);
      result.push({ tourney, logo: data.logo, standings });
    }

    return result.sort((a, b) => a.tourney.localeCompare(b.tourney));
  }, [matches]);

  const filtered = useMemo(() => {
    if (!search) return tournamentStandings;
    const q = search.toLowerCase();
    return tournamentStandings
      .filter((t) => t.tourney.toLowerCase().includes(q) || t.standings.some((s) => s.team.toLowerCase().includes(q)))
      .map((t) => ({
        ...t,
        standings: t.standings.filter((s) => !search || t.tourney.toLowerCase().includes(q) || s.team.toLowerCase().includes(q)),
      }));
  }, [tournamentStandings, search]);

  return (
    <div id="tournament-standings-modal" className="match-detail-overlay" onClick={onClose}>
      <div className="match-detail-modal" style={{ maxWidth:"900px" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom:"none", padding:"10px 0 18px 0", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"12px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"16px", flexWrap:"wrap", flex:1 }}>
            <h2 style={{ display:"flex", alignItems:"center", gap:"10px", margin:0, whiteSpace:"nowrap" }}>
              <i className="fa-solid fa-ranking-star" /> Tournament Standings
            </h2>
            <div className="search-box" style={{ width:"260px", minWidth:"180px", margin:0 }}>
              <i className="fa-solid fa-magnifying-glass search-icon" style={{ fontSize:"12px", left:"12px" }} />
              <input type="text" id="standings-search" placeholder="Search tournament or team..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} style={{ fontSize:"24px", color:"var(--text-muted)" }}>&times;</button>
        </div>

        <div className="modal-body" style={{ padding:"0 4px 12px 4px", maxHeight:"75vh", overflowY:"auto", color:"var(--text-primary)" }}>
          <div id="tournament-standings-content">
            {filtered.length === 0 && (
              <p style={{ textAlign:"center", padding:"40px", color:"var(--text-muted)", fontSize:"14px" }}>
                {search ? `No results for "${search}"` : "No completed matches found."}
              </p>
            )}
            {filtered.map(({ tourney, logo, standings }) => (
              <div key={tourney} className="standings-tourney-card">
                <div className="standings-tourney-header">
                  {logo && <img src={logo} alt="" className="standings-tourney-logo" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display="none")} />}
                  <span className="standings-tourney-title">{tourney}</span>
                  <span className="standings-tourney-badge">{standings.length} teams</span>
                </div>
                <table className="standings-table">
                  <thead>
                    <tr>
                      <th><span>#</span></th>
                      <th><span>Team</span></th>
                      <th className="r"><span>W</span></th>
                      <th className="r"><span>L</span></th>
                      <th className="r"><span>Maps W</span></th>
                      <th className="r"><span>Maps L</span></th>
                      <th className="r"><span>Win %</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, i) => (
                      <tr key={s.team} className="standings-team-row">
                        <td className={`standings-rank${i < 3 ? ` rank-${i+1}` : ""}`}>{i + 1}</td>
                        <td>
                          <div className="standings-team-cell">
                            {s.logo && <img src={s.logo} alt="" className="standings-team-logo" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display="none")} />}
                            {s.team}
                          </div>
                        </td>
                        <td className="r" style={{ color:"var(--accent-green)", fontWeight:700 }}>{s.wins}</td>
                        <td className="r" style={{ color:"var(--accent-red)" }}>{s.losses}</td>
                        <td className="r">{s.maps_won}</td>
                        <td className="r">{s.maps_lost}</td>
                        <td className="r">
                          <span className="standings-win-rate-pill">{s.win_rate}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
