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
    const filterSeries = document.getElementById("filter-series");
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
    
    // Initialize checked tournaments
    tourneyCheckboxes.forEach(cb => {
        if (cb.checked) checkedTournaments.add(cb.value);
    });

    // Apply initial filters based on saved settings
    applyFilters();

    // Open VLR.gg page on card click
    if (matchesGrid) {
        matchesGrid.addEventListener("click", e => {
            const card = e.target.closest(".match-card");
            if (!card) return;
            const href = card.getAttribute("data-href");
            if (href) window.open("https://www.vlr.gg" + href, "_blank");
        });
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
    const addSeriesBtn = document.getElementById("add-series-filter-btn");

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

    addSeriesBtn?.addEventListener("click", () => {
        const val = prompt("Add text filter (e.g. VALORANT, Champions):");
        if (!val?.trim()) return;
        const tag = val.trim().toUpperCase();
        if (!customSeriesFilters.includes(tag)) {
            customSeriesFilters.push(tag);
            renderSeriesTags(); applyTourneyFilters(); applyFilters(); saveSidebarFilters();
        }
    });

    function applyTourneyFilters() {
        const year = filterYear ? filterYear.value : "all";
        const series = filterSeries ? filterSeries.value : "all";
        document.querySelectorAll(".tourney-item").forEach(item => {
            const name = item.getAttribute("data-tourney-name") || "";
            const nameUpper = name.toUpperCase();
            const yearMatch = year === "all" || name.includes(year);
            const seriesMatch = series === "all" || nameUpper.includes(series.toUpperCase());
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
        cur.filter_series = filterSeries ? filterSeries.value : "all";
        cur.filter_custom_series = customSeriesFilters;
        await fetch("/api/settings", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(cur) });
    }

    // Init filter values from settings
    fetch("/api/settings").then(r => r.json()).then(s => {
        if (filterYear && s.filter_year) filterYear.value = s.filter_year;
        if (filterSeries && s.filter_series) filterSeries.value = s.filter_series;
        if (s.filter_custom_series?.length) { customSeriesFilters = s.filter_custom_series; renderSeriesTags(); }
        applyTourneyFilters();
    });

    filterYear?.addEventListener("change", () => { applyTourneyFilters(); applyFilters(); saveSidebarFilters(); });
    filterSeries?.addEventListener("change", () => { applyTourneyFilters(); applyFilters(); saveSidebarFilters(); });

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
            const seriesVal = filterSeries ? filterSeries.value : "all";
            const seriesMatches = (seriesVal === "all" || tournament.toUpperCase().includes(seriesVal.toUpperCase())) &&
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

        if (perPage === "all") return; // show everything

        const limit = parseInt(perPage);
        visibleCards.forEach((card, i) => {
            card.style.display = i < limit ? "flex" : "none";
        });
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

    const backupBtn = document.getElementById("backup-btn");
    const restoreBtn = document.getElementById("restore-btn");

    if (backupBtn) {
        backupBtn.addEventListener("click", async () => {
            const r = await fetch("/api/backup", { method: "POST" });
            const d = await r.json();
            if (d.status === "success") {
                backupBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
                setTimeout(() => { backupBtn.innerHTML = '<i class="fa-solid fa-download"></i>'; }, 1500);
            } else alert("Backup failed: " + d.message);
        });
    }

    if (restoreBtn) {
        restoreBtn.addEventListener("click", async () => {
            const exists = await fetch("/api/backup/exists").then(r => r.json());
            if (!exists.exists) return alert("No backup found.");
            if (!confirm("Restore matches from backup? Current data will be overwritten.")) return;
            const r = await fetch("/api/restore", { method: "POST" });
            const d = await r.json();
            if (d.status === "success") location.reload();
            else alert("Restore failed: " + d.message);
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
        
        matches.forEach(m => {
            const card = document.createElement("div");
            card.className = "match-card";
            card.setAttribute("data-tournament", m.tournament);
            card.setAttribute("data-status", (m.status || "").toLowerCase());
            card.setAttribute("data-id", m.id);
            card.setAttribute("data-href", m.href);
            card.style.cursor = "pointer";
            
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
    }

    bindIgnoreRemoveBtns();

    // Ignore unchecked button
    const ignoreUncheckedBtn = document.getElementById("btn-ignore-unchecked");
    ignoreUncheckedBtn?.addEventListener("click", async () => {
        const unchecked = [];
        document.querySelectorAll(".tourney-checkbox").forEach(cb => {
            if (!cb.checked) {
                const label = cb.closest(".tourney-item");
                const logo = label?.querySelector(".sidebar-tourney-logo")?.src || "";
                unchecked.push({ name: cb.value, logo });
            }
        });
        if (!unchecked.length) return;
        const res = await fetch("/api/ignorelist/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(unchecked)
        });
        const data = await res.json();
        unchecked.forEach(t => { if (!IGNORE_LIST.find(i => i.name === t.name)) IGNORE_LIST.push(t); });
        renderIgnoreList(data.ignorelist);
        // Remove ignored tournament rows from sidebar
        unchecked.forEach(t => {
            document.querySelector(`.tourney-item[data-tourney-name="${CSS.escape(t.name)}"]`)?.remove();
            checkedTournaments.delete(t.name);
        });
        const countEl = document.getElementById("tourney-count");
        if (countEl) countEl.textContent = `(${document.querySelectorAll(".tourney-item").length})`;
        // Hide matching match cards
        const names = unchecked.map(t => t.name);
        document.querySelectorAll(".match-card").forEach(card => {
            if (names.includes(card.getAttribute("data-tournament"))) {
                card.style.display = "none";
            }
        });
    });
});
