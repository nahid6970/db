document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('events-grid');
    const refreshBtn = document.getElementById('btn-refresh');
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    let events = [];
    let activeFilter = 'all';

    async function loadEvents() {
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
        if (activeFilter === 'upcoming') filtered = events.filter(e => e.status === 'Upcoming');
        else if (activeFilter === 'completed') filtered = events.filter(e => e.status === 'Completed');
        else if (activeFilter === 'unseen') filtered = events.filter(e => e.status === 'Completed' && e.seen === 0);

        if (filtered.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No events found.</div>';
            return;
        }

        filtered.forEach(e => {
            const card = document.createElement('div');
            card.className = 'event-card';
            
            const statusClass = e.status === 'Upcoming' ? 'status-upcoming' : 'status-completed';
            
            card.innerHTML = `
                <div class="card-header">
                    ${e.logo_url ? `<img src="${e.logo_url}" class="card-logo" alt="${e.name}">` : `<span style="font-weight:800;">${e.name}</span>`}
                    <span class="card-status ${statusClass}">${e.status}</span>
                </div>
                <div class="card-body">
                    <div class="info-row">
                        <i class="fa-regular fa-calendar info-icon"></i>
                        <div class="info-text">
                            <strong>Date</strong>
                            ${e.date_str}
                        </div>
                    </div>
                    <div class="info-row">
                        <i class="fa-solid fa-location-dot info-icon"></i>
                        <div class="info-text">
                            <strong>Location</strong>
                            ${e.venue}<br>${e.location}
                        </div>
                    </div>
                    ${e.notes ? `
                    <div class="info-row">
                        <i class="fa-solid fa-circle-info info-icon"></i>
                        <div class="info-text" style="font-style: italic;">
                            ${e.notes}
                        </div>
                    </div>
                    ` : ''}
                </div>
                <div class="card-footer">
                    <label class="seen-toggle">
                        <input type="checkbox" class="seen-checkbox" data-id="${e.id}" ${e.seen ? 'checked' : ''}>
                        <div class="seen-box"><i class="fa-solid fa-check"></i></div>
                        <span>Mark as Seen</span>
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
                
                try {
                    await fetch(`/api/events/${id}/toggle`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({seen})
                    });
                    if (activeFilter === 'unseen') render();
                } catch (err) {
                    console.error(err);
                }
            });
        });
    }

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.getAttribute('data-filter');
            render();
        });
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

    loadEvents();
});
