# Recent — AI Handoff

## 1. Project DNA (Permanent)
Flask + BeautifulSoup + SQLite (`app.py`, `scraper.py`) with vanilla JS/CSS/Jinja2. Local app scraping VLR.gg Valorant schedules, shown in BST (UTC+6) on port 5025. Design: lightweight listing sync + lazy heavy stats fetch.

## 2. Latest Implementation
- `static/js/main.js`: `#btn-load-missing-stats` now only runs the client-side one-by-one loop; removed the server-side bulk trigger (`/api/matches?...load_missing=true` → 5-parallel `load_missing_stats()`), the cause of the temporary vlr.gg IP ban. Loop now waits 1.5s/match (was 450ms), backs off 8s after failure, auto-stops after 3 consecutive failures with a "Rate-limited" notice, and reports loaded vs failed.
- `scraper.py`: `load_missing_stats()` rewritten sequential with 1.5s delay + stop after 3 consecutive failures (was ThreadPoolExecutor(5)). Player-photo workers in `fetch_match_detail_page` 5 → 2.

## 3. Critical Context
- vlr.gg blocks IPs (ConnectTimeoutError) when hammered. Missing-stats was ~92 detail pages + ~10 player pages each ≈ 1000 requests → ban; sync button is light (list pages only, ~11–50 reqs) → never banned.
- Failures only counted for `status === "completed"` matches; live/in-progress matches returning no maps must not abort the run.
- One click listener remains on the button; `load_missing=true` API path still exists but is now gentle.
- Sort: Live → Upcoming → Completed. Locks: `sync_lock` (active), `details_lock` (dead code only). Debug auto-reloads — hard-refresh (Ctrl+F5) for new JS.

## 4. Pending Task
After the ban lifts, click `#btn-load-missing-stats` to verify one-by-one loading with no timeout flood. Optionally add 1–2s pacing to `fetch_and_update_matches`'s result-page loop for huge page ranges.
