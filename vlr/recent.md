# Recent — AI Handoff

## 1. Project DNA (Permanent)
Flask + BeautifulSoup + SQLite (`app.py`, `scraper.py`) with vanilla JS/CSS/Jinja2. Local app scraping VLR.gg Valorant schedules, shown in BST (UTC+6) on port 5025. Design: lightweight listing sync + lazy heavy stats fetch. VLR.gg rate-limits IPs when hammered — all scraping is paced.

## 2. Latest Implementation
- **LOAD MORE TOURNAMENTS (pagination)**: `/events` is paginated (~50/page, 59 pages total). `_fetch_tournaments_page(page)` fetches `/events` (p1) or `/events/?page=N`; `_get_total_pages()` parses pagination. `get_tournaments(refresh=False, pages=N)` now returns a dict `{tournaments, fetched_at, error, total_pages, pages_fetched}` and fetches ONLY the missing pages (page 1 re-fetched only on refresh), merging into `tournaments_cache.json` (`pages`/`total_pages` keys; old-format cache learns total from p1 once). Sequential with 1s pause. Partial failure → returns what it has + error; no-op load-more retry does NOT reset the 24h TTL. `/api/tournaments?pages=N` returns the new fields. UI: "Load more tournaments (page X of Y)" fetches +3 pages (hidden when all loaded; total_pages=1 = unknown → button stays), status shows "X loaded (page A of B)", refresh icon spins; refresh + load-more buttons restyled as accent-red pills.
- **Tournament Browser ROOT CAUSE FOUND & FIXED**: vlr.gg's tournaments listing is at **`/events`, NOT `/tournaments`** (which 404s — that's why the list always failed). `_fetch_tournaments_page()` → `_fetch_with_retry()` (25s timeout, 3 attempts, 2s/4s backoff, Accept/Accept-Language headers, friendly+truncated error detail: HTTP status / timeout / SSL / connection failed).
- `_parse_tournament_items` rewritten for the NEW /events markup: `event-item-title`, `span.event-item-desc-item-status` (capitalized), `div.event-item-desc-item.mod-dates` (label extracted), region from `i.flag.mod-xx` mapped via `FLAG_TO_REGION` (old fallbacks kept). Verified live: 69 tournaments.
- NEW `_parse_event_matches_from_soup` for event pages: only hrefs matching `^/(\d+)/` (excludes /team /player /event links); `bracket-item` shape (scores + `data-utc-ts` unix timestamps) and `wf-module-item` shape (sidebar, eta); TBD normalization; status Live > Completed (any digit score) > Upcoming. `add_tournament` tries match parser then falls back to event parser; `_upsert_matches_to_db` now preserves `unix_timestamp`. Verified live: 18 matches for EMEA Stage 2, re-add idempotent.
- Missing-stats button: one-by-one client loop, 1.5s/match, 8s backoff, stop after 3 consecutive completed failures. Status filter: `#status-filter-select` dropdown.

## 3. Critical Context
- VLR.gg layout: `/events` = tournament listing (event-item-* classes), **paginated `/events/?page=N` (59 pages)**; event pages use `bracket-item` + `wf-module-item` (NOT `a.match-item`); `/matches` + `/matches/results` use `a.match-item`.
- `_parse_matches_from_soup` strips the series prefix → stage names; `add_tournament` overrides to full event name; `_name_matches()` loose matching. Event matches carry real `unix_timestamp` from `data-utc-ts`.
- Real `tournaments_cache.json` already written (69 entries, 24h TTL) — app hits cache immediately.
- Failures counted only for `status === "completed"`. Sort: Live → Upcoming → Completed. Locks: `sync_lock`, `details_lock` (dead code), `tournaments_cache_lock`. Debug auto-reloads Python; Ctrl+F5 for new JS.

## 4. Pending Task
User to Ctrl+F5 and verify: restyled refresh/load-more buttons, "Load more" pulling ~150 more tournaments per click (page 1 cached 69 → click → 219 etc.). Then optionally git commit/push. Next useful step if desired: apply `_fetch_with_retry` to the sync button's result-page fetches.
