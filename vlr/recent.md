# Recent — AI Handoff

## 1. Project DNA (Permanent)
Flask + BeautifulSoup + SQLite (`app.py`, `scraper.py`) with vanilla JS/CSS/Jinja2. Local app scraping VLR.gg Valorant schedules, shown in BST (UTC+6) on port 5025. Design: lightweight listing sync + lazy heavy stats fetch. VLR.gg rate-limits IPs when hammered (ConnectTimeoutError) — all scraping is paced.

## 2. Latest Implementation
- `#btn-load-missing-stats`: now only runs the client-side one-by-one loop (removed server-side 5-parallel bulk trigger that caused vlr.gg bans). 1.5s/match, 8s backoff on failure, auto-stop after 3 consecutive completed-match failures, honest loaded/failed summary.
- `scraper.load_missing_stats()`: sequential with delays + early stop. Player-photo workers 5 → 2.
- NEW Tournament Browser (trophy button in header): `GET /api/tournaments` (cached 24h to `tournaments_cache.json`), modal with search / Show-select / Load-more; `POST /api/tournaments/add` un-ignores + un-hides + fetches event-page matches one at a time (1.2s pacing), then page reload.

## 3. Critical Context
- Failures counted only for `status === "completed"` matches (live/in-progress must not abort runs).
- `_parse_matches_from_soup` strips the series prefix → stage names; `add_tournament` overrides matches to the full event name so sidebar/badges agree; `_name_matches()` does loose name matching.
- One click listener on the missing-stats button; `load_missing=true` API path still exists (gentle). Sort: Live → Upcoming → Completed. Locks: `sync_lock` (active), `details_lock` (dead code), `tournaments_cache_lock`. Debug auto-reloads — hard-refresh (Ctrl+F5) for new JS. Tournament parsing is resilient (live markup unverified from sandbox).

## 4. Pending Task
After any ban lifts, click the trophy button: confirm the list loads once, add a tournament, and verify its matches appear in the sidebar under the full event name.
