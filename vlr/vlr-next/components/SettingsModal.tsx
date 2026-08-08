"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import type { Settings, IgnoreEntry } from "@/lib/types";

interface SettingsModalProps {
  settings: Settings;
  ignorelist: IgnoreEntry[];
  onClose: () => void;
  onSaveSettings: (args: { settings: unknown }) => Promise<unknown>;
}

export default function SettingsModal({ settings, ignorelist, onClose, onSaveSettings }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"ignore" | "scrape" | "logos">("ignore");
  const [ignoreSearch, setIgnoreSearch] = useState("");
  const [ignoreYear, setIgnoreYear] = useState("all");
  const [teamInput, setTeamInput] = useState("");
  const [scrapeStart, setScrapeStart] = useState(settings.scrape_start ?? 1);
  const [scrapeEnd, setScrapeEnd]     = useState(settings.scrape_end   ?? 5);

  const removeFromIgnore = useMutation(api.settings.removeFromIgnorelist);

  const filteredIgnore = ignorelist.filter((t) => {
    const matchYear = ignoreYear === "all" || t.name.includes(ignoreYear);
    const matchSearch = !ignoreSearch || t.name.toLowerCase().includes(ignoreSearch.toLowerCase());
    return matchYear && matchSearch;
  }).reverse();

  const handleSavePages = async () => {
    await onSaveSettings({ settings: { ...settings, scrape_start: scrapeStart, scrape_end: scrapeEnd } });
  };

  const handleHighlight = async (checked: boolean) => {
    await onSaveSettings({ settings: { ...settings, highlight_loaded_tournaments: checked } });
  };

  const handleThrAll = async (checked: boolean) => {
    await onSaveSettings({ settings: { ...settings, thr_show_all_tournaments: checked } });
  };

  const handleAddWhiteLogo = async () => {
    const name = teamInput.trim();
    if (!name) return;
    const existing = settings.white_logo_teams ?? [];
    if (existing.includes(name)) return;
    await onSaveSettings({ settings: { ...settings, white_logo_teams: [...existing, name] } });
    setTeamInput("");
  };

  const handleRemoveWhiteLogo = async (name: string) => {
    const updated = (settings.white_logo_teams ?? []).filter((t) => t !== name);
    await onSaveSettings({ settings: { ...settings, white_logo_teams: updated } });
  };

  const years = Array.from({ length: 7 }, (_, i) => 2026 - i);

  return (
    <div id="settings-modal" className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><i className="fa-solid fa-gear" /> Settings</h2>
          <button className="modal-close-btn" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="modal-tabs">
          {(["ignore","scrape","logos"] as const).map((tab) => (
            <button
              key={tab}
              className={`modal-tab-btn${activeTab === tab ? " active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "ignore" && <><i className="fa-solid fa-eye-slash" /> IGNORE List</>}
              {tab === "scrape" && <><i className="fa-solid fa-arrows-rotate" /> SCRAPE</>}
              {tab === "logos"  && <><i className="fa-solid fa-palette" /> Team Logos</>}
            </button>
          ))}
        </div>

        <div className="modal-body" style={{ padding:0, display:"flex", flexDirection:"column" }}>

          {/* ── Ignore List Tab ── */}
          {activeTab === "ignore" && (
            <div id="modal-content-ignore" className="modal-tab-content">
              <div className="ignore-header-pinned">
                <h3>Ignore List <span id="ignore-count">({ignorelist.length})</span></h3>
                <p className="modal-section-desc">Tournaments hidden from matches and sidebar. Most recent first.</p>
                <div className="ignore-filters">
                  <select className="sidebar-select" value={ignoreYear} onChange={(e) => setIgnoreYear(e.target.value)}>
                    <option value="all">All Years</option>
                    {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                  </select>
                  <input
                    type="text"
                    className="ignore-search-input"
                    placeholder="Search ignored..."
                    value={ignoreSearch}
                    onChange={(e) => setIgnoreSearch(e.target.value)}
                  />
                </div>
              </div>
              <div id="ignore-list-container" style={{ maxHeight:"40vh", overflowY:"auto", padding:"12px 20px" }}>
                {filteredIgnore.length === 0 ? (
                  <p className="ignore-empty">No tournaments ignored.</p>
                ) : (
                  filteredIgnore.map((t) => (
                    <div key={t.name} className="ignore-item" data-name={t.name}>
                      {t.logo ? (
                        <img src={t.logo} className="ignore-item-logo" onError={(e) => (e.currentTarget.style.display="none")} loading="lazy" alt="" />
                      ) : (
                        <div className="ignore-item-logo-placeholder"><i className="fa-solid fa-trophy" /></div>
                      )}
                      <span className="ignore-item-name" title={t.name}>{t.name}</span>
                      <button className="ignore-remove-btn" onClick={() => removeFromIgnore({ name: t.name })}>
                        <i className="fa-solid fa-circle-xmark" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── Scrape Tab ── */}
          {activeTab === "scrape" && (
            <div id="modal-content-scrape" className="modal-tab-content" style={{ padding:"20px" }}>
              <div className="modal-section" style={{ marginBottom:"24px" }}>
                <h3>Scrape Range</h3>
                <p className="modal-section-desc">Set the page range for syncing completed match results.</p>
                <div className="pages-input-group" style={{ display:"inline-flex", border:"1px solid var(--card-border)", background:"var(--bg-darker)", borderRadius:"var(--border-radius-md)", padding:"8px 12px", gap:"8px", alignItems:"center" }}>
                  <label style={{ fontSize:"13px", fontWeight:700, color:"var(--text-secondary)" }}>Page Range:</label>
                  <input type="number" min={1} value={scrapeStart} onChange={(e) => setScrapeStart(Number(e.target.value))} style={{ width:"48px", background:"transparent", border:"none", color:"var(--text-primary)", textAlign:"center", fontSize:"14px", fontWeight:700, outline:"none" }} />
                  <span style={{ color:"var(--text-muted)", fontWeight:"bold" }}>–</span>
                  <input type="number" min={1} value={scrapeEnd} onChange={(e) => setScrapeEnd(Number(e.target.value))} style={{ width:"48px", background:"transparent", border:"none", color:"var(--text-primary)", textAlign:"center", fontSize:"14px", fontWeight:700, outline:"none" }} />
                  <button id="save-pages-btn" onClick={handleSavePages} title="Save" style={{ background:"none", border:"none", color:"var(--text-muted)", cursor:"pointer", padding:"0 4px", fontSize:"14px" }}>
                    <i className="fa-solid fa-floppy-disk" />
                  </button>
                </div>
              </div>
              <div className="modal-section">
                <h3>Visual Preferences</h3>
                <p className="modal-section-desc">Customize UI highlighting.</p>
                <div style={{ display:"flex", flexDirection:"column", gap:"12px", marginTop:"10px" }}>
                  <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer" }}>
                    <input type="checkbox" className="setting-checkbox" checked={!!settings.highlight_loaded_tournaments} onChange={(e) => handleHighlight(e.target.checked)} />
                    <span className="custom-checkbox" />
                    <span style={{ fontSize:"13px", fontWeight:500, color:"var(--text-primary)" }}>Highlight stats-loaded tournaments</span>
                  </label>
                  <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer" }}>
                    <input type="checkbox" className="setting-checkbox" checked={!!settings.thr_show_all_tournaments} onChange={(e) => handleThrAll(e.target.checked)} />
                    <span className="custom-checkbox" />
                    <span style={{ fontSize:"13px", fontWeight:500, color:"var(--text-primary)" }}>Team History: Show all tournaments</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── White Logo Teams Tab ── */}
          {activeTab === "logos" && (
            <div id="modal-content-white-logos" className="modal-tab-content" style={{ padding:"20px" }}>
              <div className="modal-section">
                <h3>Custom Team Logo Background</h3>
                <p className="modal-section-desc">Teams here get a white background behind their logo on cards.</p>
                <div style={{ display:"flex", gap:"8px", marginBottom:"16px", marginTop:"12px" }}>
                  <input
                    type="text"
                    className="sidebar-select"
                    style={{ flexGrow:1, padding:"8px 12px", height:"36px" }}
                    placeholder="Enter team name exactly..."
                    value={teamInput}
                    onChange={(e) => setTeamInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddWhiteLogo()}
                  />
                  <button className="status-btn" style={{ height:"36px", padding:"0 16px", textTransform:"uppercase" }} onClick={handleAddWhiteLogo}>
                    Add
                  </button>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"8px", maxHeight:"250px", overflowY:"auto", border:"1px solid var(--card-border)", padding:"10px", background:"var(--bg-darker)" }}>
                  {(settings.white_logo_teams ?? []).length === 0 ? (
                    <p className="ignore-empty">No teams added.</p>
                  ) : (
                    (settings.white_logo_teams ?? []).map((team) => (
                      <div key={team} className="white-logo-item">
                        <span>{team}</span>
                        <button className="btn-remove-white-logo" onClick={() => handleRemoveWhiteLogo(team)}>
                          <i className="fa-solid fa-xmark" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
