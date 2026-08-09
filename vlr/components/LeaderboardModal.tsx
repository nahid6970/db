"use client";

import { useMemo, useState } from "react";
import type { Match, PlayerStat } from "@/lib/types";

interface LeaderboardModalProps {
  matches: Match[];
  onClose: () => void;
}

interface AggregatedPlayer extends PlayerStat {
  team: string;
  team_logo: string;
  matches_played: number;
  avg_rating: number;
  avg_acs: number;
  avg_kast: number;
  avg_adr: number;
  avg_hs: number;
  total_k: number;
  total_d: number;
  total_a: number;
  total_kd_diff: number;
  total_fk: number;
  total_fd: number;
  total_fk_diff: number;
}

export default function LeaderboardModal({ matches, onClose }: LeaderboardModalProps) {
  const [search,       setSearch]       = useState("");
  const [splitByTeam,  setSplitByTeam]  = useState(false);
  const [hideAgents,   setHideAgents]   = useState(false);
  const [sortCol,      setSortCol]      = useState("avg_acs");
  const [sortDir,      setSortDir]      = useState<"asc"|"desc">("desc");

  const players = useMemo(() => {
    // Aggregate player stats from all completed matches with full stats
    const map = new Map<string, AggregatedPlayer>();

    for (const m of matches) {
      if (m.status !== "Completed" || !m.players) continue;
      const allData = (m.players as Record<string, { team1: PlayerStat[]; team2: PlayerStat[] }>)["all"];
      if (!allData) continue;

      const processTeam = (teamPlayers: PlayerStat[], teamName: string, teamLogo: string) => {
        for (const p of teamPlayers) {
          if (!p.name) continue;
          const key = splitByTeam ? `${p.name}__${teamName}` : p.name;

          const existing = map.get(key);
          const rating  = parseFloat(p.rating) || 0;
          const acs     = parseFloat(p.acs)    || 0;
          const kast    = parseFloat(p.kast?.replace("%","") ?? "0") || 0;
          const adr     = parseFloat(p.adr)    || 0;
          const hs      = parseFloat(p.hs?.replace("%","") ?? "0") || 0;
          const k       = parseInt(p.k  ?? "0", 10) || 0;
          const d       = parseInt(p.d  ?? "0", 10) || 0;
          const a       = parseInt(p.a  ?? "0", 10) || 0;
          const kd_diff = parseInt(p.kd_diff ?? "0", 10) || 0;
          const fk      = parseInt(p.fk ?? "0", 10) || 0;
          const fd      = parseInt(p.fd ?? "0", 10) || 0;
          const fk_diff = parseInt(p.fk_diff ?? "0", 10) || 0;

          if (existing) {
            const n = existing.matches_played;
            existing.avg_rating = (existing.avg_rating * n + rating) / (n + 1);
            existing.avg_acs    = (existing.avg_acs    * n + acs)    / (n + 1);
            existing.avg_kast   = (existing.avg_kast   * n + kast)   / (n + 1);
            existing.avg_adr    = (existing.avg_adr    * n + adr)    / (n + 1);
            existing.avg_hs     = (existing.avg_hs     * n + hs)     / (n + 1);
            existing.total_k       += k;
            existing.total_d       += d;
            existing.total_a       += a;
            existing.total_kd_diff += kd_diff;
            existing.total_fk      += fk;
            existing.total_fd      += fd;
            existing.total_fk_diff += fk_diff;
            existing.matches_played++;
            // Merge agents
            for (const ag of p.agents ?? []) {
              if (!existing.agents.find((x) => x.name === ag.name)) existing.agents.push(ag);
            }
            if (!existing.photo && p.photo) existing.photo = p.photo;
          } else {
            map.set(key, {
              ...p,
              team: teamName,
              team_logo: teamLogo,
              matches_played: 1,
              avg_rating: rating,
              avg_acs:    acs,
              avg_kast:   kast,
              avg_adr:    adr,
              avg_hs:     hs,
              total_k: k, total_d: d, total_a: a, total_kd_diff: kd_diff,
              total_fk: fk, total_fd: fd, total_fk_diff: fk_diff,
            });
          }
        }
      };

      processTeam(allData.team1 ?? [], m.team1, m.team1_logo ?? "");
      processTeam(allData.team2 ?? [], m.team2, m.team2_logo ?? "");
    }
    return [...map.values()];
  }, [matches, splitByTeam]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = q ? players.filter((p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)) : players;
    result = [...result].sort((a, b) => {
      const va = ((a as unknown as Record<string, unknown>)[sortCol] as number) ?? 0;
      const vb = ((b as unknown as Record<string, unknown>)[sortCol] as number) ?? 0;
      return sortDir === "desc" ? vb - va : va - vb;
    });
    return result;
  }, [players, search, sortCol, sortDir]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const thClass = (col: string) =>
    sortCol === col ? (sortDir === "desc" ? "th-sort-desc" : "th-sort-asc") : "";

  const fmt = (n: number, dec = 2) => isNaN(n) ? "–" : n.toFixed(dec);

  return (
    <div id="player-leaderboard-modal" className="match-detail-overlay" onClick={onClose}>
      <div className="match-detail-modal" style={{ maxWidth:"950px" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom:"none", padding:"10px 0 18px 0", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"12px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"16px", flexWrap:"wrap", flex:1 }}>
            <h2 style={{ display:"flex", alignItems:"center", gap:"10px", margin:0, whiteSpace:"nowrap" }}>
              <i className="fa-solid fa-chart-simple" /> Player Aggregated Statistics
            </h2>
            <div className="search-box" style={{ width:"200px", minWidth:"150px", margin:0 }}>
              <i className="fa-solid fa-magnifying-glass search-icon" style={{ fontSize:"12px", left:"12px" }} />
              <input type="text" id="leaderboard-search" placeholder="Search player..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"14px", flexWrap:"wrap" }}>
            <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", userSelect:"none" }}>
              <input type="checkbox" className="setting-checkbox" checked={splitByTeam} onChange={(e) => setSplitByTeam(e.target.checked)} />
              <span className="custom-checkbox" />
              <span style={{ fontSize:"13px", fontWeight:500, color:"var(--text-primary)" }}>Split by Team</span>
            </label>
            <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", userSelect:"none" }}>
              <input type="checkbox" className="setting-checkbox" checked={hideAgents} onChange={(e) => setHideAgents(e.target.checked)} />
              <span className="custom-checkbox" />
              <span style={{ fontSize:"13px", fontWeight:500, color:"var(--text-primary)" }}>Hide Agents</span>
            </label>
            <button className="modal-close-btn" onClick={onClose} style={{ fontSize:"24px", color:"var(--text-muted)" }}>&times;</button>
          </div>
        </div>

        <div id="leaderboard-stats-section">
          <div className="mdm-stats-table-wrapper" style={{ maxHeight:"70vh", overflowY:"auto" }}>
            <table className={`mdm-stats-table${hideAgents ? " hide-agents-column" : ""}`} id="leaderboard-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort("name")} className={thClass("name")}><span>Player</span></th>
                  <th><span>Agents</span></th>
                  <th className={`r ${thClass("matches_played")}`} onClick={() => handleSort("matches_played")}><span>Matches</span></th>
                  <th className={`r ${thClass("avg_rating")}`}     onClick={() => handleSort("avg_rating")}><span>Avg R</span></th>
                  <th className={`r ${thClass("avg_acs")}`}        onClick={() => handleSort("avg_acs")}><span>Avg ACS</span></th>
                  <th className={`r ${thClass("total_k")}`}        onClick={() => handleSort("total_k")}><span>K</span></th>
                  <th className={`r ${thClass("total_d")}`}        onClick={() => handleSort("total_d")}><span>D</span></th>
                  <th className={`r ${thClass("total_a")}`}        onClick={() => handleSort("total_a")}><span>A</span></th>
                  <th className={`r ${thClass("total_kd_diff")}`}  onClick={() => handleSort("total_kd_diff")}><span>+/-</span></th>
                  <th className={`r ${thClass("avg_kast")}`}       onClick={() => handleSort("avg_kast")}><span>Avg KAST</span></th>
                  <th className={`r ${thClass("avg_adr")}`}        onClick={() => handleSort("avg_adr")}><span>Avg ADR</span></th>
                  <th className={`r ${thClass("avg_hs")}`}         onClick={() => handleSort("avg_hs")}><span>Avg HS%</span></th>
                  <th className={`r ${thClass("total_fk")}`}       onClick={() => handleSort("total_fk")}><span>FK</span></th>
                  <th className={`r ${thClass("total_fd")}`}       onClick={() => handleSort("total_fd")}><span>FD</span></th>
                  <th className={`r ${thClass("total_fk_diff")}`}  onClick={() => handleSort("total_fk_diff")}><span>FK+/-</span></th>
                </tr>
              </thead>
              <tbody id="leaderboard-tbody">
                {filtered.map((p, i) => (
                  <tr key={i}>
                    <td>
                      <div className="mdm-player-cell">
                        {p.team_logo && <img src={p.team_logo} alt="" className="mdm-player-team-logo" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display="none")} />}
                        {p.photo ? <img src={p.photo} alt={p.name} className="mdm-player-photo" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display="none")} /> : <div className="mdm-player-photo-placeholder" />}
                        <span>{p.name}</span>
                        {splitByTeam && <span style={{ fontSize:"11px", color:"var(--text-muted)", marginLeft:"4px" }}>({p.team})</span>}
                      </div>
                    </td>
                    <td>
                      <div className="mdm-agents-container">
                        {p.agents?.slice(0,4).map((a, ai) => (
                          <img key={ai} src={a.icon} alt={a.name} className="mdm-agent-icon" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display="none")} />
                        ))}
                      </div>
                    </td>
                    <td className="r">{p.matches_played}</td>
                    <td className="r">{fmt(p.avg_rating)}</td>
                    <td className="r mdm-acs-top">{fmt(p.avg_acs)}</td>
                    <td className="r">{p.total_k}</td>
                    <td className="r">{p.total_d}</td>
                    <td className="r">{p.total_a}</td>
                    <td className={`r ${p.total_kd_diff > 0 ? "diff-positive" : p.total_kd_diff < 0 ? "diff-negative" : "diff-neutral"}`}>{p.total_kd_diff > 0 ? "+" : ""}{p.total_kd_diff}</td>
                    <td className="r">{fmt(p.avg_kast)}%</td>
                    <td className="r">{fmt(p.avg_adr)}</td>
                    <td className="r">{fmt(p.avg_hs)}%</td>
                    <td className="r">{p.total_fk}</td>
                    <td className="r">{p.total_fd}</td>
                    <td className={`r ${p.total_fk_diff > 0 ? "diff-positive" : p.total_fk_diff < 0 ? "diff-negative" : "diff-neutral"}`}>{p.total_fk_diff > 0 ? "+" : ""}{p.total_fk_diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
