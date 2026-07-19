document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('events-grid');
    const refreshBtn = document.getElementById('btn-refresh');
    const exportBtn = document.getElementById('btn-export');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const staticEvents = Array.isArray(window.STATIC_EVENTS) ? window.STATIC_EVENTS : null;
    const isStatic = staticEvents !== null;
    
    let events = [];
    let activeFilter = localStorage.getItem('wwe_active_filter') || 'all';

    // Set initial active class on filter buttons
    filterBtns.forEach(b => {
        if (b.getAttribute('data-filter') === activeFilter) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });

    async function loadEvents() {
        if (isStatic) {
            events = staticEvents;
            const localSeen = JSON.parse(localStorage.getItem('wwe_seen_events') || '{}');
            const localHidden = JSON.parse(localStorage.getItem('wwe_hidden_events') || '{}');
            events.forEach(e => {
                if (localSeen[e.id] !== undefined) e.seen = localSeen[e.id] ? 1 : 0;
                if (localHidden[e.id] !== undefined) e.hidden = localHidden[e.id] ? 1 : 0;
            });
            render();
            return;
        }

        try {
            const res = await fetch('/api/events');
            events = await res.json();
            render();
        } catch (err) {
            console.error(err);
        }
    }

    function render() {
        grid.innerHTML = '';
        
        let filtered = events;
        if (activeFilter !== 'hidden') {
            filtered = filtered.filter(e => e.hidden !== 1);
        }
        
        if (activeFilter === 'upcoming') filtered = filtered.filter(e => e.status === 'Upcoming');
        else if (activeFilter === 'completed') filtered = filtered.filter(e => e.status === 'Completed');
        else if (activeFilter === 'unseen') filtered = filtered.filter(e => e.status === 'Completed' && e.seen === 0);
        else if (activeFilter === 'hidden') filtered = filtered.filter(e => e.hidden === 1);

        if (filtered.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No events found.</div>';
            return;
        }

        filtered.forEach(e => {
            const card = document.createElement('div');
            card.className = 'event-card';
            
            const statusClass = e.status === 'Upcoming' ? 'status-upcoming' : 'status-completed';
            
            card.innerHTML = `
                <div class="card-poster">
                    ${e.logo_url ? `<img src="${e.logo_url}" alt="${e.name}" referrerpolicy="no-referrer">` : ''}
                    <div class="poster-overlay"></div>
                    <span class="card-status ${statusClass}">${e.status}</span>
                </div>
                <div class="card-header">
                    <h3 class="event-title">${e.name}</h3>
                </div>
                <div class="card-body">
                    <div class="info-row">
                        <i class="fa-regular fa-calendar info-icon"></i>
                        <div class="info-text">
                            <strong>Date</strong>
                            ${e.date_str}
                        </div>
                    </div>
                    ${e.venue ? `
                    <div class="info-row">
                        <i class="fa-solid fa-building info-icon"></i>
                        <div class="info-text">
                            <strong>Venue</strong>
                            ${e.venue}
                        </div>
                    </div>
                    ` : ''}
                </div>
                <div class="card-footer" style="justify-content: space-between;">
                    <label class="seen-toggle">
                        <input type="checkbox" class="seen-checkbox" data-id="${e.id}" ${e.seen ? 'checked' : ''}>
                        <div class="seen-box"><i class="fa-solid fa-check"></i></div>
                        <span>Mark as Seen</span>
                    </label>
                    <label class="seen-toggle hidden-toggle">
                        <input type="checkbox" class="hidden-checkbox" data-id="${e.id}" ${e.hidden ? 'checked' : ''}>
                        <div class="seen-box"><i class="fa-solid fa-eye-slash"></i></div>
                        <span>Hidden</span>
                    </label>
                </div>
            `;
            
            grid.appendChild(card);
        });

        document.querySelectorAll('.seen-checkbox').forEach(cb => {
            cb.addEventListener('change', async (ev) => {
                const id = ev.target.getAttribute('data-id');
                const seen = ev.target.checked;
                const evObj = events.find(x => x.id === id);
                if (evObj) evObj.seen = seen ? 1 : 0;
                
                if (isStatic) {
                    const localSeen = JSON.parse(localStorage.getItem('wwe_seen_events') || '{}');
                    localSeen[id] = seen;
                    localStorage.setItem('wwe_seen_events', JSON.stringify(localSeen));
                } else {
                    try {
                        await fetch(`/api/events/${id}/toggle`, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({seen})
                        });
                    } catch (err) {
                        console.error(err);
                    }
                }
                if (activeFilter === 'unseen') render();
            });
        });

        document.querySelectorAll('.hidden-checkbox').forEach(cb => {
            cb.addEventListener('change', async (ev) => {
                const id = ev.target.getAttribute('data-id');
                const hidden = ev.target.checked;
                const evObj = events.find(x => x.id === id);
                if (evObj) evObj.hidden = hidden ? 1 : 0;
                
                if (isStatic) {
                    const localHidden = JSON.parse(localStorage.getItem('wwe_hidden_events') || '{}');
                    localHidden[id] = hidden;
                    localStorage.setItem('wwe_hidden_events', JSON.stringify(localHidden));
                } else {
                    try {
                        await fetch(`/api/events/${id}/toggle_hidden`, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({hidden})
                        });
                    } catch (err) {
                        console.error(err);
                    }
                }
                render();
            });
        });
    }

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.getAttribute('data-filter');
            localStorage.setItem('wwe_active_filter', activeFilter);
            render();
        });
    });

    exportBtn.addEventListener('click', () => {
        if (!isStatic) {
            exportBtn.disabled = true;
            exportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Exporting...';
            fetch('/api/export-static', {method: 'POST'})
                .then(res => {
                    if (!res.ok) throw new Error('Static export failed');
                    exportBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved to project';
                    setTimeout(() => {
                        exportBtn.disabled = false;
                        exportBtn.innerHTML = '<i class="fa-solid fa-file-export"></i> Export Static';
                    }, 1800);
                })
                .catch(err => {
                    console.error(err);
                    exportBtn.disabled = false;
                    exportBtn.innerHTML = '<i class="fa-solid fa-file-export"></i> Export Static';
                });
            return;
        }

        const snapshot = JSON.stringify(events)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026');
        const html = document.documentElement.outerHTML.replace(
            '<script src="./static/js/main.js"></script>',
            `<script>window.STATIC_EVENTS = ${snapshot};</script>\n    <script src="./static/js/main.js"></script>`
        );
        const blob = new Blob([`<!DOCTYPE html>\n${html}`], {type: 'text/html'});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'index.html';
        link.click();
        URL.revokeObjectURL(link.href);
    });

    refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing...';
        try {
            await fetch('/api/scrape', {method: 'POST'});
            await loadEvents();
        } catch (err) {
            console.error(err);
        }
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Sync Data';
    });

    if (isStatic) {
        refreshBtn.disabled = true;
        refreshBtn.title = 'Sync is available when running Flask';
        refreshBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Static Snapshot';
    }

    loadEvents();
});
