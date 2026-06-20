document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const bstClock = document.getElementById("current-bst-clock");

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
    const statusBtns = document.querySelectorAll(".status-btn");
    const tourneyCheckboxes = document.querySelectorAll(".tourney-checkbox");
    const selectAllBtn = document.getElementById("btn-select-all");
    const deselectAllBtn = document.getElementById("btn-deselect-all");
    const refreshBtn = document.getElementById("refresh-data-btn");
    const matchesGrid = document.getElementById("matches-grid-container");
    
    // Global filter state
    let activeStatus = sessionStorage.getItem("activeStatus") || "all";

    // Restore active status button
    statusBtns.forEach(btn => {
        if (btn.getAttribute("data-status") === activeStatus) btn.classList.add("active");
        else btn.classList.remove("active");
    });
    let searchQuery = "";
    let checkedTournaments = new Set();
    let customSeriesFilters = [];
    let tournamentOrder = {}; // {name: position}
    
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

    const renderAgents = agents => (agents || []).map(a =>
        a.icon ? `<img class="mdm-agent-icon" src="${a.icon}" alt="${a.name}" title="${a.name}">` : a.name
    ).join("");

    async function openMatchDetail(mid, cardOrObj) {
        currentDetailId = mid;
        
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
        
        const img1 = document.getElementById("mdm-logo1");
        const img2 = document.getElementById("mdm-logo2");
        img1.src = logo1; img1.style.display = logo1 ? "" : "none";
        img2.src = logo2; img2.style.display = logo2 ? "" : "none";

        const scoreEl = document.getElementById("mdm-score");
        if (s1 !== "" && s2 !== "") {
            const n1 = parseInt(s1), n2 = parseInt(s2);
            scoreEl.innerHTML = `<span class="score-num ${n1 > n2 ? 'winner' : ''}">${s1}</span><span class="score-divider">-</span><span class="score-num ${n2 > n1 ? 'winner' : ''}">${s2}</span>`;
        } else {
            scoreEl.textContent = "vs";
        }

        document.getElementById("mdm-maps").innerHTML = "";
        document.getElementById("mdm-stats").innerHTML = "";
        document.getElementById("mdm-map-tabs-container").innerHTML = "";
        document.getElementById("mdm-maps-section").style.display = "none";
        document.getElementById("mdm-stats-section").style.display = "none";
        document.getElementById("mdm-no-stats").style.display = "none";
        detailOverlay.style.display = "flex";
        updateMdmNavButtons();

        // Fetch full data
        try {
            const data = await fetch(`/api/match/${mid}`).then(r => r.json());
            renderMatchDetail(data, s1, s2);
            updateMdmNavButtons();
        } catch(e) {
            document.getElementById("mdm-no-stats").style.display = "";
        }
    }

    function renderMatchDetail(data, fallbackS1, fallbackS2) {
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
                        countdownContainer.className = "countdown-container status-live-container";
                        countdownContainer.innerHTML = `
                            <span class="live-pulse-indicator"></span>
                            <span class="live-countdown-text">In Progress</span>
                        `;
                    } else if (data.status === "Completed") {
                        countdownContainer.className = "countdown-container status-completed-container";
                        countdownContainer.innerHTML = `
                            <span class="completed-text">Final Match</span>
                        `;
                    }
                }
            }
        }

        const maps = data.maps || [];
        const playersByMap = data.players || {};
        const hasStats = maps.length > 0 || Object.keys(playersByMap).length > 0;

        if (!hasStats) { document.getElementById("mdm-no-stats").style.display = ""; return; }

        // Maps row
        if (maps.length) {
            document.getElementById("mdm-maps-section").style.display = "";
            document.getElementById("mdm-maps").innerHTML = maps.map(m => {
                const winCls = m.winner === 0 ? "mdm-map-win" : (m.winner === 1 ? "mdm-map-lose" : "");
                const s1cls = m.winner === 0 ? "mdm-win" : "mdm-lose";
                const s2cls = m.winner === 1 ? "mdm-win" : "mdm-lose";
                return `<div class="mdm-map-card ${winCls}">
                    <div class="mdm-map-name">${m.name}</div>
                    <div class="mdm-map-score"><span class="${s1cls}">${m.score1}</span> – <span class="${s2cls}">${m.score2}</span></div>
                </div>`;
            }).join("");
        }

        // Player stats with map tabs
        const statsEl = document.getElementById("mdm-stats");
        const tabsContainer = document.getElementById("mdm-map-tabs-container");
        const maxAcs = arr => Math.max(...arr.map(p => parseInt(p.acs) || 0));

        const renderTable = (plist, label) => {
            if (!plist?.length) return "";
            const topAcs = maxAcs(plist);
            const rows = plist.map(p => `<tr>
                <td><div class="mdm-player-cell">${p.photo ? `<img class="mdm-player-photo" src="${p.photo}" alt="${p.name}">` : '<div class="mdm-player-photo-placeholder"></div>'}<span>${p.name}</span></div></td>
                <td class="r">${renderAgents(p.agents)}</td>
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
                        <th class="r"><span>Agent</span></th>
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
            tabsContainer.querySelectorAll(".mdm-map-tab").forEach(t => t.classList.toggle("active", t.dataset.key === key));
        };

        const tabs = [{ key: "all", label: "All Maps" }, ...maps.map((m, i) => ({ key: String(i), label: m.name }))];
        const hasTabs = Object.keys(playersByMap).length > 0;

        if (hasTabs) {
            document.getElementById("mdm-stats-section").style.display = "";
            tabsContainer.innerHTML = `<div class="mdm-map-tabs">${tabs.map(t =>
                `<button class="mdm-map-tab" data-key="${t.key}">${t.label}</button>`
            ).join("")}</div>`;
            tabsContainer.querySelectorAll(".mdm-map-tab").forEach(btn => {
                btn.addEventListener("click", () => showMapStats(btn.dataset.key));
            });
            showMapStats(playersByMap["all"] ? "all" : "0");
        }
    }

    // Save tournament settings to backend
    async function saveTournamentSettings() {
        const unchecked = [];
        const checkboxes = document.querySelectorAll(".tourney-checkbox");
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
        if (filterYear && s.filter_year) filterYear.value = s.filter_year;
        if (sortTourneyOrder && s.tourney_sort_order) sortTourneyOrder.value = s.tourney_sort_order;
        if (s.filter_custom_series?.length) { customSeriesFilters = s.filter_custom_series; renderSeriesTags(); }
        if (s.tournament_order) tournamentOrder = s.tournament_order;
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

    // 1. Bangladesh Standard Time (BST) Live Clock (UTC + 6)
    function updateBSTClock() {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const bst = new Date(utc + (3600000 * 6)); // UTC+6
        
        const timeString = bst.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        const dateString = bst.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        
        if (bstClock) {
            bstClock.innerHTML = `<span class="date">${dateString}</span> | <span class="time">${timeString}</span>`;
        }
    }
    setInterval(updateBSTClock, 1000);
    updateBSTClock();

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

    // Status filter buttons
    statusBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            statusBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            activeStatus = btn.getAttribute("data-status");
            sessionStorage.setItem("activeStatus", activeStatus);
            applyFilters();
        });
    });

    // Tournament checklist item change
    tourneyCheckboxes.forEach(cb => {
        cb.addEventListener("change", () => {
            if (cb.checked) {
                checkedTournaments.add(cb.value);
            } else {
                checkedTournaments.delete(cb.value);
            }
            applyFilters();
            saveTournamentSettings();
        });
    });

    // Select all tournaments
    if (selectAllBtn) {
        selectAllBtn.addEventListener("click", () => {
            tourneyCheckboxes.forEach(cb => {
                cb.checked = true;
                checkedTournaments.add(cb.value);
            });
            applyFilters();
            saveTournamentSettings();
        });
    }

    // Deselect all tournaments
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener("click", () => {
            tourneyCheckboxes.forEach(cb => {
                cb.checked = false;
                checkedTournaments.delete(cb.value);
            });
            applyFilters();
            saveTournamentSettings();
        });
    }

    // 5. AJAX Live Sync Data
    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            const icon = refreshBtn.querySelector("i");
            if (icon) icon.classList.add("spinning");
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate spinning"></i> Syncing...`;
            
            try {
                const start = scrapeStart ? (parseInt(scrapeStart.value) || null) : null;
                const end = scrapeEnd ? (parseInt(scrapeEnd.value) || null) : null;
                const url = (start && end) ? `/api/matches?start=${start}&end=${end}` : `/api/matches`;
                const response = await fetch(url);
                if (!response.ok) throw new Error("Sync failed");
                const matches = await response.json();
                
                // Keep the in-memory leaderboard dataset updated
                INITIAL_MATCHES = matches;

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
                refreshBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> SYNC`;
            }
        });
    }

    const scrapeStart = document.getElementById("scrape-start");
    const scrapeEnd = document.getElementById("scrape-end");
    const savePagesBtnEl = document.getElementById("save-pages-btn");
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
                countdownHTML = `
                    <div class="countdown-container status-completed-container">
                        <span class="completed-text">Final Match</span>
                    </div>
                `;
            }
            
            card.innerHTML = `
                <div class="match-card-header">
                    <div class="tournament-info">
                        ${m.tournament_logo ? `<img src="${m.tournament_logo}" class="tournament-logo" onerror="this.src='https://placehold.co/32x32/ff4655/ffffff?text=VLR';">` : '<div class="tournament-logo-placeholder"><i class="fa-solid fa-trophy"></i></div>'}
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
                        <div class="logo-wrapper">
                            ${m.team1_logo ? `<img src="${m.team1_logo}" class="team-logo" alt="${m.team1} logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : '<div class="team-logo" style="display:none;"></div>'}
                            <div class="team-initial" style="display:${m.team1_logo ? 'none' : 'flex'};">${m.team1 ? m.team1[0].toUpperCase() : 'T'}</div>
                        </div>
                        <span class="team-name" title="${m.team1}">${m.team1}</span>
                    </div>

                    <div class="match-vs-score">
                        ${vsScoreHTML}
                    </div>

                    <div class="team-container team-2">
                        <span class="team-name" title="${m.team2}">${m.team2}</span>
                        <div class="logo-wrapper">
                            ${m.team2_logo ? `<img src="${m.team2_logo}" class="team-logo" alt="${m.team2} logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : '<div class="team-logo" style="display:none;"></div>'}
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
            
            const label = document.createElement("label");
            label.className = "tourney-item";
            label.setAttribute("data-tourney-name", name);
            
            label.innerHTML = `
                <input type="checkbox" ${isChecked ? 'checked' : ''} class="tourney-checkbox" value="${name}">
                <span class="custom-checkbox"></span>
                ${logo ? `<img src="${logo}" alt="" class="sidebar-tourney-logo" onerror="this.style.display='none';">` : '<div class="sidebar-tourney-placeholder"><i class="fa-solid fa-trophy"></i></div>'}
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
            });
        });
        
        checkedTournaments = newChecked;
        const countEl = document.getElementById("tourney-count");
        if (countEl) countEl.textContent = `(${sortedTourneys.length})`;
        applyTourneyFilters();
        sortTourneyByDate();
    }

    // Settings modal
    const settingsBtn = document.getElementById("settings-btn");
    const settingsModal = document.getElementById("settings-modal");
    const settingsCloseBtn = document.getElementById("settings-close-btn");

    settingsBtn?.addEventListener("click", () => {
        settingsModal.style.display = "flex";
    });
    settingsCloseBtn?.addEventListener("click", () => {
        settingsModal.style.display = "none";
    });
    settingsModal?.addEventListener("click", (e) => {
        if (e.target === settingsModal) settingsModal.style.display = "none";
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
        container.innerHTML = [...list].reverse().map(t => `
            <div class="ignore-item" data-name="${t.name}">
                ${t.logo ? `<img src="${t.logo}" class="ignore-item-logo" onerror="this.style.display='none';">` : '<div class="ignore-item-logo-placeholder"><i class="fa-solid fa-trophy"></i></div>'}
                <span class="ignore-item-name" title="${t.name}">${t.name}</span>
                <button class="ignore-remove-btn" data-name="${t.name}" title="Remove from ignore list"><i class="fa-solid fa-circle-xmark"></i></button>
            </div>
        `).join("");
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
        const countEl = document.getElementById("tourney-count");
        if (countEl) countEl.textContent = `(${document.querySelectorAll(".tourney-item").length})`;
        const names = targets.map(t => t.name);
        document.querySelectorAll(".match-card").forEach(card => {
            if (names.includes(card.getAttribute("data-tournament"))) card.style.display = "none";
        });
    }

    document.getElementById("mdm-close")?.addEventListener("click", closeMatchDetail);
    detailOverlay?.addEventListener("click", e => { 
        if (e.target === detailOverlay) closeMatchDetail(); 
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
    function calculatePlayerAggregates(matches, selectedTourneys) {
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
                                
                                if (!playersMap[p.name]) {
                                    playersMap[p.name] = {
                                        name: p.name,
                                        photo: p.photo || "",
                                        teamLogo: currentTeamLogo,
                                        teamName: currentTeamName,
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

                                const agg = playersMap[p.name];
                                agg.matchesPlayed++;
                                
                                if (!agg.photo && p.photo) agg.photo = p.photo;
                                if (!agg.teamLogo && currentTeamLogo) {
                                    agg.teamLogo = currentTeamLogo;
                                    agg.teamName = currentTeamName;
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

    function openLeaderboard() {
        try {
            const matches = typeof INITIAL_MATCHES !== "undefined" ? INITIAL_MATCHES : [];
            const selectedTourneys = typeof checkedTournaments !== "undefined" ? checkedTournaments : new Set();
            const aggregates = calculatePlayerAggregates(matches, selectedTourneys);

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

            tbody.innerHTML = aggregates.map(p => `<tr>
                <td><div class="mdm-player-cell">${p.teamLogo ? `<img class="mdm-player-team-logo" src="${p.teamLogo}" alt="" title="${p.teamName || 'Team Logo'}">` : ''}${p.photo ? `<img class="mdm-player-photo" src="${p.photo}" alt="${p.name}">` : '<div class="mdm-player-photo-placeholder"></div>'}<span>${p.name}</span></div></td>
                <td class="r">${renderAgents(p.agents)}</td>
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
            </tr>`).join("");

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

    function populateTeamDropdown(searchKeyword = "") {
        const dropdown = document.getElementById("team-history-custom-dropdown");
        if (!dropdown) return;

        dropdown.innerHTML = "";

        const matches = typeof INITIAL_MATCHES !== "undefined" ? INITIAL_MATCHES : [];
        const teamsMap = new Map();
        matches.forEach(m => {
            if (m.team1 && m.team1 !== "TBD") {
                if (!teamsMap.has(m.team1)) teamsMap.set(m.team1, m.team1_logo || "");
            }
            if (m.team2 && m.team2 !== "TBD") {
                if (!teamsMap.has(m.team2)) teamsMap.set(m.team2, m.team2_logo || "");
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

    function renderTeamHistory(teamName) {
        const resultsContainer = document.getElementById("team-history-results");
        if (!resultsContainer) return;

        if (!teamName) {
            resultsContainer.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-muted); font-size: 14px;">Click the button above to select a team and view match results.</p>';
            return;
        }

        const matches = typeof INITIAL_MATCHES !== "undefined" ? INITIAL_MATCHES : [];
        const teamMatches = matches.filter(m => {
            return (m.team1 === teamName || m.team2 === teamName) && m.status === "Completed";
        });

        if (teamMatches.length === 0) {
            resultsContainer.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-muted); font-size: 14px;">No completed matches found in local database for this team.</p>';
            return;
        }

        resultsContainer.innerHTML = teamMatches.map(m => {
            const isTeam1 = m.team1 === teamName;
            
            // Selected team is always mapped to the left (myTeam), opponent is mapped to the right (oppTeam)
            const myTeam = teamName;
            const oppTeam = isTeam1 ? m.team2 : m.team1;
            
            const myLogo = isTeam1 ? (m.team1_logo || "") : (m.team2_logo || "");
            const oppLogo = isTeam1 ? (m.team2_logo || "") : (m.team1_logo || "");

            const myScore = isTeam1 ? (m.score1 || '0') : (m.score2 || '0');
            const oppScore = isTeam1 ? (m.score2 || '0') : (m.score1 || '0');

            const myScoreNum = parseInt(myScore) || 0;
            const oppScoreNum = parseInt(oppScore) || 0;

            let statusText = "Draw";
            let statusClass = "draw";
            let myColorClass = "thr-neutral";
            let oppColorClass = "thr-neutral";

            if (myScoreNum > oppScoreNum) {
                statusText = "Win";
                statusClass = "win";
                myColorClass = "thr-win-text";
                oppColorClass = "thr-loss-text";
            } else if (oppScoreNum > myScoreNum) {
                statusText = "Loss";
                statusClass = "loss";
                myColorClass = "thr-loss-text";
                oppColorClass = "thr-win-text";
            }

            return `
                <div class="team-history-row" data-id="${m.id}">
                    <div class="thr-tourney">
                        ${m.tournament_logo ? `<img src="${m.tournament_logo}" class="thr-logo" onerror="this.style.display='none';">` : ''}
                        <span class="thr-name" title="${m.tournament}">${m.tournament}</span>
                    </div>
                    <div class="thr-teams">
                        <span class="thr-t1 ${myColorClass}">
                            <span>${myTeam}</span>
                            ${myLogo ? `<img class="thr-team-logo" src="${myLogo}" onerror="this.style.display='none';">` : ''}
                        </span>
                        <span class="thr-score">${myScore} – ${oppScore}</span>
                        <span class="thr-t2 ${oppColorClass}">
                            ${oppLogo ? `<img class="thr-team-logo" src="${oppLogo}" onerror="this.style.display='none';">` : ''}
                            <span>${oppTeam}</span>
                        </span>
                    </div>
                    <span class="thr-status ${statusClass}">${statusText}</span>
                </div>
            `;
        }).join("");

        resultsContainer.querySelectorAll(".team-history-row").forEach(row => {
            row.addEventListener("click", () => {
                const mid = row.getAttribute("data-id");
                const mObj = matches.find(item => item.id === mid);
                if (mid && mObj) {
                    document.getElementById("team-history-modal").style.display = "none";
                    openMatchDetail(mid, mObj);
                }
            });
        });
    }

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

    // Leaderboard table click sorting
    document.getElementById("leaderboard-table")?.addEventListener("click", (e) => {
        const th = e.target.closest("th");
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

            if (index === 9 || index === 11) {
                valA = valA.replace("%", "");
                valB = valB.replace("%", "");
            }

            const isNumeric = index >= 2;
            if (isNumeric) {
                let numA = parseFloat(valA);
                let numB = parseFloat(valB);
                if (isNaN(numA)) numA = dir === "asc" ? Infinity : -Infinity;
                if (isNaN(numB)) numB = dir === "asc" ? Infinity : -Infinity;
                return dir === "asc" ? numA - numB : numB - numA;
            } else {
                return dir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
        });

        rows.forEach(row => tbody.appendChild(row));
    });
});
