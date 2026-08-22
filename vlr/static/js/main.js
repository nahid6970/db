document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements



    // Theme toggle
    const themeBtn = document.getElementById("theme-toggle-btn");
    const themeIcon = themeBtn?.querySelector("i");
    // Set icon based on current body class (set server-side)
    if (document.body.classList.contains("light")) {
        if (themeIcon) themeIcon.className = "fa-solid fa-sun";
    }
    themeBtn?.addEventListener("click", async () => {
        const isLight = document.body.classList.toggle("light");
        if (themeIcon) themeIcon.className = isLight ? "fa-solid fa-sun" : "fa-solid fa-moon";
        // Persist theme to server settings
        const settings = await fetch("/api/settings").then(r => r.json());
        settings.theme = isLight ? "light" : "dark";
        fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(settings)
        });
    });

    // Restore scroll position on page load
    const savedScroll = sessionStorage.getItem("scrollY");
    if (savedScroll) { window.scrollTo(0, parseInt(savedScroll)); sessionStorage.removeItem("scrollY"); }
    window.addEventListener("beforeunload", () => sessionStorage.setItem("scrollY", window.scrollY));
    const searchInput = document.getElementById("team-search");
    const filterYear = document.getElementById("filter-year");
    const filterSeries = document.getElementById("filter-series-input");
    const sortTourneyOrder = document.getElementById("sort-tourney-order");
    const perPageSelect = document.getElementById("per-page-select");
    const statusFilterSelect = document.getElementById("status-filter-select");
    const tourneyCheckboxes = document.querySelectorAll("#tournament-checklist .tourney-checkbox");
    const selectAllBtn = document.getElementById("btn-select-all");
    const deselectAllBtn = document.getElementById("btn-deselect-all");
    const loadMissingStatsBtn = document.getElementById("btn-load-missing-stats");
    const loadMissingStatsProgress = document.getElementById("load-missing-stats-progress");
    const missingStatsStatus = document.getElementById("load-missing-stats-status");
    const missingStatsStatusProgress = document.getElementById("missing-stats-status-progress");
    const missingStatsCurrent = document.getElementById("missing-stats-current");
    const missingStatsProgressBar = document.getElementById("missing-stats-progress-bar");
    const missingStatsActivity = document.getElementById("missing-stats-activity");
    let missingStatsStatusTimer = null;
    const refreshBtn = document.getElementById("refresh-data-btn");
    const matchesGrid = document.getElementById("matches-grid-container");

    // Sidebar collapse / expand
    const filterSidebar = document.getElementById("filter-sidebar");
    const collapseBtn = document.getElementById("btn-collapse-sidebar");
    const expandBtn = document.getElementById("btn-expand-sidebar");

    function setSidebarCollapsed(collapsed) {
        if (!filterSidebar) return;
        if (collapsed) {
            filterSidebar.classList.add("sidebar-collapsed");
            if (collapseBtn) collapseBtn.classList.add("hidden");
            if (expandBtn) expandBtn.classList.remove("hidden");
        } else {
            filterSidebar.classList.remove("sidebar-collapsed");
            if (collapseBtn) collapseBtn.classList.remove("hidden");
            if (expandBtn) expandBtn.classList.add("hidden");
        }
        sessionStorage.setItem("sidebarCollapsed", collapsed ? "1" : "0");
    }

    // Restore saved state
    if (sessionStorage.getItem("sidebarCollapsed") === "1") {
        setSidebarCollapsed(true);
    }

    collapseBtn?.addEventListener("click", () => setSidebarCollapsed(true));
    expandBtn?.addEventListener("click", () => setSidebarCollapsed(false));
    
    // NOTE: Missing-stats loading is handled by the one-by-one client-side loop below
    // (in "2b. Missing Stats Loader Logic"). We intentionally do NOT trigger the
    // server-side bulk scraper (load_missing_stats) from this button anymore —
    // that fetched every match from vlr.gg in parallel and caused the site to
    // rate-limit/block this IP (connection timeouts). Loading one match at a time
    // with delays avoids the ban.
    
    // Global filter state
    let activeStatus = sessionStorage.getItem("activeStatus") || "all";

    // Restore active status filter in the dropdown
    if (statusFilterSelect) statusFilterSelect.value = activeStatus;
    let searchQuery = "";
    let checkedTournaments = new Set();
    let customSeriesFilters = [];
    let tournamentOrder = {}; // {name: position}
    let whiteLogoTeams = new Set();
    let tournamentColors = {};

    function applyTournamentColors() {
        document.querySelectorAll(".match-card").forEach(card => {
            const tourney = card.getAttribute("data-tournament");
            const color = tournamentColors[tourney];
            if (color && color !== "#1e293b") {
                card.style.setProperty("--card-bg", color);
            } else {
                card.style.removeProperty("--card-bg");
            }
        });
    }
    
    // Initialize checked tournaments
    tourneyCheckboxes.forEach(cb => {
        if (cb.checked) checkedTournaments.add(cb.value);
    });

    // Render initial matches client-side
    if (typeof INITIAL_MATCHES !== "undefined") {
        renderMatchesGrid(INITIAL_MATCHES);
    }

    // Apply initial filters based on saved settings
    applyFilters();
    updateMissingStatsLoaderButton();

    // Check if we should auto-open a match or team history modal based on URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const matchIdParam = urlParams.get("match");
    if (matchIdParam) {
        fetch(`/api/match/${matchIdParam}`)
            .then(r => r.json())
            .then(matchObj => {
                if (matchObj && !matchObj.error) {
                    openMatchDetail(matchIdParam, matchObj);
                }
            })
            .catch(err => console.error("Failed to auto-open match detail:", err));
    }

    const teamParam = urlParams.get("team");
    if (teamParam) {
        // Delay slightly to ensure DOM elements are fully initialized
        setTimeout(() => showTeamHistory(teamParam), 100);
    }

    // Open VLR.gg page on card click
    if (matchesGrid) {
        matchesGrid.addEventListener("click", e => {
            const card = e.target.closest(".match-card");
            if (!card) return;
            const mid = card.getAttribute("data-id");
            if (mid) openMatchDetail(mid, card);
        });
    }

    // Match detail modal
    const detailOverlay = document.getElementById("match-detail-overlay");
    let currentDetailId = null;
    let currentS1 = "";
    let currentS2 = "";
    const tourneyMatchCountEl = document.getElementById("mdm-tourney-match-count");

    document.getElementById("mdm-close")?.addEventListener("click", closeMatchDetail);
    detailOverlay?.addEventListener("click", e => { 
        if (e.target === detailOverlay) closeMatchDetail(); 
    });

    function closeMatchDetail() {
        if (detailOverlay) detailOverlay.style.display = "none";
    }

    // Global utility helpers
    const formatDiff = (diff) => {
        if (!diff) return "";
        const val = parseInt(diff);
        if (isNaN(val)) return diff;
        if (val > 0) return `<span class="diff-positive">+${val}</span>`;
        if (val < 0) return `<span class="diff-negative">${val}</span>`;
        return `<span class="diff-neutral">0</span>`;
    };

    const renderAgents = agents => {
        if (!agents || !agents.length) return "";
        const icons = agents.map(a =>
            a.icon ? `<img class="mdm-agent-icon" src="${a.icon}" alt="${a.name}" title="${a.name}">` : `<span>${a.name}</span>`
        ).join("");
        return `<div class="mdm-agents-container">${icons}</div>`;
    };

    async function openMatchDetail(mid, cardOrObj, options = {}) {
        currentDetailId = mid;
        const forceRefresh = Boolean(options.refresh);
        
        const isDom = cardOrObj instanceof HTMLElement;
        let s1, s2, href, tournament, name1, name2, logo1, logo2;

        if (isDom) {
            s1 = cardOrObj.getAttribute("data-score1") || "";
            s2 = cardOrObj.getAttribute("data-score2") || "";
            href = cardOrObj.getAttribute("data-href") || "";
            tournament = cardOrObj.getAttribute("data-tournament") || "";
            name1 = cardOrObj.querySelector(".team-1 .team-name")?.textContent.trim() || "";
            name2 = cardOrObj.querySelector(".team-2 .team-name")?.textContent.trim() || "";
            logo1 = cardOrObj.querySelector(".team-1 .team-logo")?.src || "";
            logo2 = cardOrObj.querySelector(".team-2 .team-logo")?.src || "";
        } else {
            const m = cardOrObj || (typeof INITIAL_MATCHES !== "undefined" ? INITIAL_MATCHES.find(item => item.id === mid) : {}) || {};
            s1 = m.score1 || "";
            s2 = m.score2 || "";
            href = m.href || "";
            tournament = m.tournament || "";
            name1 = m.team1 || "";
            name2 = m.team2 || "";
            logo1 = m.team1_logo || "";
            logo2 = m.team2_logo || "";
        }

        currentS1 = s1;
        currentS2 = s2;

        document.getElementById("mdm-tourney").textContent = tournament;
        document.getElementById("mdm-vlr-link").href = "https://www.vlr.gg" + href;
        document.getElementById("mdm-name1").textContent = name1;
        document.getElementById("mdm-name2").textContent = name2;
        updateTournamentMatchCount(mid, tournament);
        
        const img1 = document.getElementById("mdm-logo1");
        const img2 = document.getElementById("mdm-logo2");
        img1.src = logo1; img1.style.display = logo1 ? "" : "none";
        img2.src = logo2; img2.style.display = logo2 ? "" : "none";
        img1.classList.toggle("white-bg-logo", whiteLogoTeams.has(name1));
        img2.classList.toggle("white-bg-logo", whiteLogoTeams.has(name2));

        const scoreEl = document.getElementById("mdm-score");
        if (s1 !== "" && s2 !== "") {
            const n1 = parseInt(s1), n2 = parseInt(s2);
            scoreEl.innerHTML = `<span class="score-num ${n1 > n2 ? 'winner' : ''}">${s1}</span><span class="score-divider">-</span><span class="score-num ${n2 > n1 ? 'winner' : ''}">${s2}</span>`;
        } else {
            scoreEl.textContent = "vs";
        }

        document.getElementById("mdm-maps").innerHTML = "";
        document.getElementById("mdm-stats").innerHTML = "";
        document.getElementById("mdm-maps-section").style.display = "none";
        document.getElementById("mdm-stats-section").style.display = "none";
        document.getElementById("mdm-no-stats").style.display = "none";
        detailOverlay.style.display = "flex";
        updateMdmNavButtons();

        // Fetch full data
        try {
            const detailUrl = forceRefresh ? `/api/match/${mid}?refresh=true` : `/api/match/${mid}`;
            const data = await fetch(detailUrl).then(r => r.json());
            renderMatchDetail(data, s1, s2);
            updateMdmNavButtons();
        } catch(e) {
            document.getElementById("mdm-no-stats").style.display = "";
        }
    }

    function renderMatchDetail(data, fallbackS1, fallbackS2) {
        const mdmImg1 = document.getElementById("mdm-logo1");
        const mdmImg2 = document.getElementById("mdm-logo2");
        if (mdmImg1) mdmImg1.classList.toggle("white-bg-logo", whiteLogoTeams.has(data.team1));
        if (mdmImg2) mdmImg2.classList.toggle("white-bg-logo", whiteLogoTeams.has(data.team2));

        const s1 = data.score1 || fallbackS1 || "";
        const s2 = data.score2 || fallbackS2 || "";
        const scoreEl = document.getElementById("mdm-score");
        if (s1 !== "" && s2 !== "") {
            const n1 = parseInt(s1), n2 = parseInt(s2);
            scoreEl.innerHTML = `<span class="score-num ${n1 > n2 ? 'winner' : ''}">${s1}</span><span class="score-divider">-</span><span class="score-num ${n2 > n1 ? 'winner' : ''}">${s2}</span>`;
        }

        // Synchronize the updated score and status onto the dashboard card
        if (data.id) {
            const card = document.querySelector(`.match-card[data-id="${data.id}"]`);
            if (card) {
                card.setAttribute("data-score1", s1);
                card.setAttribute("data-score2", s2);
                if (data.status) {
                    card.setAttribute("data-status", data.status.toLowerCase());
                    const statusBadge = card.querySelector(".match-status-badge");
                    if (statusBadge) {
                        statusBadge.className = `match-status-badge status-${data.status.toLowerCase()}`;
                        if (data.status === "Live") {
                            statusBadge.innerHTML = '<span class="live-dot"></span> LIVE';
                        } else if (data.status === "Completed") {
                            const hasStats = matchHasCompleteDetails(data);
                            if (hasStats) {
                                statusBadge.innerHTML = '<i class="fa-solid fa-circle-check stats-loaded-check" title="Stats Loaded"></i> COMPLETED';
                            } else {
                                statusBadge.textContent = "COMPLETED";
                            }
                        } else {
                            statusBadge.textContent = data.status;
                        }
                    }
                }
                const vsScoreContainer = card.querySelector(".match-vs-score");
                if (vsScoreContainer) {
                    if (data.status === "Upcoming") {
                        vsScoreContainer.innerHTML = '<span class="vs-label">VS</span>';
                    } else {
                        const n1 = parseInt(s1) || 0;
                        const n2 = parseInt(s2) || 0;
                        const completed = data.status === "Completed";
                        vsScoreContainer.innerHTML = `
                            <div class="score-display">
                                <span class="score-num ${completed && n1 > n2 ? 'winner' : ''}">${s1 || '0'}</span>
                                <span class="score-divider">-</span>
                                <span class="score-num ${completed && n2 > n1 ? 'winner' : ''}">${s2 || '0'}</span>
                            </div>
                        `;
                    }
                }
                const countdownContainer = card.querySelector(".countdown-container");
                if (countdownContainer) {
                    if (data.status === "Live") {
                        countdownContainer.style.display = "";
                        countdownContainer.className = "countdown-container status-live-container";
                        countdownContainer.innerHTML = `
                            <span class="live-pulse-indicator"></span>
                            <span class="live-countdown-text">In Progress</span>
                        `;
                    } else if (data.status === "Completed") {
                        countdownContainer.className = "countdown-container status-completed-container";
                        countdownContainer.innerHTML = "";
                        countdownContainer.removeAttribute("data-timestamp");
                        countdownContainer.style.display = "none";
                    } else {
                        countdownContainer.style.display = "";
                    }
                }
            }
        }
        updateTournamentMatchCount(data.id || currentDetailId, data.tournament || "");

        const maps = data.maps || [];
        const playersByMap = data.players || {};
        const hasStats = matchHasCompleteStats(data);
        const hasMaps = maps.length > 0;

        if (!hasMaps && !hasStats) { document.getElementById("mdm-no-stats").style.display = ""; return; }

        // Render combined Maps row acting as tabs
        document.getElementById("mdm-maps-section").style.display = "";
        const mapsHtml = [];
        // Add "All Maps" card first
        mapsHtml.push(`
            <div class="mdm-map-card" data-key="all">
                <div class="mdm-map-name">All Maps</div>
                <div class="mdm-map-score">${s1 !== "" && s2 !== "" ? `<span>${s1}</span> – <span>${s2}</span>` : "vs"}</div>
            </div>
        `);
        // Add individual map cards
        maps.forEach((m, i) => {
            const winCls = m.winner === 0 ? "mdm-map-win" : (m.winner === 1 ? "mdm-map-lose" : "");
            const s1cls = m.winner === 0 ? "mdm-win" : "mdm-lose";
            const s2cls = m.winner === 1 ? "mdm-win" : "mdm-lose";
            mapsHtml.push(`
                <div class="mdm-map-card ${winCls}" data-key="${i}">
                    <div class="mdm-map-name">${m.name}</div>
                    <div class="mdm-map-score"><span class="${s1cls}">${m.score1}</span> – <span class="${s2cls}">${m.score2}</span></div>
                </div>
            `);
        });
        document.getElementById("mdm-maps").innerHTML = mapsHtml.join("");

        if (!hasStats) {
            document.getElementById("mdm-no-stats").style.display = "";
            return;
        }

        const statsEl = document.getElementById("mdm-stats");
        const maxAcs = arr => Math.max(...arr.map(p => parseInt(p.acs) || 0));

        const renderTable = (plist, label) => {
            if (!plist?.length) return "";
            const topAcs = maxAcs(plist);
            const rows = plist.map(p => `<tr>
                <td><div class="mdm-player-cell">${p.photo ? `<img class="mdm-player-photo" src="${p.photo}" alt="${p.name}">` : '<div class="mdm-player-photo-placeholder"></div>'}<span>${p.name}</span></div></td>
                <td>${renderAgents(p.agents)}</td>
                <td class="r">${p.rating || ""}</td>
                <td class="r ${(parseInt(p.acs)||0) === topAcs ? 'mdm-acs-top' : ''}">${p.acs}</td>
                <td class="r">${p.k}</td>
                <td class="r">${p.d}</td>
                <td class="r">${p.a}</td>
                <td class="r">${formatDiff(p.kd_diff)}</td>
                <td class="r">${p.kast}</td>
                <td class="r">${p.adr}</td>
                <td class="r">${p.hs}</td>
                <td class="r">${p.fk || ""}</td>
                <td class="r">${p.fd || ""}</td>
                <td class="r">${formatDiff(p.fk_diff)}</td>
            </tr>`).join("");
            return `<div class="mdm-stats-row">
                <div class="mdm-stats-team-sidebar">${label}</div>
                <div class="mdm-stats-table-wrapper">
                    <table class="mdm-stats-table"><thead><tr>
                        <th><span>Player</span></th>
                        <th><span>Agent</span></th>
                        <th class="r"><span>R</span></th>
                        <th class="r"><span>ACS</span></th>
                        <th class="r"><span>K</span></th>
                        <th class="r"><span>D</span></th>
                        <th class="r"><span>A</span></th>
                        <th class="r"><span>+/-</span></th>
                        <th class="r"><span>KAST</span></th>
                        <th class="r"><span>ADR</span></th>
                        <th class="r"><span>HS%</span></th>
                        <th class="r"><span>FK</span></th>
                        <th class="r"><span>FD</span></th>
                        <th class="r"><span>+/-</span></th>
                    </tr></thead><tbody>${rows}</tbody></table>
                </div>
            </div>`;
        };

        const showMapStats = (key) => {
            const pd = playersByMap[key] || {};
            statsEl.innerHTML = renderTable(pd.team1, data.team1 || "Team 1") + renderTable(pd.team2, data.team2 || "Team 2");
            document.querySelectorAll("#mdm-maps .mdm-map-card").forEach(c => {
                c.classList.toggle("active", c.getAttribute("data-key") === key);
            });
        };

        const hasTabs = Object.keys(playersByMap).length > 0;
        if (hasTabs) {
            document.getElementById("mdm-stats-section").style.display = "";
            const mapCards = document.querySelectorAll("#mdm-maps .mdm-map-card");
            mapCards.forEach(card => {
                card.addEventListener("click", () => {
                    showMapStats(card.getAttribute("data-key"));
                });
            });
            showMapStats(playersByMap["all"] ? "all" : "0");
        }
    }

    function updateTournamentMatchCount(matchId, tournamentName) {
        if (!tourneyMatchCountEl) return;
        if (!matchId || !tournamentName || typeof INITIAL_MATCHES === "undefined" || !Array.isArray(INITIAL_MATCHES)) {
            tourneyMatchCountEl.textContent = "";
            return;
        }

        const selectedTourneys = checkedTournaments.size
            ? checkedTournaments
            : new Set(INITIAL_MATCHES.map(m => m && m.tournament).filter(Boolean));
        const selectedMatches = INITIAL_MATCHES.filter(m => m && m.tournament && selectedTourneys.has(m.tournament));
        if (!selectedMatches.length) {
            tourneyMatchCountEl.textContent = "";
            return;
        }

        const targetId = String(matchId);
        const index = selectedMatches.findIndex(m => String(m.id) === targetId);
        const current = index >= 0 ? index + 1 : "";
        tourneyMatchCountEl.textContent = current ? `${current}/${selectedMatches.length}` : `1/${selectedMatches.length}`;
    }

    // Save tournament settings to backend
    async function saveTournamentSettings() {
        const unchecked = [];
        const checkboxes = document.querySelectorAll("#tournament-checklist .tourney-checkbox");
        checkboxes.forEach(cb => {
            if (!cb.checked) {
                unchecked.push(cb.value);
            }
        });
        
        try {
            const current = await fetch("/api/settings").then(r => r.json());
            current.unchecked_tournaments = unchecked;
            await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(current)
            });
        } catch (err) {
            console.error("Failed to save settings:", err);
        }
    }

    async function reloadMatchesFromView() {
        try {
            const response = await fetch("/api/matches/view");
            if (!response.ok) throw new Error("Failed to load matches view");
            const matches = await response.json();
            INITIAL_MATCHES = matches;
            renderMatchesGrid(matches);
            applyFilters();
            updateMissingStatsLoaderButton();
            return matches;
        } catch (err) {
            console.error("Failed to refresh matches view:", err);
            return null;
        }
    }

    // Sidebar tournament visibility filters (year + series)
    const customTagsContainer = document.getElementById("custom-series-tags");

    function renderSeriesTags() {
        if (!customTagsContainer) return;
        customTagsContainer.innerHTML = "";
        customSeriesFilters.forEach((tag, i) => {
            const el = document.createElement("span");
            el.className = "series-tag";
            el.innerHTML = `${tag}<button class="series-tag-remove" data-i="${i}">×</button>`;
            customTagsContainer.appendChild(el);
        });
        customTagsContainer.querySelectorAll(".series-tag-remove").forEach(btn => {
            btn.addEventListener("click", () => {
                customSeriesFilters.splice(parseInt(btn.dataset.i), 1);
                renderSeriesTags(); applyTourneyFilters(); applyFilters(); saveSidebarFilters();
            });
        });
    }

    function applyTourneyFilters() {
        const year = filterYear ? filterYear.value : "all";
        const series = filterSeries ? filterSeries.value.trim().toUpperCase() : "";
        document.querySelectorAll(".tourney-item").forEach(item => {
            const name = item.getAttribute("data-tourney-name") || "";
            const nameUpper = name.toUpperCase();
            const yearMatch = year === "all" || name.includes(year);
            const seriesMatch = !series || nameUpper.includes(series);
            const customMatch = customSeriesFilters.length === 0 || customSeriesFilters.some(t => nameUpper.includes(t));
            item.style.display = (yearMatch && seriesMatch && customMatch) ? "" : "none";
        });
        const visible = document.querySelectorAll(".tourney-item:not([style*='display: none'])").length;
        const countEl = document.getElementById("tourney-count");
        if (countEl) countEl.textContent = `(${visible})`;
    }

    async function saveSidebarFilters() {
        const cur = await fetch("/api/settings").then(r => r.json()).catch(() => ({}));
        cur.filter_year = filterYear ? filterYear.value : "all";
        cur.filter_custom_series = customSeriesFilters;
        cur.tourney_sort_order = sortTourneyOrder ? sortTourneyOrder.value : "none";
        await fetch("/api/settings", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(cur) });
    }

    function sortTourneyByDate() {
        const order = sortTourneyOrder ? sortTourneyOrder.value : "none";
        const checklist = document.getElementById("tournament-checklist");
        if (!checklist || order === "none") return;
        const items = Array.from(checklist.querySelectorAll(".tourney-item"));
        items.sort((a, b) => {
            const aPin = tournamentOrder[a.dataset.tourneyName] ?? null;
            const bPin = tournamentOrder[b.dataset.tourneyName] ?? null;
            // Pinned items always come first, sorted by pin number
            if (aPin !== null && bPin !== null) return aPin - bPin;
            if (aPin !== null) return -1;
            if (bPin !== null) return 1;
            // Non-pinned: sort by first match date
            const aTs = (typeof TOURNEY_FIRST_MATCH !== "undefined" && TOURNEY_FIRST_MATCH[a.dataset.tourneyName]) || 0;
            const bTs = (typeof TOURNEY_FIRST_MATCH !== "undefined" && TOURNEY_FIRST_MATCH[b.dataset.tourneyName]) || 0;
            return order === "asc" ? aTs - bTs : bTs - aTs;
        });
        items.forEach(el => checklist.appendChild(el));
    }

    sortTourneyOrder?.addEventListener("change", () => { sortTourneyByDate(); saveSidebarFilters(); });

    // Init filter values from settings
    fetch("/api/settings").then(r => r.json()).then(s => {
        if (s.tournament_pages_per_load) tournamentPagesPerLoad = Math.max(1, Math.min(59, parseInt(s.tournament_pages_per_load) || 5));
        if (filterYear && s.filter_year) filterYear.value = s.filter_year;
        if (sortTourneyOrder && s.tourney_sort_order) sortTourneyOrder.value = s.tourney_sort_order;
        if (s.filter_custom_series?.length) { customSeriesFilters = s.filter_custom_series; renderSeriesTags(); }
        if (s.tournament_order) tournamentOrder = s.tournament_order;
        if (s.white_logo_teams) {
            whiteLogoTeams = new Set(s.white_logo_teams);
            renderWhiteLogoTeamsList();
            applyWhiteLogoStylesToCurrentCards();
        }
        // Restore "Team History: Show all tournaments" setting
        // Note: thrFilterSelectedTourneys = true means "filter to checked only"
        // The setting thr_show_all_tournaments = true means "show all" = thrFilterSelectedTourneys = false
        if (s.thr_show_all_tournaments !== undefined) {
            thrFilterSelectedTourneys = !s.thr_show_all_tournaments;
        }
        const color = s.white_logo_bg_color || "#eef1f6";
        document.documentElement.style.setProperty('--white-logo-bg-color', color);
        const picker = document.getElementById("white-logo-bg-color-picker");
        const text = document.getElementById("white-logo-bg-color-text");
        if (picker) picker.value = color;
        if (text) text.value = color;
        if (s.tournament_colors) {
            tournamentColors = s.tournament_colors;
            applyTournamentColors();
        }
        applyTourneyFilters();
        sortTourneyByDate();
    });

    // Tournament pin context menu
    const ctxMenu = document.getElementById("tourney-ctx-menu");
    const ctxInput = document.getElementById("ctx-order-input");
    const ctxConfirm = document.getElementById("ctx-order-confirm");
    const ctxClear = document.getElementById("ctx-order-clear");
    let ctxTarget = null;

    async function saveTournamentOrder() {
        const cur = await fetch("/api/settings").then(r => r.json()).catch(() => ({}));
        cur.tournament_order = tournamentOrder;
        await fetch("/api/settings", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(cur) });
    }

    function setPinOrder(name, newPos) {
        const oldPos = tournamentOrder[name];
        // Remove from old position and close the gap
        if (oldPos != null) {
            Object.keys(tournamentOrder).forEach(k => {
                if (k !== name && tournamentOrder[k] > oldPos) tournamentOrder[k]--;
            });
        }
        // Shift items at >= newPos up to make room
        Object.keys(tournamentOrder).forEach(k => {
            if (k !== name && tournamentOrder[k] >= newPos) tournamentOrder[k]++;
        });
        tournamentOrder[name] = newPos;
    }

    function hideCtxMenu() { if (ctxMenu) ctxMenu.style.display = "none"; ctxTarget = null; }

    document.addEventListener("contextmenu", e => {
        const item = e.target.closest(".tourney-item");
        if (!item) { hideCtxMenu(); return; }
        e.preventDefault();
        ctxTarget = item.getAttribute("data-tourney-name");
        if (ctxInput) ctxInput.value = tournamentOrder[ctxTarget] ?? "";
        if (ctxMenu) {
            ctxMenu.style.display = "block";
            ctxMenu.style.left = Math.min(e.clientX, window.innerWidth - 180) + "px";
            ctxMenu.style.top = Math.min(e.clientY, window.innerHeight - 100) + "px";
        }
    });

    ctxConfirm?.addEventListener("click", () => {
        const pos = parseInt(ctxInput?.value);
        if (!ctxTarget || isNaN(pos) || pos < 1) return;
        setPinOrder(ctxTarget, pos);
        saveTournamentOrder();
        hideCtxMenu();
        // Re-sort visible items
        const checklist = document.getElementById("tournament-checklist");
        if (checklist) {
            const items = Array.from(checklist.querySelectorAll(".tourney-item"));
            items.sort((a, b) => {
                const aPin = tournamentOrder[a.dataset.tourneyName] ?? 9999;
                const bPin = tournamentOrder[b.dataset.tourneyName] ?? 9999;
                return aPin !== bPin ? aPin - bPin : (a.dataset.tourneyName || "").localeCompare(b.dataset.tourneyName || "");
            });
            items.forEach(el => {
                // Update badge
                let badge = el.querySelector(".tourney-pin-badge");
                const name = el.dataset.tourneyName;
                const order = tournamentOrder[name];
                if (order != null) {
                    if (!badge) { badge = document.createElement("span"); badge.className = "tourney-pin-badge"; el.appendChild(badge); }
                    badge.textContent = `#${order}`;
                } else if (badge) badge.remove();
                checklist.appendChild(el);
            });
        }
        applyTourneyFilters();
    });

    ctxClear?.addEventListener("click", () => {
        if (!ctxTarget) return;
        delete tournamentOrder[ctxTarget];
        saveTournamentOrder();
        const item = document.querySelector(`.tourney-item[data-tourney-name="${CSS.escape(ctxTarget)}"]`);
        item?.querySelector(".tourney-pin-badge")?.remove();
        hideCtxMenu();
    });

    ctxInput?.addEventListener("keydown", e => { if (e.key === "Enter") ctxConfirm?.click(); if (e.key === "Escape") hideCtxMenu(); });
    document.addEventListener("click", e => { if (ctxMenu && !ctxMenu.contains(e.target)) hideCtxMenu(); });

    filterYear?.addEventListener("change", () => { applyTourneyFilters(); applyFilters(); saveSidebarFilters(); });
    filterSeries?.addEventListener("input", () => { applyTourneyFilters(); applyFilters(); });



    // 2. Live Countdown Timers
    function updateCountdowns() {
        const countdownContainers = document.querySelectorAll(".countdown-container[data-timestamp]");
        const now = new Date().getTime();
        
        countdownContainers.forEach(container => {
            const timestamp = parseInt(container.getAttribute("data-timestamp"));
            if (!timestamp) return;
            
            const timerSpan = container.querySelector(".countdown-timer");
            if (!timerSpan) return;
            
            const diff = timestamp - now;
            
            if (diff <= 0) {
                // Match has started
                timerSpan.textContent = "Started";
                timerSpan.style.color = "var(--accent-green)";
                const card = container.closest(".match-card");
                if (card && card.getAttribute("data-status") === "upcoming") {
                    card.setAttribute("data-status", "live");
                    const statusBadge = card.querySelector(".match-status-badge");
                    if (statusBadge) {
                        statusBadge.className = "match-status-badge status-live";
                        statusBadge.innerHTML = '<span class="live-dot"></span> LIVE';
                    }
                }
            } else {
                // Calculate days, hours, minutes, seconds
                const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);
                
                let countdownStr = "";
                if (d > 0) countdownStr += `${d}d `;
                if (h > 0 || d > 0) countdownStr += `${h}h `;
                countdownStr += `${m}m`;
                
                timerSpan.textContent = countdownStr;
            }
        });
    }
    setInterval(updateCountdowns, 1000);
    updateCountdowns();

    // 2b. Missing Stats Loader Logic
    function matchHasCompleteStats(match) {
        if (!match) return false;
        if (typeof match.has_stats !== "undefined") return Boolean(match.has_stats);
        const maps = Array.isArray(match.maps) ? match.maps : [];
        const allStats = match.players && match.players.all;
        return maps.length > 0 && Array.isArray(allStats?.team1) && allStats.team1.length > 0
            && Array.isArray(allStats?.team2) && allStats.team2.length > 0;
    }

    function matchHasCompleteDetails(match) {
        if (!match) return false;
        if (typeof match.has_details !== "undefined") return Boolean(match.has_details);
        if (!matchHasCompleteStats(match)) return false;
        const players = match.players || {};
        return Object.values(players).every(mapData =>
            !mapData || ["team1", "team2"].every(team =>
                (mapData[team] || []).every(player => Boolean(player.photo))
            )
        );
    }

    function getCheckedTournamentNames() {
        return new Set(Array.from(
            document.querySelectorAll("#tournament-checklist .tourney-checkbox:checked")
        ).map(cb => cb.value));
    }

    function missingStatsLogoMarkup(name, logo) {
        const safeName = escapeHtml(name || "TBD");
        const initial = escapeHtml((name || "T").trim().charAt(0).toUpperCase() || "T");
        if (!logo) return `<span class="missing-stats-team-fallback">${initial}</span>`;
        return `<img class="missing-stats-team-logo" src="${escapeHtml(logo)}" alt="${safeName} logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><span class="missing-stats-team-fallback" style="display:none;">${initial}</span>`;
    }

    function updateMissingStatsStatus(match, index, total, state = "loading") {
        if (!missingStatsStatus || !missingStatsCurrent) return;
        if (missingStatsStatusTimer) {
            clearTimeout(missingStatsStatusTimer);
            missingStatsStatusTimer = null;
        }
        missingStatsStatus.hidden = false;
        const safeTeam1 = escapeHtml(match?.team1 || "TBD");
        const safeTeam2 = escapeHtml(match?.team2 || "TBD");
        const safeTournament = escapeHtml(match?.tournament || "");
        const stateText = state === "success" ? "Loaded" : state === "failed" ? "Failed" : "Loading";
        const stateClass = state === "failed" ? " failed" : state === "success" ? " success" : "";
        missingStatsCurrent.innerHTML = `
            <div class="missing-stats-current-label${stateClass}">
                <span>${stateText}</span>
                <small>${safeTournament}</small>
            </div>
            <div class="missing-stats-current-teams">
                <div class="missing-stats-team">
                    ${missingStatsLogoMarkup(match?.team1, match?.team1_logo)}
                    <span class="missing-stats-team-name">${safeTeam1}</span>
                </div>
                <span class="missing-stats-vs">VS</span>
                <div class="missing-stats-team">
                    <span class="missing-stats-team-name">${safeTeam2}</span>
                    ${missingStatsLogoMarkup(match?.team2, match?.team2_logo)}
                </div>
            </div>`;
        if (missingStatsStatusProgress) missingStatsStatusProgress.textContent = `${index}/${total}`;
        if (missingStatsProgressBar) missingStatsProgressBar.style.width = `${total ? Math.round((index / total) * 100) : 0}%`;
    }

    function addMissingStatsActivity(text, state = "success") {
        if (!missingStatsActivity) return;
        const row = document.createElement("div");
        row.className = `missing-stats-activity-row${state === "failed" ? " failed" : ""}`;
        row.innerHTML = `<i class="fa-solid ${state === "failed" ? "fa-circle-xmark" : "fa-circle-check"}"></i><span>${escapeHtml(text)}</span>`;
        missingStatsActivity.prepend(row);
        while (missingStatsActivity.children.length > 4) {
            missingStatsActivity.lastElementChild.remove();
        }
    }

    function getMissingStatsMatches() {
        if (typeof INITIAL_MATCHES === "undefined" || !INITIAL_MATCHES) return [];
        const checkedNames = getCheckedTournamentNames();
        return INITIAL_MATCHES.filter(m => {
            if (!m || !checkedNames.has(m.tournament)) return false;
            const status = (m.status || "").toLowerCase();
            const timestamp = m.unix_timestamp ? m.unix_timestamp * 1000 : 0;
            const isPast = timestamp > 0 && timestamp <= Date.now();
            const hasUnknownTime = timestamp === 0;
            const hasResultScore = /^\d+$/.test(String(m.score1 ?? ""))
                && /^\d+$/.test(String(m.score2 ?? ""))
                && (parseInt(m.score1, 10) > 0 || parseInt(m.score2, 10) > 0);
            const looksCompleted = status !== "live" && hasResultScore;
            // Known future matches are not eligible yet. Unknown-time records
            // are included because an old event import may have lost its time
            // even though the match has already finished.
            return (status === "completed" || isPast || looksCompleted || hasUnknownTime)
                && (!matchHasCompleteStats(m) || !matchHasCompleteDetails(m));
        });
    }

    function updateMissingStatsLoaderButton() {
        if (!loadMissingStatsBtn) return;
        if (loadMissingStatsBtn.disabled && loadMissingStatsBtn.getAttribute("data-fetching") === "true") {
            return;
        }
        const missing = getMissingStatsMatches();
        if (missing.length > 0) {
            loadMissingStatsBtn.style.display = "";
            if (loadMissingStatsProgress) {
                loadMissingStatsProgress.textContent = ` ${missing.length}`;
            }
        } else {
            loadMissingStatsBtn.style.display = "none";
        }
    }

    loadMissingStatsBtn?.addEventListener("click", async () => {
        const missing = getMissingStatsMatches();
        if (missing.length === 0) return;

        // Request notification permission if not already determined
        if (typeof Notification !== "undefined" && Notification.permission === "default") {
            await Notification.requestPermission();
        }

        loadMissingStatsBtn.disabled = true;
        loadMissingStatsBtn.setAttribute("data-fetching", "true");

        if (missingStatsActivity) missingStatsActivity.innerHTML = "";
        if (missingStatsStatus) missingStatsStatus.hidden = false;
        if (missingStatsProgressBar) missingStatsProgressBar.style.width = "0%";
        
        // Dynamically create and prepend spinner icon while fetching
        const spinner = document.createElement("i");
        spinner.className = "fa-solid fa-spinner fa-spin";
        spinner.style.marginRight = "6px";
        loadMissingStatsBtn.prepend(spinner);

        const total = missing.length;
        let loadedCount = 0;
        let failedCount = 0;
        let consecutiveFailures = 0;

        // Gentler pacing: wait between matches so vlr.gg doesn't rate-limit/block us.
        // After a failed fetch we wait much longer to give the site time to recover.
        const DELAY_BETWEEN_OK_MS = 1500;
        const DELAY_AFTER_FAIL_MS = 8000;
        const MAX_CONSECUTIVE_FAILURES = 3;

        for (let i = 0; i < total; i++) {
            const match = missing[i];
            updateMissingStatsStatus(match, i + 1, total, "loading");
            if (loadMissingStatsProgress) {
                loadMissingStatsProgress.textContent = ` ${i + 1}/${total}`;
            }

            // Skip upcoming matches whose scheduled time is still in the future —
            // they haven't been played yet so there are no stats to fetch.
            // They stay in the count so the button remains visible for future scans.
            const matchStatus = (match.status || "").toLowerCase();
            const matchTimestamp = match.unix_timestamp ? match.unix_timestamp * 1000 : 0;
            const nowMs = Date.now();
            if (matchStatus !== "completed" && matchTimestamp > nowMs) {
                updateMissingStatsStatus(match, i + 1, total, "failed");
                addMissingStatsActivity(`${match.team1 || "TBD"} vs ${match.team2 || "TBD"} — not finished`, "failed");
                continue;
            }

            let loadedOk = false;
            let displayMatch = match;
            try {
                const data = await fetch(`/api/match/${match.id}?refresh=true`).then(r => r.json());
                if (data && !data.error) displayMatch = { ...match, ...data };
                // Match-card loading and this button now use the same complete
                // detail fetch, including player photos.
                loadedOk = Boolean(data && !data.error && matchHasCompleteDetails(data));
                if (data && !data.error) {
                    data.has_stats = matchHasCompleteStats(data);
                    data.has_details = matchHasCompleteDetails(data);
                    const idx = INITIAL_MATCHES.findIndex(m => m.id === data.id);
                    if (idx !== -1) {
                        INITIAL_MATCHES[idx] = data;
                    }
                    
                    const card = document.querySelector(`.match-card[data-id="${data.id}"]`);
                    if (card) {
                        card.setAttribute("data-score1", data.score1 || "");
                        card.setAttribute("data-score2", data.score2 || "");
                        
                        const statusBadge = card.querySelector(".match-status-badge");
                        if (statusBadge && data.status) {
                            statusBadge.className = `match-status-badge status-${data.status.toLowerCase()}`;
                            const hasStats = matchHasCompleteDetails(data);
                            if (hasStats) {
                                statusBadge.innerHTML = '<i class="fa-solid fa-circle-check stats-loaded-check" title="Stats Loaded"></i> COMPLETED';
                            } else {
                                statusBadge.textContent = data.status.toUpperCase();
                            }
                        }

                        const vsScoreContainer = card.querySelector(".match-vs-score");
                        if (vsScoreContainer) {
                            const s1 = parseInt(data.score1) || 0;
                            const s2 = parseInt(data.score2) || 0;
                            vsScoreContainer.innerHTML = `
                                <div class="score-display">
                                    <span class="score-num ${s1 > s2 ? 'winner' : ''}">${data.score1 || '0'}</span>
                                    <span class="score-divider">-</span>
                                    <span class="score-num ${s2 > s1 ? 'winner' : ''}">${data.score2 || '0'}</span>
                                </div>
                            `;
                        }

                        // Update team 1 name and logo if it was previously TBD and is now resolved
                        const t1NameEl = card.querySelector(".team-1 .team-name");
                        const t1LogoWrapper = card.querySelector(".team-1 .logo-wrapper");
                        if (t1NameEl && data.team1 && data.team1 !== "TBD") {
                            t1NameEl.textContent = data.team1;
                            t1NameEl.title = data.team1;
                            if (t1LogoWrapper && data.team1_logo) {
                                const existingImg = t1LogoWrapper.querySelector(".team-logo");
                                const initialDiv = t1LogoWrapper.querySelector(".team-initial");
                                if (existingImg) {
                                    existingImg.src = data.team1_logo;
                                    existingImg.alt = `${data.team1} logo`;
                                    existingImg.style.display = "";
                                    existingImg.onerror = function() { this.style.display = "none"; if (initialDiv) initialDiv.style.display = "flex"; };
                                }
                                if (initialDiv) {
                                    initialDiv.style.display = "none";
                                    initialDiv.textContent = data.team1[0].toUpperCase();
                                }
                            }
                        }

                        // Update team 2 name and logo if it was previously TBD and is now resolved
                        const t2NameEl = card.querySelector(".team-2 .team-name");
                        const t2LogoWrapper = card.querySelector(".team-2 .logo-wrapper");
                        if (t2NameEl && data.team2 && data.team2 !== "TBD") {
                            t2NameEl.textContent = data.team2;
                            t2NameEl.title = data.team2;
                            if (t2LogoWrapper && data.team2_logo) {
                                const existingImg = t2LogoWrapper.querySelector(".team-logo");
                                const initialDiv = t2LogoWrapper.querySelector(".team-initial");
                                if (existingImg) {
                                    existingImg.src = data.team2_logo;
                                    existingImg.alt = `${data.team2} logo`;
                                    existingImg.style.display = "";
                                    existingImg.onerror = function() { this.style.display = "none"; if (initialDiv) initialDiv.style.display = "flex"; };
                                }
                                if (initialDiv) {
                                    initialDiv.style.display = "none";
                                    initialDiv.textContent = data.team2[0].toUpperCase();
                                }
                            }
                        }
                    }

                    if (data.tournament) {
                        const label = document.querySelector(`#tournament-checklist .tourney-item[data-tourney-name="${CSS.escape(data.tournament)}"]`);
                        if (label) {
                            const tourneyMatches = INITIAL_MATCHES.filter(m => m.tournament === data.tournament);
                            const nowMs = Date.now();
                            let isFullyLoaded = true;
                            for (const m of tourneyMatches) {
                                const status = (m.status || "").toLowerCase();
                                if (status === "completed") {
                                    // Completed matches must have stats
                                    const hasStats = matchHasCompleteDetails(m);
                                    if (!hasStats) {
                                        isFullyLoaded = false;
                                        break;
                                    }
                                } else {
                                    // Non-completed (upcoming/live): if the match time has passed
                                    // but it still isn't completed with stats, it needs a fetch
                                    const matchTs = m.unix_timestamp ? m.unix_timestamp * 1000 : 0;
                                    if (matchTs > 0 && matchTs <= nowMs) {
                                        // Time has passed but still not completed with stats → not loaded
                                        isFullyLoaded = false;
                                        break;
                                    }
                                    // If time is in the future (or unknown), it's genuinely pending — don't block fully-loaded
                                }
                            }
                            if (isFullyLoaded) {
                                label.classList.remove("tourney-not-loaded");
                                label.classList.add("tourney-fully-loaded");
                            } else {
                                label.classList.remove("tourney-fully-loaded");
                                label.classList.add("tourney-not-loaded");
                            }
                        }
                    }
                }
            } catch (err) {
                console.error(`Failed to load details for match ${match.id}:`, err);
            }

            updateMissingStatsStatus(displayMatch, i + 1, total, loadedOk ? "success" : "failed");
            addMissingStatsActivity(
                `${displayMatch.team1 || "TBD"} vs ${displayMatch.team2 || "TBD"}${loadedOk ? " — loaded" : " — failed"}`,
                loadedOk ? "success" : "failed"
            );

            if (loadedOk) {
                loadedCount++;
                consecutiveFailures = 0;
            } else if (((match && match.status) || "").toLowerCase() === "completed") {
                // A completed match that returned no stats means the server-side fetch
                // failed (e.g. vlr.gg rate-limiting) — count it as a failure.
                failedCount++;
                consecutiveFailures++;
                console.warn(`Could not load stats for match ${match.id} — vlr.gg may be rate-limiting (${consecutiveFailures} consecutive failure${consecutiveFailures > 1 ? "s" : ""}).`);
            } else {
                // Live/upcoming match without stats yet (still in progress) — expected,
                // not a rate-limit failure. Reset the counter so a few in-progress
                // matches can't abort the whole run.
                consecutiveFailures = 0;
            }

            // If vlr.gg is clearly blocking us, stop hammering it and let the user retry later
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                if (loadMissingStatsProgress) {
                    loadMissingStatsProgress.textContent = " Rate-limited — wait a few minutes, then retry";
                }
                await new Promise(r => setTimeout(r, 1500));
                break;
            }

            // Space out requests; back off harder after a genuine failure
            const waitMs = (loadedOk || matchStatus !== "completed") ? DELAY_BETWEEN_OK_MS : DELAY_AFTER_FAIL_MS;
            await new Promise(r => setTimeout(r, waitMs));
        }

        // Clean up spinner
        spinner.remove();
        loadMissingStatsBtn.disabled = false;
        loadMissingStatsBtn.removeAttribute("data-fetching");
        updateMissingStatsLoaderButton();

        if (missingStatsStatus) {
            if (missingStatsStatusProgress) missingStatsStatusProgress.textContent = `${loadedCount}/${total} loaded`;
            if (missingStatsProgressBar) {
                missingStatsProgressBar.style.width = `${total ? Math.round(((loadedCount + failedCount) / total) * 100) : 0}%`;
            }
            missingStatsStatusTimer = setTimeout(() => {
                missingStatsStatus.hidden = true;
            }, 4500);
        }

        // Stats in the DB changed — the leaderboard/standings cache is stale
        cachedAllMatches = null;

        // Send completion notification
        const msg = failedCount > 0
            ? `Loaded stats for ${loadedCount} match${loadedCount === 1 ? "" : "es"}${loadedCount > 0 ? " successfully" : ""}; ${failedCount} failed (vlr.gg may be rate-limiting). Wait a few minutes and click again to retry.`
            : `Successfully loaded stats for all ${loadedCount} matches.`;
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("Stats Collection Completed", {
                body: msg
            });
        } else {
            alert("Stats Collection Completed: " + msg);
        }
    });

    // 3. Filter Application Logic
    function applyFilters() {
        const matchCards = document.querySelectorAll(".match-card");
        let visibleCount = 0;
        
        matchCards.forEach(card => {
            const status = card.getAttribute("data-status");
            const tournament = card.getAttribute("data-tournament");
            
            // Extract team names
            const team1Name = card.querySelector(".team-1 .team-name")?.textContent.toLowerCase() || "";
            const team2Name = card.querySelector(".team-2 .team-name")?.textContent.toLowerCase() || "";
            
            // Check status match
            const statusMatches = (activeStatus === "all") || (status === activeStatus);
            
            // Check tournament match
            const tournamentMatches = checkedTournaments.has(tournament);

            // Check year filter
            const yearVal = filterYear ? filterYear.value : "all";
            const yearMatches = yearVal === "all" || tournament.includes(yearVal);

            // Check series filter
            const seriesVal = filterSeries ? filterSeries.value.trim().toUpperCase() : "";
            const seriesMatches = (!seriesVal || tournament.toUpperCase().includes(seriesVal)) &&
                (customSeriesFilters.length === 0 || customSeriesFilters.some(t => tournament.toUpperCase().includes(t)));
            
            // Check search query match
            const searchMatches = searchQuery === "" || 
                                  team1Name.includes(searchQuery) || 
                                  team2Name.includes(searchQuery);
            
            if (statusMatches && tournamentMatches && searchMatches && yearMatches && seriesMatches) {
                card.style.display = "flex";
                card.style.animation = "fadeIn 0.3s ease forwards";
                visibleCount++;
            } else {
                card.style.display = "none";
            }
        });
        
        // Handle no results display
        let fallback = document.querySelector(".no-matches-fallback");
        if (visibleCount === 0) {
            if (!fallback && matchesGrid) {
                fallback = document.createElement("div");
                fallback.className = "no-matches-fallback";
                fallback.innerHTML = `
                    <i class="fa-solid fa-filter-circle-xmark fallback-icon"></i>
                    <h3>No Matches Match Filters</h3>
                    <p>Try adjusting your search queries, tournament toggles, or status filters.</p>
                `;
                matchesGrid.appendChild(fallback);
            } else if (fallback) {
                fallback.style.display = "flex";
            }
        } else {
            if (fallback) {
                fallback.style.display = "none";
            }
        }

        applyPagination();
        updateMissingStatsLoaderButton();
    }

    function applyPagination() {
        const perPage = perPageSelect ? perPageSelect.value : "all";
        const visibleCards = Array.from(document.querySelectorAll(".match-card")).filter(c => c.style.display !== "none");

        // Update "All" option label with count
        if (perPageSelect) {
            const allOpt = perPageSelect.querySelector('option[value="all"]');
            if (allOpt) allOpt.textContent = `All (${visibleCards.length})`;
        }

        if (perPage !== "all") {
            const limit = parseInt(perPage);
            visibleCards.forEach((card, i) => {
                card.style.display = i < limit ? "flex" : "none";
            });
        }

        // Toggle visibility of the "Past Matches" grid separator dynamically
        const separator = document.querySelector(".grid-separator");
        if (separator) {
            if (activeStatus !== "all") {
                separator.style.display = "none";
            } else {
                let hasVisibleBefore = false;
                let hasVisibleAfter = false;
                let passedSeparator = false;
                
                const children = Array.from(matchesGrid.children);
                children.forEach(child => {
                    if (child === separator) {
                        passedSeparator = true;
                    } else if (child.classList.contains("match-card") && child.style.display !== "none") {
                        if (!passedSeparator) {
                            hasVisibleBefore = true;
                        } else {
                            hasVisibleAfter = true;
                        }
                    }
                });
                separator.style.display = (hasVisibleBefore && hasVisibleAfter) ? "flex" : "none";
            }
        }
    }

    perPageSelect?.addEventListener("change", () => {
        applyFilters();
        fetch("/api/settings").then(r => r.json()).then(s => {
            s.per_page = perPageSelect.value;
            fetch("/api/settings", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(s) });
        });
    });

    // 4. Input Listeners
    // Search input
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            applyFilters();
        });
    }

    // Status filter dropdown
    statusFilterSelect?.addEventListener("change", () => {
        activeStatus = statusFilterSelect.value;
        sessionStorage.setItem("activeStatus", activeStatus);
        applyFilters();
    });

    // Tournament checklist item change
    tourneyCheckboxes.forEach(cb => {
        cb.addEventListener("change", async () => {
            if (cb.checked) {
                checkedTournaments.add(cb.value);
            } else {
                checkedTournaments.delete(cb.value);
            }
            await saveTournamentSettings();
            await reloadMatchesFromView();
        });
    });

    // Select all tournaments
    if (selectAllBtn) {
        selectAllBtn.addEventListener("click", async () => {
            const currentCheckboxes = document.querySelectorAll("#tournament-checklist .tourney-checkbox");
            currentCheckboxes.forEach(cb => {
                cb.checked = true;
                checkedTournaments.add(cb.value);
            });
            await saveTournamentSettings();
            await reloadMatchesFromView();
        });
    }

    // Deselect all tournaments
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener("click", async () => {
            const currentCheckboxes = document.querySelectorAll("#tournament-checklist .tourney-checkbox");
            currentCheckboxes.forEach(cb => {
                cb.checked = false;
                checkedTournaments.delete(cb.value);
            });
            await saveTournamentSettings();
            await reloadMatchesFromView();
        });
    }

    // 5. AJAX Live Sync Data
    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            const icon = refreshBtn.querySelector("i");
            if (icon) icon.classList.add("spinning");
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate spinning"></i>`;
            
            try {
                const start = scrapeStart ? (parseInt(scrapeStart.value) || null) : null;
                const end = scrapeEnd ? (parseInt(scrapeEnd.value) || null) : null;
                const url = (start && end) ? `/api/matches?start=${start}&end=${end}` : `/api/matches`;
                const response = await fetch(url);
                if (!response.ok) throw new Error("Sync failed");
                const matches = await response.json();
                
                // Keep the in-memory leaderboard dataset updated
                INITIAL_MATCHES = matches;

                // Full-stats dataset (leaderboard/standings) is now stale — refetch on next open
                cachedAllMatches = null;

                const scrollY = window.scrollY;

                // Re-render matches grid
                renderMatchesGrid(matches);
                
                // Re-render tournament list in sidebar
                updateTournamentList(matches);
                
                // Re-apply filters with new elements
                applyFilters();

                window.scrollTo(0, scrollY);
            } catch (err) {
                console.error("Error syncing data:", err);
                alert("Failed to sync live data from VLR.gg. Please try again later.");
            } finally {
                if (icon) icon.classList.remove("spinning");
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i>`;
            }
        });
    }

    // ── Tournament Browser (browse VLR.gg tournaments, add to sidebar) ──
    const browseTournamentsBtn = document.getElementById("browse-tournaments-btn");
    const tournamentBrowserModal = document.getElementById("tournament-browser-modal");
    const tournamentBrowserClose = document.getElementById("tournament-browser-close");
    const tournamentBrowserList = document.getElementById("tournament-browser-list");
    const tournamentBrowserSearch = document.getElementById("tournament-browser-search");
    const tournamentBrowserLimit = document.getElementById("tournament-browser-limit");
    const tournamentBrowserRefresh = document.getElementById("tournament-browser-refresh");
    const tournamentBrowserLoadMore = document.getElementById("tournament-browser-loadmore");
    const tournamentBrowserLoadMoreLabel = document.getElementById("tournament-browser-loadmore-label");
    const tournamentBrowserStatus = document.getElementById("tournament-browser-status");
    const tournamentBrowserProgress = document.getElementById("tournament-browser-progress");
    const tournamentBrowserProgressFill = document.getElementById("tournament-browser-progress-fill");
    const tournamentBrowserAdd = document.getElementById("tournament-browser-add");
    const tournamentBrowserSelectedCount = document.getElementById("tournament-browser-selected-count");

    let tournamentBrowserData = [];              // full cached list from the server
    let tournamentBrowserSelected = new Set();   // selected tournament ids
    let tournamentBrowserVisible = 50;           // how many rows are currently shown
    let tournamentBrowserLoading = false;
    let tournamentBrowserAdding = false;
    let tournamentBrowserPagesFetched = 1;       // how many /events pages the server has loaded
    let tournamentBrowserTotalPages = 1;         // total pages available on VLR.gg
    let tournamentPagesPerLoad = 5;              // pages fetched per "Load more" click (configurable in Settings)

    function escapeHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function closeTournamentBrowser() {
        if (tournamentBrowserModal) tournamentBrowserModal.style.display = "none";
    }

    function renderTournamentBrowser() {
        if (!tournamentBrowserList) return;
        const q = (tournamentBrowserSearch?.value || "").trim().toLowerCase();
        const limitVal = tournamentBrowserLimit?.value || "50";
        const filtered = tournamentBrowserData.filter(t =>
            !q || (t.name || "").toLowerCase().includes(q)
        );
        const pageSize = limitVal === "all" ? filtered.length : Math.min(parseInt(limitVal) || 50, filtered.length);
        const showCount = Math.max(pageSize, tournamentBrowserVisible);
        const visible = filtered.slice(0, showCount);

        tournamentBrowserList.innerHTML = visible.map(t => {
            const isSelected = tournamentBrowserSelected.has(String(t.id));
            const nameHtml = escapeHtml(t.name);
            let badge = "";
            if (t.added) badge = '<span class="tbr-badge tbr-added"><i class="fa-solid fa-circle-check"></i> Added</span>';
            else if (t.ignored) badge = '<span class="tbr-badge tbr-ignored"><i class="fa-solid fa-eye-slash"></i> Ignored</span>';
            return `
                <label class="tbr-item ${t.added ? "is-added" : ""}" title="${escapeHtml(t.desc)}">
                    <input type="checkbox" class="tbr-checkbox" value="${escapeHtml(t.id)}" ${isSelected ? "checked" : ""} ${t.added ? "disabled" : ""}>
                    <span class="custom-checkbox"></span>
                    ${t.logo ? `<img src="${escapeHtml(t.logo)}" class="tbr-logo" onerror="this.style.display='none';" loading="lazy">` : '<div class="tbr-logo-placeholder"><i class="fa-solid fa-trophy"></i></div>'}
                    <span class="tbr-name" title="${nameHtml}">${nameHtml}</span>
                    ${t.region ? `<span class="tbr-region">${escapeHtml(t.region)}</span>` : ""}
                    ${t.status ? `<span class="tbr-status mod-${(t.status || "").toLowerCase()}">${escapeHtml(t.status)}</span>` : ""}
                    ${badge}
                </label>
            `;
        }).join("");

        if (visible.length === 0) {
            tournamentBrowserList.innerHTML = `
                <div class="tbr-empty">
                    <i class="fa-solid fa-trophy"></i>
                    <p>${q ? `No tournaments match "${escapeHtml(q)}".` : "No tournaments found."}</p>
                </div>`;
        }

        if (tournamentBrowserSelectedCount) tournamentBrowserSelectedCount.textContent = String(tournamentBrowserSelected.size);
        if (tournamentBrowserAdd) tournamentBrowserAdd.disabled = tournamentBrowserSelected.size === 0 || tournamentBrowserAdding;
    }

    async function loadTournamentBrowser(refresh = false) {
        if (tournamentBrowserLoading) return;
        tournamentBrowserLoading = true;
        const refreshIcon = tournamentBrowserRefresh ? tournamentBrowserRefresh.querySelector(".fa-arrows-rotate") : null;
        if (tournamentBrowserRefresh) tournamentBrowserRefresh.disabled = true;
        if (tournamentBrowserLoadMore) tournamentBrowserLoadMore.disabled = true;
        if (refreshIcon) refreshIcon.classList.add("spinning");
        if (tournamentBrowserStatus) {
            tournamentBrowserStatus.classList.remove("tbr-status-error");
            if (refresh) {
                tournamentBrowserStatus.textContent = `Refreshing ${Math.max(tournamentBrowserPagesFetched, 1)} page${Math.max(tournamentBrowserPagesFetched, 1) === 1 ? "" : "s"} from VLR.gg…`;
            } else if (tournamentBrowserData.length) {
                tournamentBrowserStatus.textContent = `Loading more — fetching page ${Math.min(tournamentBrowserPagesFetched + 1, tournamentBrowserTotalPages)} of ${tournamentBrowserTotalPages}…`;
            } else {
                tournamentBrowserStatus.textContent = "Loading…";
            }
        }
        if (refresh) {
            // Poll the server for live refresh progress (page N of M)
            stopRefreshProgressPolling();
            refreshProgressTimer = setInterval(pollRefreshProgress, 700);
        }
        try {
            // First open fetches just page 1; "Load more" fetches the next batch.
            // Refresh re-fetches EXACTLY the pages the user already has loaded —
            // requesting page 1 alone would silently shrink the cache back to 69.
            const targetPages = (refresh || tournamentBrowserData.length === 0)
                ? Math.max(tournamentBrowserPagesFetched, 1)
                : tournamentBrowserPagesFetched + tournamentPagesPerLoad;
            const url = `/api/tournaments?pages=${targetPages}${refresh ? "&refresh=true" : ""}`;
            const data = await fetch(url).then(r => r.json());
            tournamentBrowserData = data.tournaments || [];
            tournamentBrowserPagesFetched = data.pages_fetched || 1;
            tournamentBrowserTotalPages = data.total_pages || 1;
            tournamentBrowserSelected = new Set();
            tournamentBrowserVisible = Math.max(tournamentBrowserVisible, tournamentBrowserPagesFetched * 50);
            renderTournamentBrowser();
            if (tournamentBrowserStatus) {
                if (data.error) {
                    tournamentBrowserStatus.textContent = data.error;
                    tournamentBrowserStatus.classList.add("tbr-status-error");
                } else if (tournamentBrowserData.length) {
                    // total_pages of 1 means the server hasn't learned the real
                    // page count yet — never treat that as "all loaded"
                    const allLoaded = tournamentBrowserTotalPages > 1 && tournamentBrowserPagesFetched >= tournamentBrowserTotalPages;
                    tournamentBrowserStatus.textContent = allLoaded
                        ? `${tournamentBrowserData.length} tournaments available — all ${tournamentBrowserTotalPages} page${tournamentBrowserTotalPages === 1 ? "" : "s"} loaded. Select the ones you want to add.`
                        : `${tournamentBrowserData.length} tournaments loaded (page ${tournamentBrowserPagesFetched} of ${tournamentBrowserTotalPages}). Select the ones you want to add, or click Load more.`;
                    tournamentBrowserStatus.classList.remove("tbr-status-error");
                } else {
                    tournamentBrowserStatus.textContent = "No tournaments found. Click Refresh to fetch the list.";
                    tournamentBrowserStatus.classList.remove("tbr-status-error");
                }
            }
        } catch (err) {
            console.error("Failed to load tournaments:", err);
            if (tournamentBrowserStatus) {
                tournamentBrowserStatus.textContent = "Failed to load tournaments: " + err.message;
                tournamentBrowserStatus.classList.add("tbr-status-error");
            }
        } finally {
            tournamentBrowserLoading = false;
            if (tournamentBrowserRefresh) tournamentBrowserRefresh.disabled = false;
            if (tournamentBrowserLoadMore) tournamentBrowserLoadMore.disabled = false;
            if (refreshIcon) refreshIcon.classList.remove("spinning");
            stopRefreshProgressPolling();
            updateTournamentLoadMoreButton();
        }
    }

    // Show/hide and label the "Load more" button based on current progress
    function updateTournamentLoadMoreButton() {
        if (!tournamentBrowserLoadMore) return;
        // total_pages of 1 means the count is unknown — keep the button available
        const allLoaded = tournamentBrowserTotalPages > 1 && tournamentBrowserPagesFetched >= tournamentBrowserTotalPages;
        tournamentBrowserLoadMore.style.display = allLoaded ? "none" : "";
        if (tournamentBrowserLoadMoreLabel) {
            tournamentBrowserLoadMoreLabel.textContent = allLoaded
                ? "Load more tournaments"
                : `Load more tournaments (page ${Math.min(tournamentBrowserPagesFetched + tournamentPagesPerLoad, tournamentBrowserTotalPages)} of ${tournamentBrowserTotalPages})`;
        }
    }

    // Live progress while the Refresh button re-fetches every loaded page
    let refreshProgressTimer = null;

    function stopRefreshProgressPolling() {
        if (refreshProgressTimer) {
            clearInterval(refreshProgressTimer);
            refreshProgressTimer = null;
        }
        if (tournamentBrowserProgress) tournamentBrowserProgress.style.display = "none";
    }

    async function pollRefreshProgress() {
        try {
            const p = await fetch("/api/tournaments/progress").then(r => r.json());
            if (!p || !p.active || !tournamentBrowserLoading) return;
            if (tournamentBrowserStatus) {
                tournamentBrowserStatus.textContent = `Refreshing — page ${p.current} of ${p.total}…`;
            }
            if (tournamentBrowserProgress && tournamentBrowserProgressFill && p.total > 0) {
                tournamentBrowserProgress.style.display = "";
                const pct = Math.max(0, Math.min(100, Math.round((p.done / p.total) * 100)));
                tournamentBrowserProgressFill.style.width = pct + "%";
            }
        } catch (e) {
            // polling is best-effort; the main refresh fetch still completes
        }
    }

    browseTournamentsBtn?.addEventListener("click", () => {
        if (tournamentBrowserModal) tournamentBrowserModal.style.display = "flex";
        loadTournamentBrowser(false);
    });
    tournamentBrowserClose?.addEventListener("click", closeTournamentBrowser);
    tournamentBrowserModal?.addEventListener("click", e => {
        if (e.target === tournamentBrowserModal) closeTournamentBrowser();
    });
    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && tournamentBrowserModal && tournamentBrowserModal.style.display !== "none") closeTournamentBrowser();
    });

    tournamentBrowserSearch?.addEventListener("input", () => {
        tournamentBrowserVisible = tournamentBrowserLimit.value === "all" ? 999999 : (parseInt(tournamentBrowserLimit.value) || 50);
        renderTournamentBrowser();
    });
    tournamentBrowserLimit?.addEventListener("change", () => {
        tournamentBrowserVisible = tournamentBrowserLimit.value === "all" ? 999999 : (parseInt(tournamentBrowserLimit.value) || 50);
        renderTournamentBrowser();
    });
    tournamentBrowserLoadMore?.addEventListener("click", () => {
        loadTournamentBrowser(false);
    });
    tournamentBrowserRefresh?.addEventListener("click", () => {
        // No confirm dialog — the button is already an explicit action, and the
        // spinning icon + status text show the refresh is running.
        loadTournamentBrowser(true);
    });

    // Settings: pages fetched per "Load more" click
    const tournamentPagesPerLoadInput = document.getElementById("tournament-pages-per-load");
    const saveTournamentPagesBtn = document.getElementById("save-tournament-pages-btn");
    saveTournamentPagesBtn?.addEventListener("click", async () => {
        let val = parseInt(tournamentPagesPerLoadInput?.value) || 5;
        val = Math.max(1, Math.min(59, val));
        tournamentPagesPerLoad = val;
        if (tournamentPagesPerLoadInput) tournamentPagesPerLoadInput.value = val;
        try {
            const cur = await fetch("/api/settings").then(r => r.json()).catch(() => ({}));
            await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...cur, tournament_pages_per_load: val })
            });
        } catch (err) {
            console.error("Failed to save tournament pages per load:", err);
        }
        updateTournamentLoadMoreButton();
    });

    tournamentBrowserList?.addEventListener("change", e => {
        if (e.target.classList.contains("tbr-checkbox")) {
            const id = String(e.target.value);
            if (e.target.checked) tournamentBrowserSelected.add(id);
            else tournamentBrowserSelected.delete(id);
            if (tournamentBrowserSelectedCount) tournamentBrowserSelectedCount.textContent = String(tournamentBrowserSelected.size);
            if (tournamentBrowserAdd) tournamentBrowserAdd.disabled = tournamentBrowserSelected.size === 0 || tournamentBrowserAdding;
        }
    });

    tournamentBrowserAdd?.addEventListener("click", async () => {
        const selected = tournamentBrowserData.filter(t => tournamentBrowserSelected.has(String(t.id)));
        if (selected.length === 0 || tournamentBrowserAdding) return;
        tournamentBrowserAdding = true;
        if (tournamentBrowserAdd) {
            tournamentBrowserAdd.disabled = true;
            tournamentBrowserAdd.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...';
        }
        let totalAdded = 0;
        const errors = [];
        try {
            for (let i = 0; i < selected.length; i++) {
                if (tournamentBrowserStatus) {
                    tournamentBrowserStatus.textContent = `Adding "${selected[i].name}" — fetching its matches from VLR.gg (${i + 1}/${selected.length})…`;
                }
                const resp = await fetch("/api/tournaments/add", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tournament: { id: selected[i].id, name: selected[i].name, href: selected[i].href, logo: selected[i].logo || "" } })
                });
                const res = await resp.json();
                totalAdded += (res.total_added || 0);
                const itemRes = (res.results && res.results[0]) || {};
                if (itemRes.error) errors.push(`${selected[i].name}: ${itemRes.error}`);
                if (i < selected.length - 1) await new Promise(r => setTimeout(r, 1200));
            }
            let statusMsg = `Done — ${totalAdded} match(es) added/updated across ${selected.length} tournament(s).`;
            if (errors.length) statusMsg += ` ${errors.length} failed: ${errors.join("; ")}`;
            statusMsg += " Reloading page...";
            if (tournamentBrowserStatus) tournamentBrowserStatus.textContent = statusMsg;
            setTimeout(() => window.location.reload(), 800);
        } catch (err) {
            console.error("Failed to add tournaments:", err);
            if (tournamentBrowserStatus) tournamentBrowserStatus.textContent = "Error adding tournaments: " + err.message;
            tournamentBrowserAdding = false;
            if (tournamentBrowserAdd) {
                tournamentBrowserAdd.innerHTML = '<i class="fa-solid fa-plus"></i> Add Selected';
                tournamentBrowserAdd.disabled = tournamentBrowserSelected.size === 0;
            }
        }
    });

    const scrapeStart = document.getElementById("scrape-start");
    const scrapeEnd = document.getElementById("scrape-end");
    const savePagesBtnEl = document.getElementById("save-pages-btn");
    const advancePagesBtnEl = document.getElementById("advance-pages-btn");
    if (savePagesBtnEl) {
        savePagesBtnEl.addEventListener("click", async () => {
            const start = Math.max(1, parseInt(scrapeStart?.value) || 1);
            const end = Math.max(start, parseInt(scrapeEnd?.value) || start);
            if (scrapeStart) scrapeStart.value = start;
            if (scrapeEnd) scrapeEnd.value = end;
            const cur = await fetch("/api/settings").then(r => r.json()).catch(() => ({}));
            await fetch("/api/settings", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({...cur, scrape_start: start, scrape_end: end}) });
            savePagesBtnEl.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => { savePagesBtnEl.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>'; }, 1500);
        });
    }
    
    if (advancePagesBtnEl) {
        advancePagesBtnEl.addEventListener("click", async () => {
            const start = Math.max(1, parseInt(scrapeStart?.value) || 1);
            const end = Math.max(start, parseInt(scrapeEnd?.value) || start);
            const diff = end - start;
            const newStart = end;
            const newEnd = newStart + diff;
            
            if (scrapeStart) scrapeStart.value = newStart;
            if (scrapeEnd) scrapeEnd.value = newEnd;
            
            const cur = await fetch("/api/settings").then(r => r.json()).catch(() => ({}));
            await fetch("/api/settings", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({...cur, scrape_start: newStart, scrape_end: newEnd}) });
            
            advancePagesBtnEl.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => { advancePagesBtnEl.innerHTML = '<i class="fa-solid fa-arrow-right"></i>'; }, 1500);
        });
    }

    const highlightLoadedCheckbox = document.getElementById("setting-highlight-loaded");
    highlightLoadedCheckbox?.addEventListener("change", async () => {
        const isChecked = highlightLoadedCheckbox.checked;
        const checklist = document.getElementById("tournament-checklist");
        if (checklist) {
            checklist.classList.toggle("highlight-tournaments", isChecked);
        }
        const cur = await fetch("/api/settings").then(r => r.json()).catch(() => ({}));
        await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...cur, highlight_loaded_tournaments: isChecked })
        });
    });



    function renderMatchesGrid(matches) {
        if (!matchesGrid) return;
        
        // Clear all except fallback if present
        matchesGrid.innerHTML = "";
        
        if (matches.length === 0) {
            matchesGrid.innerHTML = `
                <div class="no-matches-fallback">
                    <i class="fa-solid fa-gamepad fallback-icon"></i>
                    <h3>No Schedules Found</h3>
                    <p>We couldn't retrieve any match schedules at this time. Click 'Sync Live Data' to force-refresh from source.</p>
                </div>
            `;
            return;
        }
        
        const hasActive = matches.some(m => m.status === "Live" || m.status === "Upcoming");
        let renderedCompletedSep = false;
        
        matches.forEach(m => {
            const isCompleted = (m.status || "").toLowerCase() === "completed";
            
            if (isCompleted && hasActive && !renderedCompletedSep) {
                const sep = document.createElement("div");
                sep.className = "grid-separator";
                sep.innerHTML = `
                    <div class="grid-separator-line"></div>
                    <span class="grid-separator-text"><i class="fa-solid fa-clock-rotate-left"></i> Past Matches</span>
                    <div class="grid-separator-line"></div>
                `;
                matchesGrid.appendChild(sep);
                renderedCompletedSep = true;
            }

            const card = document.createElement("div");
            card.className = "match-card";
            card.setAttribute("data-tournament", m.tournament);
            card.setAttribute("data-status", (m.status || "").toLowerCase());
            card.setAttribute("data-id", m.id);
            card.setAttribute("data-href", m.href);
            card.setAttribute("data-score1", m.score1 || "");
            card.setAttribute("data-score2", m.score2 || "");
            card.style.cursor = "pointer";

            const s = (m.series || "").toLowerCase();
            if (s.includes("lower") || s.includes("elimination") || s.includes("decider") || s.includes("loser")) {
                card.setAttribute("data-elimination", "1");
            } else if (s.includes("grand final")) {
                card.setAttribute("data-final", "1");
            }
            
            // Create status badge inner HTML
            let statusBadgeHTML = "";
            if (m.status === "Live") {
                statusBadgeHTML = '<span class="live-dot"></span> LIVE';
            } else if (m.status === "Completed") {
                const hasStats = !!m.has_details;
                if (hasStats) {
                    statusBadgeHTML = '<i class="fa-solid fa-circle-check stats-loaded-check" title="Stats Loaded"></i> COMPLETED';
                } else {
                    statusBadgeHTML = 'COMPLETED';
                }
            } else {
                statusBadgeHTML = m.status;
            }
            
            // Create vs/score inner HTML
            let vsScoreHTML = "";
            if (m.status === "Upcoming") {
                vsScoreHTML = '<span class="vs-label">VS</span>';
            } else {
                const s1 = parseInt(m.score1) || 0;
                const s2 = parseInt(m.score2) || 0;
                const completed = m.status === "Completed";
                
                vsScoreHTML = `
                    <div class="score-display">
                        <span class="score-num ${completed && s1 > s2 ? 'winner' : ''}">${m.score1 || '0'}</span>
                        <span class="score-divider">-</span>
                        <span class="score-num ${completed && s2 > s1 ? 'winner' : ''}">${m.score2 || '0'}</span>
                    </div>
                `;
            }
            
            // Create countdown container inner HTML
            let countdownHTML = "";
            if (m.status === "Upcoming") {
                countdownHTML = `
                    <div class="countdown-container" data-timestamp="${m.js_timestamp}">
                        <span class="countdown-label">Starts In:</span>
                        <span class="countdown-timer">--d --h --m</span>
                    </div>
                `;
            } else if (m.status === "Live") {
                countdownHTML = `
                    <div class="countdown-container status-live-container">
                        <span class="live-pulse-indicator"></span>
                        <span class="live-countdown-text">In Progress</span>
                    </div>
                `;
            } else {
                countdownHTML = "";
            }
            
            const t1WhiteClass = whiteLogoTeams.has(m.team1) ? "white-bg-logo" : "";
            const t2WhiteClass = whiteLogoTeams.has(m.team2) ? "white-bg-logo" : "";

            card.innerHTML = `
                <div class="match-card-header">
                    <div class="tournament-info">
                        ${m.tournament_logo ? `<img src="${m.tournament_logo}" class="tournament-logo" onerror="this.src='https://placehold.co/32x32/ff4655/ffffff?text=VLR';" loading="lazy">` : '<div class="tournament-logo-placeholder"><i class="fa-solid fa-trophy"></i></div>'}
                        <div class="tournament-name-container">
                            <span class="tournament-name" title="${m.tournament}">${m.tournament}</span>
                            <span class="tournament-series" title="${m.series}">${m.series || 'Main Event'}</span>
                        </div>
                    </div>
                    <div class="match-status-badge status-${(m.status || "").toLowerCase()}">
                        ${statusBadgeHTML}
                    </div>
                </div>

                <div class="match-card-body">
                    <div class="team-container team-1">
                        <div class="logo-wrapper ${t1WhiteClass}">
                            ${m.team1_logo ? `<img src="${m.team1_logo}" class="team-logo" alt="${m.team1} logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" loading="lazy">` : '<div class="team-logo" style="display:none;"></div>'}
                            <div class="team-initial" style="display:${m.team1_logo ? 'none' : 'flex'};">${m.team1 ? m.team1[0].toUpperCase() : 'T'}</div>
                        </div>
                        <span class="team-name" title="${m.team1}">${m.team1}</span>
                    </div>

                    <div class="match-vs-score">
                        ${vsScoreHTML}
                    </div>

                    <div class="team-container team-2">
                        <span class="team-name" title="${m.team2}">${m.team2}</span>
                        <div class="logo-wrapper ${t2WhiteClass}">
                            ${m.team2_logo ? `<img src="${m.team2_logo}" class="team-logo" alt="${m.team2} logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" loading="lazy">` : '<div class="team-logo" style="display:none;"></div>'}
                            <div class="team-initial" style="display:${m.team2_logo ? 'none' : 'flex'};">${m.team2 ? m.team2[0].toUpperCase() : 'T'}</div>
                        </div>
                    </div>
                </div>

                <div class="match-card-footer">
                    <div class="time-info">
                        <i class="fa-regular fa-clock clock-icon"></i>
                        <span class="bst-time" title="Bangladesh Standard Time">${m.formatted_bst} BST</span>
                    </div>
                    ${countdownHTML}
                </div>
            `;
            
            matchesGrid.appendChild(card);
        });
        
        // Re-run countdown initializations
        updateCountdowns();
        applyTournamentColors();
    }

    function updateTournamentList(matches) {
        const checklist = document.getElementById("tournament-checklist");
        if (!checklist) return;
        
        // Extract unique tournaments
        const tourneys = new Map();
        matches.forEach(m => {
            if (m.tournament && !IGNORE_LIST.find(t => t.name === m.tournament)) {
                tourneys.set(m.tournament, m.tournament_logo || "");
            }
        });

        // Group matches by tournament to check if stats are fully loaded
        const tourneyMatchesMap = new Map();
        matches.forEach(m => {
            if (m.tournament) {
                if (!tourneyMatchesMap.has(m.tournament)) {
                    tourneyMatchesMap.set(m.tournament, []);
                }
                tourneyMatchesMap.get(m.tournament).push(m);
            }
        });
        
        const sortedTourneys = Array.from(tourneys.entries()).sort((a, b) => {
            const aPin = tournamentOrder[a[0]] ?? 9999;
            const bPin = tournamentOrder[b[0]] ?? 9999;
            if (aPin !== bPin) return aPin - bPin;
            const aChecked = checkedTournaments.has(a[0]);
            const bChecked = checkedTournaments.has(b[0]);
            if (aChecked && !bChecked) return -1;
            if (!aChecked && bChecked) return 1;
            return a[0].localeCompare(b[0]);
        });
        
        // We will keep checked status for existing tournaments, default check for new ones
        const newChecked = new Set();
        
        checklist.innerHTML = "";
        
        if (sortedTourneys.length === 0) {
            checklist.innerHTML = `
                <div class="no-tournaments-fallback">
                    <p>No active tournaments found.</p>
                </div>
            `;
            return;
        }
        
        sortedTourneys.forEach(([name, logo]) => {
            // Keep status if already checked/unchecked before
            const isChecked = checkedTournaments.has(name) || !checkedTournaments.size; // check by default if set is empty
            if (isChecked) newChecked.add(name);
            
            // Check if tournament is fully loaded (completed matches have stats, upcoming matches have times)
            let isFullyLoaded = true;
            const mList = tourneyMatchesMap.get(name) || [];
            for (const m of mList) {
                const status = (m.status || "").toLowerCase();
                if (status === "completed") {
                    const hasStats = !!m.has_details;
                    if (!hasStats) {
                        isFullyLoaded = false;
                        break;
                    }
                } else {
                    const hasTime = m.unix_timestamp && m.unix_timestamp !== 0 && m.bst_time;
                    if (!hasTime) {
                        isFullyLoaded = false;
                        break;
                    }
                }
            }
            const loadClass = isFullyLoaded ? "tourney-fully-loaded" : "tourney-not-loaded";

            const label = document.createElement("label");
            label.className = `tourney-item ${loadClass}`;
            label.setAttribute("data-tourney-name", name);
            
            label.innerHTML = `
                <input type="checkbox" ${isChecked ? 'checked' : ''} class="tourney-checkbox" value="${name}">
                <span class="custom-checkbox"></span>
                ${logo ? `<img src="${logo}" alt="" class="sidebar-tourney-logo" onerror="this.style.display='none';" loading="lazy">` : '<div class="sidebar-tourney-placeholder"><i class="fa-solid fa-trophy"></i></div>'}
                <span class="tourney-label-text" title="${name}">${name}</span>
                ${tournamentOrder[name] != null ? `<span class="tourney-pin-badge">#${tournamentOrder[name]}</span>` : ''}
            `;
            
            checklist.appendChild(label);
            
            // Add listener to the new checkbox
            const cb = label.querySelector(".tourney-checkbox");
            cb.addEventListener("change", () => {
                if (cb.checked) {
                    checkedTournaments.add(cb.value);
                } else {
                    checkedTournaments.delete(cb.value);
                }
                applyFilters();
                saveTournamentSettings();
                updateMissingStatsLoaderButton();
            });
        });
        
        checkedTournaments = newChecked;
        const countEl = document.getElementById("tourney-count");
        if (countEl) countEl.textContent = `(${sortedTourneys.length})`;
        applyTourneyFilters();
        sortTourneyByDate();
    }

    // Settings modal & Tab navigation
    const settingsBtn = document.getElementById("settings-btn");
    const settingsModal = document.getElementById("settings-modal");
    const settingsCloseBtn = document.getElementById("settings-close-btn");
    
    const tabBtnIgnore = document.getElementById("tab-btn-ignore");
    const tabBtnScrape = document.getElementById("tab-btn-scrape");
    const tabBtnWhiteLogos = document.getElementById("tab-btn-white-logos");
    const contentIgnore = document.getElementById("modal-content-ignore");
    const contentScrape = document.getElementById("modal-content-scrape");
    const contentWhiteLogos = document.getElementById("modal-content-white-logos");

    settingsBtn?.addEventListener("click", () => {
        tabBtnIgnore?.click(); // reset to ignore tab by default when opened
        settingsModal.style.display = "flex";
        bindIgnoreRemoveBtns(); // attach handlers to server-rendered X buttons
    });
    settingsCloseBtn?.addEventListener("click", () => {
        settingsModal.style.display = "none";
    });
    settingsModal?.addEventListener("click", (e) => {
        const modalBox = settingsModal.querySelector(".modal-box");
        if (modalBox && !modalBox.contains(e.target)) {
            settingsModal.style.display = "none";
        }
    });

    tabBtnIgnore?.addEventListener("click", () => {
        tabBtnIgnore.classList.add("active");
        tabBtnScrape?.classList.remove("active");
        tabBtnWhiteLogos?.classList.remove("active");
        if (contentIgnore) contentIgnore.style.display = "block";
        if (contentScrape) contentScrape.style.display = "none";
        if (contentWhiteLogos) contentWhiteLogos.style.display = "none";
    });

    tabBtnScrape?.addEventListener("click", () => {
        tabBtnScrape.classList.add("active");
        tabBtnIgnore?.classList.remove("active");
        tabBtnWhiteLogos?.classList.remove("active");
        if (contentScrape) contentScrape.style.display = "block";
        if (contentIgnore) contentIgnore.style.display = "none";
        if (contentWhiteLogos) contentWhiteLogos.style.display = "none";
    });

    tabBtnWhiteLogos?.addEventListener("click", () => {
        tabBtnWhiteLogos.classList.add("active");
        tabBtnIgnore?.classList.remove("active");
        tabBtnScrape?.classList.remove("active");
        if (contentWhiteLogos) contentWhiteLogos.style.display = "block";
        if (contentIgnore) contentIgnore.style.display = "none";
        if (contentScrape) contentScrape.style.display = "none";
    });

    document.getElementById("btn-test-notification")?.addEventListener("click", async () => {
        if (typeof Notification === "undefined") {
            alert("Desktop notifications are not supported by this browser.");
            return;
        }
        if (Notification.permission === "default") {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                alert("Permission denied. Enable notifications in your browser settings (click the lock icon next to the URL) to test.");
                return;
            }
        } else if (Notification.permission === "denied") {
            alert("Notifications are blocked in your browser settings. Please click the lock icon next to the URL in the address bar, change Notifications to 'Allow', and try again.");
            return;
        }
        new Notification("VLR Stats Manager", {
            body: "This is a preview of the Windows/Chrome desktop notification! It works successfully."
        });
    });

    // White Logo Teams Settings Logic
    function renderWhiteLogoTeamsList() {
        const container = document.getElementById("white-logo-teams-container");
        if (!container) return;
        container.innerHTML = "";
        if (whiteLogoTeams.size === 0) {
            container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px;">No teams added yet.</div>`;
            return;
        }
        
        Array.from(whiteLogoTeams).sort().forEach(name => {
            const div = document.createElement("div");
            div.className = "white-logo-item";
            div.innerHTML = `
                <span>${name}</span>
                <button class="btn-remove-white-logo" data-name="${name}"><i class="fa-solid fa-trash-can"></i></button>
            `;
            container.appendChild(div);
        });
        
        container.querySelectorAll(".btn-remove-white-logo").forEach(btn => {
            btn.addEventListener("click", () => {
                const name = btn.getAttribute("data-name");
                whiteLogoTeams.delete(name);
                renderWhiteLogoTeamsList();
                saveWhiteLogoTeams();
            });
        });
    }

    async function saveWhiteLogoTeams() {
        const cur = await fetch("/api/settings").then(r => r.json()).catch(() => ({}));
        cur.white_logo_teams = Array.from(whiteLogoTeams);
        await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cur)
        });
        applyWhiteLogoStylesToCurrentCards();
    }

    function applyWhiteLogoStylesToCurrentCards() {
        document.querySelectorAll(".match-card").forEach(card => {
            const team1El = card.querySelector(".team-1 .logo-wrapper");
            const team2El = card.querySelector(".team-2 .logo-wrapper");
            if (team1El) {
                const team1Name = card.querySelector(".team-1 .team-name")?.textContent || "";
                team1El.classList.toggle("white-bg-logo", whiteLogoTeams.has(team1Name));
            }
            if (team2El) {
                const team2Name = card.querySelector(".team-2 .team-name")?.textContent || "";
                team2El.classList.toggle("white-bg-logo", whiteLogoTeams.has(team2Name));
            }
        });
    }

    const whiteLogoInput = document.getElementById("white-logo-team-input");
    const whiteLogoAddBtn = document.getElementById("btn-add-white-logo-team");

    function addWhiteLogoTeam() {
        if (!whiteLogoInput) return;
        const name = whiteLogoInput.value.trim();
        if (!name) return;
        whiteLogoTeams.add(name);
        whiteLogoInput.value = "";
        renderWhiteLogoTeamsList();
        saveWhiteLogoTeams();
    }

    whiteLogoAddBtn?.addEventListener("click", addWhiteLogoTeam);
    whiteLogoInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addWhiteLogoTeam();
    });

    const whiteLogoBgColorPicker = document.getElementById("white-logo-bg-color-picker");
    const whiteLogoBgColorText = document.getElementById("white-logo-bg-color-text");

    async function updateWhiteLogoBgColor(color) {
        if (!color) return;
        document.documentElement.style.setProperty('--white-logo-bg-color', color);
        if (whiteLogoBgColorPicker) whiteLogoBgColorPicker.value = color;
        if (whiteLogoBgColorText) whiteLogoBgColorText.value = color;
        
        // Save to settings
        const cur = await fetch("/api/settings").then(r => r.json()).catch(() => ({}));
        cur.white_logo_bg_color = color;
        await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cur)
        });
    }

    whiteLogoBgColorPicker?.addEventListener("input", (e) => {
        updateWhiteLogoBgColor(e.target.value);
    });

    whiteLogoBgColorText?.addEventListener("change", (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith("#")) {
            val = "#" + val;
        }
        // Basic hex regex validation
        if (/^#[0-9A-F]{6}$/i.test(val) || /^#[0-9A-F]{3}$/i.test(val)) {
            updateWhiteLogoBgColor(val);
        } else {
            // Restore current setting value
            fetch("/api/settings").then(r => r.json()).then(s => {
                const color = s.white_logo_bg_color || "#eef1f6";
                whiteLogoBgColorText.value = color;
            });
        }
    });

    // Ignore list modal filters
    function applyIgnoreFilters() {
        const year = document.getElementById("ignore-filter-year")?.value || "all";
        const search = (document.getElementById("ignore-filter-search")?.value || "").toLowerCase();
        document.querySelectorAll("#ignore-list-container .ignore-item").forEach(item => {
            const name = (item.dataset.name || "").toLowerCase();
            const yearMatch = year === "all" || name.includes(year);
            const searchMatch = !search || name.includes(search);
            item.style.display = (yearMatch && searchMatch) ? "" : "none";
        });
    }
    document.getElementById("ignore-filter-year")?.addEventListener("change", applyIgnoreFilters);
    document.getElementById("ignore-filter-search")?.addEventListener("input", applyIgnoreFilters);

    // Remove from ignore list
    function bindIgnoreRemoveBtns() {
        document.querySelectorAll(".ignore-remove-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                const name = btn.getAttribute("data-name");
                const res = await fetch("/api/ignorelist/remove", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tournament: name })
                });
                const data = await res.json();
                const idx = IGNORE_LIST.findIndex(i => i.name === name);
                if (idx !== -1) IGNORE_LIST.splice(idx, 1);
                renderIgnoreList(data.ignorelist);
            });
        });
    }

    function renderIgnoreList(list) {
        const container = document.getElementById("ignore-list-container");
        if (!container) return;
        const countEl = document.getElementById("ignore-count");
        if (countEl) countEl.textContent = `(${list.length})`;
        if (!list.length) {
            container.innerHTML = `<p class="ignore-empty">No tournaments ignored.</p>`;
            return;
        }
        container.innerHTML = [...list].reverse().map(t => {
            const safeName = t.name.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return `
            <div class="ignore-item" data-name="${safeName}">
                ${t.logo ? `<img src="${t.logo}" class="ignore-item-logo" onerror="this.style.display='none';" loading="lazy">` : '<div class="ignore-item-logo-placeholder"><i class="fa-solid fa-trophy"></i></div>'}
                <span class="ignore-item-name" title="${safeName}">${safeName}</span>
                <button class="ignore-remove-btn" data-name="${safeName}" title="Remove from ignore list"><i class="fa-solid fa-circle-xmark"></i></button>
            </div>
        `}).join("");
        bindIgnoreRemoveBtns();
        applyIgnoreFilters();
    }

    // Ignore unchecked button
    async function ignoreVisible(wantChecked) {
        const targets = [];
        document.querySelectorAll(".tourney-item").forEach(label => {
            if (label.style.display === "none") return; // skip filtered-out
            const cb = label.querySelector(".tourney-checkbox");
            if (!cb) return;
            if (cb.checked === wantChecked) {
                const logo = label.querySelector(".sidebar-tourney-logo")?.src || "";
                targets.push({ name: cb.value, logo });
            }
        });
        if (!targets.length) return;
        const res = await fetch("/api/ignorelist/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(targets)
        });
        const data = await res.json();
        targets.forEach(t => { if (!IGNORE_LIST.find(i => i.name === t.name)) IGNORE_LIST.push(t); });
        renderIgnoreList(data.ignorelist);
        targets.forEach(t => {
            document.querySelector(`.tourney-item[data-tourney-name="${CSS.escape(t.name)}"]`)?.remove();
            checkedTournaments.delete(t.name);
        });
        updateMissingStatsLoaderButton();
        const countEl = document.getElementById("tourney-count");
        if (countEl) countEl.textContent = `(${document.querySelectorAll(".tourney-item").length})`;
        const names = targets.map(t => t.name);
        document.querySelectorAll(".match-card").forEach(card => {
            if (names.includes(card.getAttribute("data-tournament"))) card.style.display = "none";
        });
    }

    document.getElementById("btn-ignore-unchecked")?.addEventListener("click", () => ignoreVisible(false));
    document.getElementById("btn-ignore-checked")?.addEventListener("click", () => ignoreVisible(true));

    document.getElementById("mdm-close")?.addEventListener("click", closeMatchDetail);
    detailOverlay?.addEventListener("click", e => { 
        if (e.target === detailOverlay) closeMatchDetail(); 
    });

    const mdmRefreshBtn = document.getElementById("mdm-refresh-btn");
    mdmRefreshBtn?.addEventListener("click", async () => {
        if (!currentDetailId) return;
        mdmRefreshBtn.disabled = true;
        const originalHTML = mdmRefreshBtn.innerHTML;
        mdmRefreshBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate fa-spin"></i> Loading...`;
        try {
            const data = await fetch(`/api/match/${currentDetailId}?refresh=true`).then(r => r.json());
            renderMatchDetail(data, currentS1, currentS2);
            mdmRefreshBtn.innerHTML = `<i class="fa-solid fa-check"></i> Updated!`;
            setTimeout(() => { mdmRefreshBtn.innerHTML = originalHTML; }, 1500);
        } catch(e) {
            console.error("Failed to refresh stats:", e);
            mdmRefreshBtn.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Failed`;
            setTimeout(() => { mdmRefreshBtn.innerHTML = originalHTML; }, 1500);
        } finally {
            mdmRefreshBtn.disabled = false;
        }
    });

    function updateMdmNavButtons() {
        const prevBtn = document.getElementById("mdm-nav-prev");
        const nextBtn = document.getElementById("mdm-nav-next");
        if (!prevBtn || !nextBtn) return;

        const visibleCards = Array.from(document.querySelectorAll(".match-card")).filter(card => card.style.display !== "none");
        const currentIndex = visibleCards.findIndex(card => card.getAttribute("data-id") === currentDetailId);

        if (currentIndex === -1) {
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            return;
        }

        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex === visibleCards.length - 1;
    }

    function navigateMatchDetail(direction) {
        const visibleCards = Array.from(document.querySelectorAll(".match-card")).filter(card => card.style.display !== "none");
        const currentIndex = visibleCards.findIndex(card => card.getAttribute("data-id") === currentDetailId);

        if (currentIndex === -1) return;

        let targetIndex = currentIndex + direction;
        if (targetIndex >= 0 && targetIndex < visibleCards.length) {
            const targetCard = visibleCards[targetIndex];
            openMatchDetail(targetCard.getAttribute("data-id"), targetCard);
        }
    }

    document.getElementById("mdm-nav-prev")?.addEventListener("click", (e) => {
        e.stopPropagation();
        navigateMatchDetail(-1);
    });

    document.getElementById("mdm-nav-next")?.addEventListener("click", (e) => {
        e.stopPropagation();
        navigateMatchDetail(1);
    });

    document.addEventListener("keydown", e => { 
        if (detailOverlay && detailOverlay.style.display === "flex") {
            if (e.key === "Escape") {
                closeMatchDetail();
            } else if (e.key === "ArrowLeft") {
                navigateMatchDetail(-1);
            } else if (e.key === "ArrowRight") {
                navigateMatchDetail(1);
            }
        }
    });

    // Player Aggregated Stats / Leaderboard Functions
    function calculatePlayerAggregates(matches, selectedTourneys, splitByTeam = false) {
        const playersMap = {};

        if (!Array.isArray(matches)) return [];

        matches.forEach(m => {
            if (m && m.tournament && selectedTourneys && selectedTourneys.has(m.tournament)) {
                if (m.players && typeof m.players === "object" && m.players.all && typeof m.players.all === "object") {
                    const teams = ["team1", "team2"];
                    teams.forEach(tKey => {
                        const playersList = m.players.all[tKey];
                        const currentTeamLogo = (tKey === "team1") ? (m.team1_logo || "") : (m.team2_logo || "");
                        const currentTeamName = (tKey === "team1") ? (m.team1 || "") : (m.team2 || "");
                        if (Array.isArray(playersList)) {
                            playersList.forEach(p => {
                                if (!p || !p.name) return;
                                
                                const key = splitByTeam ? `${p.name}||${currentTeamName}` : p.name;
                                
                                if (!playersMap[key]) {
                                    playersMap[key] = {
                                        name: p.name,
                                        photo: p.photo || "",
                                        teamLogo: splitByTeam ? currentTeamLogo : "",
                                        teamName: splitByTeam ? currentTeamName : "",
                                        agents: {}, // name -> { icon, count }
                                        matchesPlayed: 0,
                                        ratingsList: [],
                                        acsList: [],
                                        kills: 0,
                                        deaths: 0,
                                        assists: 0,
                                        kastList: [],
                                        adrList: [],
                                        hsList: [],
                                        fk: 0,
                                        fd: 0
                                    };
                                }

                                const agg = playersMap[key];
                                agg.matchesPlayed++;
                                
                                if (!agg.photo && p.photo) agg.photo = p.photo;
                                if (splitByTeam) {
                                    if (!agg.teamLogo && currentTeamLogo) agg.teamLogo = currentTeamLogo;
                                    if (!agg.teamName && currentTeamName) agg.teamName = currentTeamName;
                                }

                                if (Array.isArray(p.agents)) {
                                    p.agents.forEach(a => {
                                        if (a && a.name) {
                                            if (!agg.agents[a.name]) {
                                                agg.agents[a.name] = { icon: a.icon || "", count: 0 };
                                            }
                                            agg.agents[a.name].count++;
                                        }
                                    });
                                }

                                const ratingVal = parseFloat(p.rating);
                                if (!isNaN(ratingVal)) agg.ratingsList.push(ratingVal);

                                const acsVal = parseFloat(p.acs);
                                if (!isNaN(acsVal)) agg.acsList.push(acsVal);

                                const kVal = parseInt(p.k);
                                if (!isNaN(kVal)) agg.kills += kVal;

                                const dVal = parseInt(p.d);
                                if (!isNaN(dVal)) agg.deaths += dVal;

                                const aVal = parseInt(p.a);
                                if (!isNaN(aVal)) agg.assists += aVal;

                                if (p.kast && typeof p.kast === "string") {
                                    const kastVal = parseFloat(p.kast.replace("%", ""));
                                    if (!isNaN(kastVal)) agg.kastList.push(kastVal);
                                }

                                const adrVal = parseFloat(p.adr);
                                if (!isNaN(adrVal)) agg.adrList.push(adrVal);

                                if (p.hs && typeof p.hs === "string") {
                                    const hsVal = parseFloat(p.hs.replace("%", ""));
                                    if (!isNaN(hsVal)) agg.hsList.push(hsVal);
                                }

                                const fkVal = parseInt(p.fk);
                                if (!isNaN(fkVal)) agg.fk += fkVal;

                                const fdVal = parseInt(p.fd);
                                if (!isNaN(fdVal)) agg.fd += fdVal;
                            });
                        }
                    });
                }
            }
        });

        return Object.values(playersMap).map(agg => {
            const avg = list => list.length ? (list.reduce((sum, val) => sum + val, 0) / list.length) : 0;
            
            const avgRating = avg(agg.ratingsList);
            const avgAcs = avg(agg.acsList);
            const avgKast = avg(agg.kastList);
            const avgAdr = avg(agg.adrList);
            const avgHs = avg(agg.hsList);

            const sortedAgents = Object.entries(agg.agents)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([name, data]) => ({ name, icon: data.icon }));

            return {
                name: agg.name,
                photo: agg.photo,
                teamLogo: agg.teamLogo,
                teamName: agg.teamName,
                agents: sortedAgents,
                matchesPlayed: agg.matchesPlayed,
                rating: avgRating ? avgRating.toFixed(2) : "N/A",
                acs: avgAcs ? Math.round(avgAcs) : "N/A",
                k: agg.kills,
                d: agg.deaths,
                a: agg.assists,
                kd_diff: agg.kills - agg.deaths,
                kast: avgKast ? Math.round(avgKast) + "%" : "N/A",
                adr: avgAdr ? Math.round(avgAdr) : "N/A",
                hs: avgHs ? Math.round(avgHs) + "%" : "N/A",
                fk: agg.fk,
                fd: agg.fd,
                fk_diff: agg.fk - agg.fd
            };
        });
    }

    async function openLeaderboard() {
        try {
            // Leaderboard needs full player stats — fetch them on demand from
            // /api/matches/all (the slim /api/matches list only carries has_stats).
            // Share the cachedAllMatches dataset with the standings view.
            if (!cachedAllMatches) {
                cachedAllMatches = await fetch("/api/matches/all").then(r => r.json()).catch(() => null);
            }
            const matches = cachedAllMatches || [];
            const selectedTourneys = typeof checkedTournaments !== "undefined" ? checkedTournaments : new Set();
            
            // Read split statistics toggle state
            const teamSplitCheckbox = document.getElementById("setting-team-split-stats");
            const splitByTeam = teamSplitCheckbox ? teamSplitCheckbox.checked : false;

            const aggregates = calculatePlayerAggregates(matches, selectedTourneys, splitByTeam);

            const tbody = document.getElementById("leaderboard-tbody");
            if (!tbody) {
                console.error("leaderboard-tbody element not found");
                return;
            }

            if (aggregates.length === 0) {
                tbody.innerHTML = `<tr><td colspan="15" style="text-align:center; padding: 30px; color: var(--text-muted); font-size: 14px;">No player statistics available. Please load match details first.</td></tr>`;
                const modal = document.getElementById("player-leaderboard-modal");
                if (modal) modal.style.display = "flex";
                return;
            }

            // Default sort: Average Rating (Avg R) Descending
            aggregates.sort((a, b) => {
                const numA = parseFloat(a.rating);
                const numB = parseFloat(b.rating);
                const rA = isNaN(numA) ? -Infinity : numA;
                const rB = isNaN(numB) ? -Infinity : numB;
                return rB - rA;
            });

            // Set visual active sort indicator on the "Avg R" header (Index 3)
            const table = document.getElementById("leaderboard-table");
            if (table) {
                table.querySelectorAll("th").forEach((h, idx) => {
                    if (idx === 3) {
                        h.setAttribute("data-sort-dir", "desc");
                        h.classList.add("th-sort-desc");
                        h.classList.remove("th-sort-asc");
                    } else {
                        h.removeAttribute("data-sort-dir");
                        h.classList.remove("th-sort-asc", "th-sort-desc");
                    }
                });
            }

            const maxAcs = arr => Math.max(...arr.map(p => parseInt(p.acs) || 0));
            const topAcs = maxAcs(aggregates);

            tbody.innerHTML = aggregates.map(p => {
                const teamWhite = whiteLogoTeams.has(p.teamName);
                return `<tr>
                    <td><div class="mdm-player-cell">${p.teamLogo ? `<img class="mdm-player-team-logo ${teamWhite ? 'white-bg-logo' : ''}" src="${p.teamLogo}" alt="" title="${p.teamName || 'Team Logo'}">` : ''}${p.photo ? `<img class="mdm-player-photo" src="${p.photo}" alt="${p.name}">` : '<div class="mdm-player-photo-placeholder"></div>'}<span>${p.name}</span></div></td>
                    <td>${renderAgents(p.agents)}</td>
                    <td class="r">${p.matchesPlayed}</td>
                    <td class="r">${p.rating}</td>
                    <td class="r ${(parseInt(p.acs)||0) === topAcs ? 'mdm-acs-top' : ''}">${p.acs}</td>
                    <td class="r">${p.k}</td>
                    <td class="r">${p.d}</td>
                    <td class="r">${p.a}</td>
                    <td class="r">${formatDiff(p.kd_diff)}</td>
                    <td class="r">${p.kast}</td>
                    <td class="r">${p.adr}</td>
                    <td class="r">${p.hs}</td>
                    <td class="r">${p.fk}</td>
                    <td class="r">${p.fd}</td>
                    <td class="r">${formatDiff(p.fk_diff)}</td>
                </tr>`;
            }).join("");

            // Apply current search query if any
            const searchInput = document.getElementById("leaderboard-search");
            if (searchInput && searchInput.value) {
                const query = searchInput.value.toLowerCase().trim();
                const rows = tbody.querySelectorAll("tr");
                rows.forEach(row => {
                    const nameEl = row.querySelector(".mdm-player-cell span");
                    const name = nameEl ? nameEl.textContent.toLowerCase() : "";
                    if (name.includes(query)) {
                        row.style.display = "";
                    } else {
                        row.style.display = "none";
                    }
                });
            }

            const modal = document.getElementById("player-leaderboard-modal");
            if (modal) modal.style.display = "flex";
        } catch (err) {
            console.error("Failed to render player aggregates leaderboard:", err);
        }
    }

    // Leaderboard trigger
    const leaderboardBtn = document.getElementById("leaderboard-btn");
    const leaderboardModal = document.getElementById("player-leaderboard-modal");
    const leaderboardClose = document.getElementById("leaderboard-close");
    const teamSplitCheckbox = document.getElementById("setting-team-split-stats");
    const hideAgentsCheckbox = document.getElementById("setting-hide-agents");
    const leaderboardSearchInput = document.getElementById("leaderboard-search");

    // Restore saved split by team setting
    if (teamSplitCheckbox) {
        teamSplitCheckbox.checked = localStorage.getItem("leaderboardTeamSplit") === "true";
        teamSplitCheckbox.addEventListener("change", () => {
            localStorage.setItem("leaderboardTeamSplit", teamSplitCheckbox.checked);
            openLeaderboard();
        });
    }

    // Restore saved hide agents setting
    if (hideAgentsCheckbox) {
        const savedHide = localStorage.getItem("leaderboardHideAgents") === "true";
        hideAgentsCheckbox.checked = savedHide;
        const table = document.getElementById("leaderboard-table");
        if (table) {
            table.classList.toggle("hide-agents-column", savedHide);
        }
        hideAgentsCheckbox.addEventListener("change", () => {
            const isChecked = hideAgentsCheckbox.checked;
            localStorage.setItem("leaderboardHideAgents", isChecked);
            const tableEl = document.getElementById("leaderboard-table");
            if (tableEl) {
                tableEl.classList.toggle("hide-agents-column", isChecked);
            }
        });
    }

    // Listen to leaderboard search input changes
    leaderboardSearchInput?.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        const rows = document.querySelectorAll("#leaderboard-tbody tr");
        rows.forEach(row => {
            const nameEl = row.querySelector(".mdm-player-cell span");
            const name = nameEl ? nameEl.textContent.toLowerCase() : "";
            if (name.includes(query)) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
        });
    });

    leaderboardBtn?.addEventListener("click", openLeaderboard);
    leaderboardClose?.addEventListener("click", () => {
        if (leaderboardModal) leaderboardModal.style.display = "none";
    });
    leaderboardModal?.addEventListener("click", (e) => {
        const modalBox = leaderboardModal.querySelector(".match-detail-modal");
        if (modalBox && !modalBox.contains(e.target)) {
            leaderboardModal.style.display = "none";
        }
    });

    // Team history modal trigger & helper functions
    let selectedTeamHistoryName = "";
    let thrFilterSelectedTourneys = true;
    let thrShowFutureMatches = false;

    function populateTeamDropdown(searchKeyword = "") {
        const dropdown = document.getElementById("team-history-custom-dropdown");
        if (!dropdown) return;

        dropdown.innerHTML = "";

        const matches = typeof INITIAL_MATCHES !== "undefined" ? INITIAL_MATCHES : [];
        const teamsMap = new Map();
        matches.forEach(m => {
            if (m.team1 && m.team1 !== "TBD") {
                if (!teamsMap.has(m.team1) || (!teamsMap.get(m.team1) && m.team1_logo)) {
                    teamsMap.set(m.team1, m.team1_logo || "");
                }
            }
            if (m.team2 && m.team2 !== "TBD") {
                if (!teamsMap.has(m.team2) || (!teamsMap.get(m.team2) && m.team2_logo)) {
                    teamsMap.set(m.team2, m.team2_logo || "");
                }
            }
        });

        const sortedTeams = Array.from(teamsMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        
        const filteredTeams = sortedTeams.filter(([name]) => 
            name.toLowerCase().includes(searchKeyword.toLowerCase())
        );

        if (filteredTeams.length === 0) {
            dropdown.innerHTML = '<div class="csd-empty-msg">No teams match search</div>';
            return;
        }

        filteredTeams.forEach(([name, logo]) => {
            const item = document.createElement("div");
            const isActive = name === selectedTeamHistoryName;
            item.className = `csd-option-item ${isActive ? 'active' : ''}`;
            item.setAttribute("data-team", name);
            
            item.innerHTML = `
                ${logo ? `<img class="csd-option-logo" src="${logo}" onerror="this.style.display='none';">` : '<div class="csd-option-placeholder"><i class="fa-solid fa-people-group"></i></div>'}
                <span>${name}</span>
            `;

            item.addEventListener("click", () => {
                selectedTeamHistoryName = name;
                
                const label = document.getElementById("thr-selected-team-label");
                if (label) label.textContent = name;

                const iconContainer = document.getElementById("thr-selected-team-icon-container");
                if (iconContainer) {
                    if (logo) {
                        iconContainer.innerHTML = `<img src="${logo}" style="width: 18px; height: 18px; object-fit: contain; vertical-align: middle; border-radius: 4px;">`;
                    } else {
                        iconContainer.innerHTML = `<i class="fa-solid fa-people-group"></i>`;
                    }
                }

                const panel = document.getElementById("team-history-popover-panel");
                const wrapper = document.querySelector(".thr-dropdown-popover-wrapper");
                if (panel) panel.style.display = "none";
                if (wrapper) wrapper.classList.remove("active");

                renderTeamHistory(name);
            });

            dropdown.appendChild(item);
        });

        if (searchKeyword && filteredTeams.length === 1) {
            const singleTeamName = filteredTeams[0][0];
            const singleTeamLogo = filteredTeams[0][1];
            if (selectedTeamHistoryName !== singleTeamName) {
                selectedTeamHistoryName = singleTeamName;
                const label = document.getElementById("thr-selected-team-label");
                if (label) label.textContent = singleTeamName;
                
                const iconContainer = document.getElementById("thr-selected-team-icon-container");
                if (iconContainer) {
                    if (singleTeamLogo) {
                        iconContainer.innerHTML = `<img src="${singleTeamLogo}" style="width: 18px; height: 18px; object-fit: contain; vertical-align: middle; border-radius: 4px;">`;
                    } else {
                        iconContainer.innerHTML = `<i class="fa-solid fa-people-group"></i>`;
                    }
                }

                const panel = document.getElementById("team-history-popover-panel");
                const wrapper = document.querySelector(".thr-dropdown-popover-wrapper");
                if (panel) panel.style.display = "none";
                if (wrapper) wrapper.classList.remove("active");
                renderTeamHistory(singleTeamName);
            }
        }
    }

    async function renderTeamHistory(teamName) {
        const resultsContainer = document.getElementById("team-history-results");
        if (!resultsContainer) return;

        const profileLogoWrapper = document.getElementById("thr-profile-logo-wrapper");
        const profileName = document.getElementById("thr-profile-name");
        const profileStats = document.getElementById("thr-profile-stats");
        const profileActions = document.getElementById("thr-profile-actions");
        const toggleWhiteLogo = document.getElementById("thr-toggle-white-logo");
        const statWinrate = document.getElementById("thr-stat-winrate");
        const statWins = document.getElementById("thr-stat-wins");
        const statLosses = document.getElementById("thr-stat-losses");

        if (!teamName) {
            if (profileName) profileName.textContent = "Select a Team";
            if (profileLogoWrapper) profileLogoWrapper.innerHTML = `<i class="fa-solid fa-people-group"></i>`;
            if (profileStats) profileStats.style.display = "none";
            if (profileActions) profileActions.style.display = "none";
            resultsContainer.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-muted); font-size: 14px;">Select a team from the dropdown above to view match results.</p>';
            return;
        }

        // Determine data source based on toggle
        let allMatches;
        if (thrFilterSelectedTourneys) {
            // ON: filter to only checked sidebar tournaments from INITIAL_MATCHES
            allMatches = typeof INITIAL_MATCHES !== "undefined" ? INITIAL_MATCHES : [];
        } else {
            // OFF: fetch ALL matches from every tournament in the DB
            try {
                allMatches = await fetch("/api/matches/all").then(r => r.json());
            } catch (err) {
                console.error("Failed to fetch all matches:", err);
                allMatches = typeof INITIAL_MATCHES !== "undefined" ? INITIAL_MATCHES : [];
            }
        }

        let teamMatches = allMatches.filter(m => {
            const isTeam = m.team1 === teamName || m.team2 === teamName;
            if (!isTeam) return false;
            return thrShowFutureMatches ? true : (m.status === "Completed");
        });

        if (thrFilterSelectedTourneys) {
            const checkedT = new Set(
                Array.from(document.querySelectorAll("#tournament-checklist .tourney-checkbox:checked")).map(cb => cb.value)
            );
            teamMatches = teamMatches.filter(m => checkedT.has(m.tournament));
        }

        // Find best logo across all available matches
        let foundLogo = "";
        for (const m of allMatches) {
            if (m.team1 === teamName && m.team1_logo) { foundLogo = m.team1_logo; break; }
            if (m.team2 === teamName && m.team2_logo) { foundLogo = m.team2_logo; break; }
        }
        if (!foundLogo && typeof INITIAL_MATCHES !== "undefined") {
            for (const m of INITIAL_MATCHES) {
                if (m.team1 === teamName && m.team1_logo) { foundLogo = m.team1_logo; break; }
                if (m.team2 === teamName && m.team2_logo) { foundLogo = m.team2_logo; break; }
            }
        }

        // Calculate Win Rate / Wins / Losses
        let wins = 0;
        let losses = 0;
        let draws = 0;

        teamMatches.forEach(m => {
            const isTeam1 = m.team1 === teamName;

            if (m.status !== "Completed" && m.status) return; // skip upcoming/live matches for stats calculation

            const myScore = parseInt(isTeam1 ? m.score1 : m.score2) || 0;
            const oppScore = parseInt(isTeam1 ? m.score2 : m.score1) || 0;

            if (myScore > oppScore) wins++;
            else if (oppScore > myScore) losses++;
            else draws++;
        });

        const total = wins + losses + draws;
        const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;

        // Update Left Profile Card
        if (profileName) profileName.textContent = teamName;
        if (profileLogoWrapper) {
            if (foundLogo) {
                const isWhite = whiteLogoTeams.has(teamName) ? "white-bg-logo" : "";
                profileLogoWrapper.innerHTML = `<img src="${foundLogo}" class="${isWhite}" alt="${teamName}" onerror="this.onerror=null; this.parentNode.innerHTML='<i class=\\'fa-solid fa-people-group\\'></i>';">`;
            } else {
                profileLogoWrapper.innerHTML = `<i class="fa-solid fa-people-group"></i>`;
            }
        }
        if (profileStats) profileStats.style.display = "flex";
        if (profileActions) profileActions.style.display = "flex";
        if (toggleWhiteLogo) {
            toggleWhiteLogo.classList.toggle("active", whiteLogoTeams.has(teamName));
        }

        if (statWinrate) statWinrate.textContent = `${winrate}%`;
        if (statWins) statWins.textContent = wins;
        if (statLosses) statLosses.textContent = losses;

        if (teamMatches.length === 0) {
            resultsContainer.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-muted); font-size: 14px;">No matches found in local database for this team.</p>';
            return;
        }

        let html = "";
        let currentTournament = null;
        
        teamMatches.forEach(m => {
            const isTeam1 = m.team1 === teamName;
            
            const myTeam = teamName;
            const oppTeam = isTeam1 ? m.team2 : m.team1;
            
            const oppLogo = isTeam1 ? (m.team2_logo || "") : (m.team1_logo || "");

            const myScore = isTeam1 ? (m.score1 || '0') : (m.score2 || '0');
            const oppScore = isTeam1 ? (m.score2 || '0') : (m.score1 || '0');

            const myScoreNum = parseInt(myScore) || 0;
            const oppScoreNum = parseInt(oppScore) || 0;

            let statusText = m.status || "Completed";
            let statusClass = (m.status || "Completed").toLowerCase();
            let myColorClass = "thr-neutral";

            if (!m.status || m.status === "Completed") {
                if (myScoreNum > oppScoreNum) {
                    statusText = "Win";
                    statusClass = "win";
                    myColorClass = "thr-win-text";
                } else if (oppScoreNum > myScoreNum) {
                    statusText = "Loss";
                    statusClass = "loss";
                    myColorClass = "thr-loss-text";
                } else {
                    statusText = "Draw";
                    statusClass = "draw";
                }
            } else if (m.status === "Live") {
                statusText = "Live";
                statusClass = "live";
            } else {
                statusText = "Upcoming";
                statusClass = "upcoming";
            }

            const myLogo = isTeam1 ? (m.team1_logo || "") : (m.team2_logo || "");
            const myWhite = whiteLogoTeams.has(teamName) ? "white-bg-logo" : "";
            const oppWhite = whiteLogoTeams.has(oppTeam) ? "white-bg-logo" : "";

            const now = Math.floor(Date.now() / 1000);
            let timeAgoText = "";
            let timeAgoClass = "thr-neutral";
            
            if (m.unix_timestamp) {
                const diff = Math.abs(now - m.unix_timestamp);
                const isFuture = m.unix_timestamp > now;
                timeAgoClass = isFuture ? "thr-relative-future" : "thr-relative-past";
                
                const SECONDS_IN_HOUR = 3600;
                const SECONDS_IN_DAY = 86400;
                const SECONDS_IN_MONTH = 86400 * 30.44;
                const SECONDS_IN_YEAR = 86400 * 365.2425;

                let temp = diff;
                const years = Math.floor(temp / SECONDS_IN_YEAR);
                temp %= SECONDS_IN_YEAR;
                const months = Math.floor(temp / SECONDS_IN_MONTH);
                temp %= SECONDS_IN_MONTH;
                const days = Math.floor(temp / SECONDS_IN_DAY);
                temp %= SECONDS_IN_DAY;
                const hours = Math.floor(temp / SECONDS_IN_HOUR);

                const parts = [];
                if (years > 0) parts.push(`${years}y`);
                if (months > 0) parts.push(`${months}m`);
                if (days > 0) parts.push(`${days}d`);
                if (hours > 0 || parts.length === 0) parts.push(`${hours}h`);
                
                timeAgoText = parts.join("-");
            }

            if (m.tournament !== currentTournament) {
                currentTournament = m.tournament;
                html += `
                    <div class="thr-tourney-group-header">
                        ${m.tournament_logo ? `<img src="${m.tournament_logo}" class="thr-logo" onerror="this.style.display='none';">` : ''}
                        <span class="thr-name" title="${m.tournament}">${m.tournament}</span>
                    </div>
                `;
            }

            html += `
                <div class="team-history-row" data-id="${m.id}">
                    <div class="thr-row-bottom">
                        <div class="thr-main-team">
                            ${myLogo ? `<img class="thr-team-logo ${myWhite}" src="${myLogo}" onerror="this.style.display='none';">` : `<i class="fa-solid fa-people-group thr-team-logo-fallback"></i>`}
                        </div>
                        <div class="thr-score-container">
                            ${m.status === "Upcoming" ? `<span class="thr-score-val thr-neutral">vs</span>` : `<span class="thr-score-val ${myColorClass}">${myScore} – ${oppScore}</span>`}
                        </div>
                        <div class="thr-opponent">
                            ${oppLogo ? `<img class="thr-team-logo ${oppWhite}" src="${oppLogo}" onerror="this.style.display='none';">` : ''}
                            <span class="thr-opp-name" title="${oppTeam}">${oppTeam}</span>
                        </div>
                        <div class="thr-status-container" style="display: flex; align-items: center; gap: 8px;">
                            ${timeAgoText ? `<span class="thr-time-ago ${timeAgoClass}">${timeAgoText}</span>` : ''}
                            <span class="thr-status ${statusClass}">${statusText}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        resultsContainer.innerHTML = html;

        resultsContainer.querySelectorAll(".team-history-row").forEach(row => {
            row.addEventListener("click", () => {
                const mid = row.getAttribute("data-id");
                if (mid) {
                    window.open("/?match=" + mid, "_blank");
                }
            });
        });
    }

    function showTeamHistory(teamName) {
        selectedTeamHistoryName = teamName;
        const label = document.getElementById("thr-selected-team-label");
        if (label) label.textContent = teamName;

        const matches = typeof INITIAL_MATCHES !== "undefined" ? INITIAL_MATCHES : [];
        let foundLogo = "";
        for (const m of matches) {
            if (m.team1 === teamName && m.team1_logo) {
                foundLogo = m.team1_logo;
                break;
            }
            if (m.team2 === teamName && m.team2_logo) {
                foundLogo = m.team2_logo;
                break;
            }
        }

        const iconContainer = document.getElementById("thr-selected-team-icon-container");
        if (iconContainer) {
            if (foundLogo) {
                iconContainer.innerHTML = `<img src="${foundLogo}" style="width: 18px; height: 18px; object-fit: contain; vertical-align: middle; border-radius: 4px;" onerror="this.onerror=null; this.parentNode.innerHTML='<i class=\\'fa-solid fa-people-group\\'></i>';">`;
            } else {
                iconContainer.innerHTML = `<i class="fa-solid fa-people-group"></i>`;
            }
        }

        const historySearch = document.getElementById("team-history-search");
        const historyPopoverPanel = document.getElementById("team-history-popover-panel");
        const historyPopoverWrapper = document.querySelector(".thr-dropdown-popover-wrapper");

        if (historySearch) historySearch.value = "";
        if (historyPopoverPanel) historyPopoverPanel.style.display = "none";
        if (historyPopoverWrapper) historyPopoverWrapper.classList.remove("active");

        populateTeamDropdown();
        renderTeamHistory(teamName);

        // Close the match detail modal if open
        closeMatchDetail();

        const historyModal = document.getElementById("team-history-modal");
        if (historyModal) historyModal.style.display = "flex";
    }

    document.getElementById("mdm-team1")?.addEventListener("click", () => {
        const teamName = document.getElementById("mdm-name1")?.textContent.trim();
        if (teamName) showTeamHistory(teamName);
    });

    document.getElementById("mdm-team2")?.addEventListener("click", () => {
        const teamName = document.getElementById("mdm-name2")?.textContent.trim();
        if (teamName) showTeamHistory(teamName);
    });

    const teamHistoryBtn = document.getElementById("team-history-btn");
    const teamHistoryModal = document.getElementById("team-history-modal");
    const teamHistoryClose = document.getElementById("team-history-close");
    const teamHistorySearch = document.getElementById("team-history-search");
    const popoverTrigger = document.getElementById("thr-popover-trigger");
    const popoverPanel = document.getElementById("team-history-popover-panel");
    const popoverWrapper = document.querySelector(".thr-dropdown-popover-wrapper");

    teamHistoryBtn?.addEventListener("click", () => {
        selectedTeamHistoryName = "";
        const label = document.getElementById("thr-selected-team-label");
        if (label) label.textContent = "Select Team";
        
        const iconContainer = document.getElementById("thr-selected-team-icon-container");
        if (iconContainer) iconContainer.innerHTML = `<i class="fa-solid fa-people-group"></i>`;

        if (teamHistorySearch) teamHistorySearch.value = "";
        if (popoverPanel) popoverPanel.style.display = "none";
        if (popoverWrapper) popoverWrapper.classList.remove("active");
        populateTeamDropdown();
        renderTeamHistory("");
        if (teamHistoryModal) teamHistoryModal.style.display = "flex";
    });
    teamHistoryClose?.addEventListener("click", () => {
        if (teamHistoryModal) teamHistoryModal.style.display = "none";
    });
    teamHistoryModal?.addEventListener("click", (e) => {
        const modalBox = teamHistoryModal.querySelector(".match-detail-modal");
        if (modalBox && !modalBox.contains(e.target)) {
            teamHistoryModal.style.display = "none";
        }
    });
    popoverTrigger?.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = popoverPanel && popoverPanel.style.display === "block";
        if (isOpen) {
            if (popoverPanel) popoverPanel.style.display = "none";
            if (popoverWrapper) popoverWrapper.classList.remove("active");
        } else {
            if (popoverPanel) popoverPanel.style.display = "block";
            if (popoverWrapper) popoverWrapper.classList.add("active");
            if (teamHistorySearch) teamHistorySearch.value = "";
            populateTeamDropdown();
            setTimeout(() => teamHistorySearch?.focus(), 50);
        }
    });
    teamHistorySearch?.addEventListener("input", (e) => {
        populateTeamDropdown(e.target.value);
    });

    document.getElementById("tournament-checklist")?.addEventListener("input", (e) => {
        if (e.target.classList.contains("tourney-color-picker")) {
            const tourney = e.target.getAttribute("data-tourney-name");
            const color = e.target.value;
            tournamentColors[tourney] = color;
            applyTournamentColors();
        }
    });

    document.getElementById("tournament-checklist")?.addEventListener("change", async (e) => {
        if (e.target.classList.contains("tourney-color-picker")) {
            const tourney = e.target.getAttribute("data-tourney-name");
            const color = e.target.value;
            tournamentColors[tourney] = color;
            try {
                const cur = await fetch("/api/settings").then(r => r.json()).catch(() => ({}));
                cur.tournament_colors = tournamentColors;
                await fetch("/api/settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(cur)
                });
            } catch (err) {
                console.error("Failed to save tournament colors:", err);
            }
        }
    });
    document.getElementById("thr-toggle-future-matches")?.addEventListener("click", () => {
        thrShowFutureMatches = !thrShowFutureMatches;
        document.getElementById("thr-toggle-future-matches")?.classList.toggle("active", thrShowFutureMatches);
        if (selectedTeamHistoryName) renderTeamHistory(selectedTeamHistoryName);
    });

    document.getElementById("thr-toggle-white-logo")?.addEventListener("click", async () => {
        if (!selectedTeamHistoryName) return;
        const isActive = whiteLogoTeams.has(selectedTeamHistoryName);
        if (!isActive) {
            whiteLogoTeams.add(selectedTeamHistoryName);
        } else {
            whiteLogoTeams.delete(selectedTeamHistoryName);
        }
        await saveWhiteLogoTeams();
        renderTeamHistory(selectedTeamHistoryName);
        renderWhiteLogoTeamsList();
    });
    document.getElementById("setting-thr-all-tourneys")?.addEventListener("change", async (e) => {
        const showAll = e.target.checked;
        thrFilterSelectedTourneys = !showAll;
        // Persist to settings
        try {
            const cur = await fetch("/api/settings").then(r => r.json()).catch(() => ({}));
            cur.thr_show_all_tournaments = showAll;
            await fetch("/api/settings", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(cur) });
        } catch (err) { console.error("Failed to save thr setting:", err); }
        // Re-render if modal is open
        if (selectedTeamHistoryName) renderTeamHistory(selectedTeamHistoryName);
    });
    document.addEventListener("click", (e) => {
        const wrapper = document.querySelector(".thr-dropdown-popover-wrapper");
        const panel = document.getElementById("team-history-popover-panel");
        if (panel && panel.style.display === "block") {
            if (wrapper && !wrapper.contains(e.target)) {
                panel.style.display = "none";
                wrapper.classList.remove("active");
            }
        }
    });

    // Delegated click sorting for all stats tables (both in match detail and leaderboard modals)
    document.addEventListener("click", (e) => {
        const th = e.target.closest(".mdm-stats-table th");
        if (!th) return;
        const table = th.closest("table");
        if (!table) return;
        const tbody = table.querySelector("tbody");
        if (!tbody) return;
        const rows = Array.from(tbody.querySelectorAll("tr"));
        if (!rows.length) return;

        const index = Array.from(th.parentNode.children).indexOf(th);
        let dir = th.getAttribute("data-sort-dir") === "desc" ? "asc" : "desc";

        table.querySelectorAll("th").forEach(h => {
            if (h !== th) {
                h.removeAttribute("data-sort-dir");
                h.classList.remove("th-sort-asc", "th-sort-desc");
            }
        });

        th.setAttribute("data-sort-dir", dir);
        th.classList.toggle("th-sort-asc", dir === "asc");
        th.classList.toggle("th-sort-desc", dir === "desc");

        rows.sort((rowA, rowB) => {
            const cellA = rowA.children[index];
            const cellB = rowB.children[index];
            let valA = cellA ? cellA.textContent.trim() : "";
            let valB = cellB ? cellB.textContent.trim() : "";

            const isNumeric = index >= 2;
            if (isNumeric) {
                const parseNum = (val) => {
                    const cleaned = val.replace(/[%+]/g, "").trim();
                    const num = parseFloat(cleaned);
                    return isNaN(num) ? (dir === "asc" ? Infinity : -Infinity) : num;
                };
                return dir === "asc" ? parseNum(valA) - parseNum(valB) : parseNum(valB) - parseNum(valA);
            } else {
                return dir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
        });

        rows.forEach(row => tbody.appendChild(row));
    });

    const tournamentStandingsBtn = document.getElementById("tournament-standings-btn");
    const tournamentStandingsModal = document.getElementById("tournament-standings-modal");
    const tournamentStandingsClose = document.getElementById("tournament-standings-close");
    const tournamentStandingsContent = document.getElementById("tournament-standings-content");
    const standingsSearchInput = document.getElementById("standings-search");

    // Full-stats dataset shared by the leaderboard and standings views.
    // Fetched once from /api/matches/all and reused until the next Sync.
    let cachedAllMatches = null;

    async function renderTournamentStandings() {
        if (!tournamentStandingsContent) return;

        try {
            if (!cachedAllMatches) {
                const response = await fetch("/api/matches/all");
                cachedAllMatches = await response.json();
            }
            const matches = cachedAllMatches || [];

            if (!matches || matches.length === 0) {
                tournamentStandingsContent.innerHTML = `<p style="padding: 30px; text-align: center; color: var(--text-muted);">No match data found.</p>`;
                return;
            }

            const standingsByTourney = {};
            const tourneyLogos = {};
            const teamLogos = {};

            const visibleCheckedItems = Array.from(document.querySelectorAll("#tournament-checklist .tourney-item"))
                .filter(item => item.style.display !== "none")
                .map(item => item.querySelector(".tourney-checkbox"))
                .filter(cb => cb && cb.checked)
                .map(cb => cb.value);

            const activeTournaments = new Set(visibleCheckedItems);

            matches.forEach(m => {
                if (m.status?.toLowerCase() !== "completed" || m.score1 === null || m.score2 === null) return;
                const tourney = m.tournament;
                if (!tourney || !activeTournaments.has(tourney)) return;

                const s1 = parseInt(m.score1);
                const s2 = parseInt(m.score2);
                if (isNaN(s1) || isNaN(s2)) return;

                if (m.tournament_logo && !tourneyLogos[tourney]) tourneyLogos[tourney] = m.tournament_logo;
                if (m.team1 && m.team1_logo && !teamLogos[m.team1]) teamLogos[m.team1] = m.team1_logo;
                if (m.team2 && m.team2_logo && !teamLogos[m.team2]) teamLogos[m.team2] = m.team2_logo;

                if (!standingsByTourney[tourney]) standingsByTourney[tourney] = { matchesCount: 0, teams: {} };
                const tourneyData = standingsByTourney[tourney];
                tourneyData.matchesCount++;

                const t1 = m.team1 || "TBD";
                const t2 = m.team2 || "TBD";

                if (!tourneyData.teams[t1]) tourneyData.teams[t1] = { name: t1, w: 0, l: 0, mapW: 0, mapL: 0 };
                if (!tourneyData.teams[t2]) tourneyData.teams[t2] = { name: t2, w: 0, l: 0, mapW: 0, mapL: 0 };

                if (s1 > s2) {
                    tourneyData.teams[t1].w++;
                    tourneyData.teams[t2].l++;
                } else if (s2 > s1) {
                    tourneyData.teams[t2].w++;
                    tourneyData.teams[t1].l++;
                }

                // Aggregate map scores
                const maps = m.maps || [];
                if (maps.length > 0) {
                    maps.forEach(mp => {
                        const ms1 = parseInt(mp.score1) || 0;
                        const ms2 = parseInt(mp.score2) || 0;
                        if (mp.winner === 0) {
                            tourneyData.teams[t1].mapW++;
                            tourneyData.teams[t2].mapL++;
                        } else if (mp.winner === 1) {
                            tourneyData.teams[t2].mapW++;
                            tourneyData.teams[t1].mapL++;
                        } else if (ms1 > ms2) {
                            tourneyData.teams[t1].mapW++;
                            tourneyData.teams[t2].mapL++;
                        } else if (ms2 > ms1) {
                            tourneyData.teams[t2].mapW++;
                            tourneyData.teams[t1].mapL++;
                        }
                    });
                } else {
                    tourneyData.teams[t1].mapW += s1;
                    tourneyData.teams[t1].mapL += s2;
                    tourneyData.teams[t2].mapW += s2;
                    tourneyData.teams[t2].mapL += s1;
                }
            });

            const query = (standingsSearchInput?.value || "").toLowerCase().trim();

            const tourneyEntries = Object.entries(standingsByTourney).filter(([tourneyName, data]) => {
                if (!query) return true;
                if (tourneyName.toLowerCase().includes(query)) return true;
                return Object.keys(data.teams).some(tName => tName.toLowerCase().includes(query));
            });

            if (tourneyEntries.length === 0) {
                const msg = activeTournaments.size === 0 
                    ? "No tournaments selected in sidebar filters."
                    : "No tournament or team matched your search.";
                tournamentStandingsContent.innerHTML = `<p style="padding: 40px; text-align: center; color: var(--text-muted); font-size: 14px;">${msg}</p>`;
                return;
            }

            let html = `<div class="standings-container">`;

            tourneyEntries.forEach(([tourneyName, data]) => {
                const logo = tourneyLogos[tourneyName] || "";
                let teamsList = Object.values(data.teams);

                if (query && !tourneyName.toLowerCase().includes(query)) {
                    teamsList = teamsList.filter(t => t.name.toLowerCase().includes(query));
                }

                // Default sorting: Wins desc, Series Losses asc, Map Diff desc
                teamsList.sort((a, b) => {
                    if (b.w !== a.w) return b.w - a.w;
                    if (a.l !== b.l) return a.l - b.l;
                    const diffA = a.mapW - a.mapL;
                    const diffB = b.mapW - b.mapL;
                    return diffB - diffA;
                });

                html += `
                    <div class="standings-tourney-card">
                        <div class="standings-tourney-header">
                            ${logo ? `<img src="${logo}" class="standings-tourney-logo" onerror="this.style.display='none';">` : '<i class="fa-solid fa-trophy" style="color: var(--accent-red);"></i>'}
                            <span class="standings-tourney-title">${tourneyName}</span>
                            <span class="standings-tourney-badge">${data.matchesCount} Matches</span>
                        </div>
                        <table class="mdm-stats-table standings-table">
                            <thead>
                                <tr>
                                    <th style="width: 45px; text-align: center;"><span>#</span></th>
                                    <th><span>Team</span></th>
                                    <th class="r"><span>Series (W-L)</span></th>
                                    <th class="r"><span>Maps (W-L)</span></th>
                                    <th class="r"><span>Map Diff</span></th>
                                    <th class="r"><span>Win Rate</span></th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                teamsList.forEach((team, idx) => {
                    const rank = idx + 1;
                    const rankCls = rank === 1 ? "rank-1" : (rank === 2 ? "rank-2" : (rank === 3 ? "rank-3" : ""));
                    const teamLogo = teamLogos[team.name] || "";
                    const isWhiteLogo = whiteLogoTeams.has(team.name);
                    const mp = team.w + team.l;
                    const winRate = mp > 0 ? Math.round((team.w / mp) * 100) : 0;
                    const mapDiff = team.mapW - team.mapL;

                    html += `
                        <tr class="standings-team-row" data-team="${team.name}">
                            <td class="standings-rank ${rankCls}">${rank}</td>
                            <td>
                                <div class="standings-team-cell">
                                    ${teamLogo ? `<img src="${teamLogo}" class="standings-team-logo ${isWhiteLogo ? 'white-bg-logo' : ''}" onerror="this.style.display='none';">` : '<i class="fa-solid fa-people-group" style="color: var(--text-muted); font-size: 14px;"></i>'}
                                    <span>${team.name}</span>
                                </div>
                            </td>
                            <td class="r" style="font-weight: 700;">${team.w} – ${team.l}</td>
                            <td class="r">${team.mapW} – ${team.mapL}</td>
                            <td class="r">${formatDiff(mapDiff)}</td>
                            <td class="r"><span class="standings-win-rate-pill">${winRate}%</span></td>
                        </tr>
                    `;
                });

                html += `
                            </tbody>
                        </table>
                    </div>
                `;
            });

            html += `</div>`;
            tournamentStandingsContent.innerHTML = html;

            // Bind click handlers to team rows to open team history in a new tab
            tournamentStandingsContent.querySelectorAll(".standings-team-row").forEach(row => {
                row.addEventListener("click", () => {
                    const teamName = row.getAttribute("data-team");
                    if (teamName) {
                        window.open("/?team=" + encodeURIComponent(teamName), "_blank");
                    }
                });
            });

        } catch (err) {
            console.error("Error fetching standings:", err);
            tournamentStandingsContent.innerHTML = `<p style="padding: 30px; text-align: center; color: var(--accent-red);">Error loading standings data.</p>`;
        }
    }

    tournamentStandingsBtn?.addEventListener("click", () => {
        if (standingsSearchInput) standingsSearchInput.value = "";
        renderTournamentStandings();
        tournamentStandingsModal.style.display = "flex";
    });

    standingsSearchInput?.addEventListener("input", () => {
        renderTournamentStandings();
    });

    tournamentStandingsClose?.addEventListener("click", () => {
        tournamentStandingsModal.style.display = "none";
    });

    tournamentStandingsModal?.addEventListener("click", (e) => {
        const modalBox = tournamentStandingsModal.querySelector(".match-detail-modal");
        if (modalBox && !modalBox.contains(e.target)) {
            tournamentStandingsModal.style.display = "none";
        }
    });
});
