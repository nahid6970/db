# Recent — AI Handoff

## 1. Project DNA (Permanent)
Flask + BeautifulSoup + SQLite (`app.py`, `scraper.py`) with vanilla JS/CSS/Jinja2. Local app scraping VLR.gg Valorant schedules, shown in BST (UTC+6) on port 5025. Design: lightweight listing sync + lazy heavy stats fetch. VLR.gg rate-limits IPs when hammered (ConnectTimeoutError) — all scraping is paced.

## 2. Latest Implementation
- Missing-stats button: client-side one-by-one loop only (server bulk trigger removed); 1.5s/match, 8s backoff, stop after 3 consecutive completed-match failures, loaded/failed summary. `load_missing_stats()` sequential; photo workers 5 → 2.
- Tournament Browser (trophy button): `GET /api/tournaments` cached 24h to `tournaments_cache.json`; modal with search / Show-select / Load-more; `POST /api/tournaments/add` un-ignores + un-hides + fetches event matches one at a time (1.2s), then page reload. Parser hardened (3 markup shapes); `get_tournaments` returns an error and the UI shows a red status bar distinguishing rate-limit vs parse-failure. UI polish: dark search box, nowrap Add button, single status bar, `.tbr-*` classes.
- Status filter: All/Live/Upcoming/Completed buttons → single `#status-filter-select` dropdown (change event; restores from sessionStorage `activeStatus`).

## 3. Critical Context
- Failures counted only for `status === "completed"` matches.
- `_parse_matches_from_soup` strips the series prefix → stage names; `add_tournament` overrides to the full event name; `_name_matches()` loose matching.
- Tournament list was empty in user's screenshot — cause unknown yet (rate-limit vs markup); the status bar now reports which.
- Sort: Live → Upcoming → Completed. Locks: `sync_lock` (active), `details_lock` (dead code), `tournaments_cache_lock`. Debug auto-reloads — Ctrl+F5 for new JS.

## 4. Pending Task
User to Ctrl+F5 and open the trophy button: if the list is still empty, report the red status-bar message (rate-limit vs parse) so the parser can be fixed. Also verify the status dropdown and one-by-one stats loading after any ban lifts.
