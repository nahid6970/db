# Recent Development Log

## [2026-06-18 21:00] - Player Photos + UI Polish

**What We Accomplished:**
- **Player photos** in match detail modal — 28px circle before player name
  - Fetched from `/player/<id>` profile pages during `fetch_match_detail_page`
  - Fetched in parallel (max 5 workers) for unique players across all map tabs
  - Cached locally in `images_cache/` like team logos
  - Grey circle placeholder if no photo available
  - Re-fetch triggered if any player missing photo (lazy on click + background sync)
- **Square UI** — removed `border-radius` from match cards, modal, scoreline block, map cards
- **Modal header removed** — `.mdm-top-row` hidden; `×` close button now floats `position:absolute` top-right
- **Light theme ACS color** — top scorer changed from yellow `#fbbf24` to dark amber `#b45309`

**Files Modified:**
- `scraper.py`
- `app.py`
- `static/js/main.js`
- `static/css/style.css`

---

## [2026-06-18 20:37] - Pagination + Performance

**What We Accomplished:**
- **Server-side pagination** — `/?page=N` with Prev/Next bar at bottom of matches grid
- **Server-side tournament filtering** — `unchecked_tournaments` applied before paginating so page count is correct for selected tournaments
- Sidebar tournament list built from all non-ignored matches (pre-unchecked-filter) so unchecked items still appear
- Checking/unchecking a tournament saves settings + `window.location.href = "/"` (full reload to page 1)
- Light theme top-ACS color changed from yellow `#fbbf24` to dark amber `#b45309`
- Created `md/PAGINATION_IMPROVEMENT.md` — future client-side pagination spec (no-reload approach)

**Files Modified:**
- `app.py`
- `static/js/main.js`
- `static/css/style.css`
- `md/AI_CONTEXT.md`
- `md/RECENT.md`
- `md/PAGINATION_IMPROVEMENT.md` (new)

---

## [2026-06-18 19:51] - Match Detail Modal + Tournament UX

**What We Accomplished:**
- **Match detail modal** — clicking a card now opens in-app modal instead of VLR.gg tab
  - Scoreline with team logos, map-by-map breakdown (green/red borders), player stats tables
  - Map tabs: "All Maps" (default) + per-map; clicking switches stats
  - Multiple agents per player shown as icons in "All Maps" tab
  - Top ACS highlighted gold; "VLR.gg ↗" button on same row as map tabs
  - Close via ×, outside click, or Escape
- **Scraper extended** — `fetch_match_detail_page` now parses `vm-stats-game` divs:
  - Maps: name, scores, winner
  - Players: per-map + combined "all" stats — ACS, K/D/A, KAST, ADR, HS%, agent icons
  - Stores as `players: {"all": {...}, "0": {...}, "1": {...}}`
- **Lazy fetch** — `/api/match/<id>` re-fetches detail page if stats missing or old format
- **Old format migration** — detects old `{team1, team2}` player format and re-fetches automatically
- **Ignore Checked button** — added beside Ignore Unchecked; both operate on visible items only
- **Tournament sort dropdown** — beside crosshairs icon: Pin order / Date ↑ / Date ↓
  - Sorts by earliest match timestamp (`TOURNEY_FIRST_MATCH` from app.py)
  - Pinned items always first; saved as `tourney_sort_order` in `settings.json`
- **MATCH_DETAIL_FEATURE.md** — created spec + mockup HTML (`match_detail_mockup.html`)

**Bugs Fixed:**
- `game_id == "all"` check was after `if not header: continue` — all-maps div has no header, so it was skipped; moved check before the guard
- Map tabs wiped by `showMapStats` because tabs and stats shared `#mdm-stats` — split into `#mdm-map-tabs-container` + `#mdm-stats`
- Old-format `players` not re-fetched — added `missing_all` detection in both endpoint and background thread

**Files Modified:**
- `scraper.py`
- `app.py`
- `static/js/main.js`
- `static/css/style.css`
- `templates/index.html`
- `md/AI_CONTEXT.md`
- `md/RECENT.md`
- `md/MATCH_DETAIL_FEATURE.md` (new)
- `md/match_detail_mockup.html` (new)

---

## [2026-06-18 12:45] - Tournament Pin Order

**What We Accomplished:**
- Right-click any tournament item → context menu with number input to set sort position
- `setPinOrder(name, pos)` removes old position first (closes gap), then shifts ≥ newPos up, inserts at newPos — no gaps on reorder
- Pinned order saved to `settings.json` as `tournament_order: {name: pos}`
- Pin badge `#N` shown on pinned items in sidebar (server-rendered + dynamic)
- `×` button removes pin; Enter key confirms
- Context menu closes on outside click or Escape
- Removed number input spinner arrows via CSS

**Files Modified:**
- `static/js/main.js`
- `static/css/style.css`
- `templates/index.html`
- `app.py`

---

## [2026-06-18 12:30] - Series Filter Refinement

**What We Accomplished:**
- Replaced series dropdown with plain text input (`filter-series-input`) — filters live on `input` event, not persisted to settings
- Removed `+` button from sidebar series filter group
- `filter_series` no longer saved/restored from `settings.json`
- Added `.custom-series-tags:empty { display: none }` to remove blank space when no tags exist

**Files Modified:**
- `templates/index.html`
- `static/js/main.js`
- `static/css/style.css`

---

## [2026-06-18 12:00] - Feature & Bugfix Session

**What We Accomplished:**
- Added ignore list count badge: `Ignore List (N)` in settings modal heading
- Ignore list entries now render most-recent-first (`|reverse` in Jinja + `[...list].reverse()` in JS)
- `renderIgnoreList()` updates the count badge dynamically on add/remove
- Added `+` button beside the series dropdown in sidebar to add custom text filter tags
- Custom tags render as removable chips, apply OR-logic filter to sidebar tournament list and match cards
- Custom tags persisted in `settings.json` as `filter_custom_series`
- Added year dropdown + search input inside settings modal ignore list section for client-side filtering
- Added `.gitignore` entries: `*.tmp`, `matches.backup.json`, `*.log`
- Removed `ignorelist.json.tmp` from tracked files

**Bugs Fixed:**
- TDZ crash: `customSeriesFilters` (let) was declared after `applyFilters()` was called on init — moved to top-level declarations with `searchQuery` and `checkedTournaments`
- Layout break: stray `</div>` after `custom-series-tags` div was closing `<aside>` early, pushing search box and tournament list outside sidebar

**Files Modified:**
- `static/js/main.js`
- `static/css/style.css`
- `templates/index.html`
- `.gitignore`

---

## [2026-06-18 00:00] - UI Polish & Feature Session

**What We Accomplished:**
- Removed seconds from countdown timer display (`1d 19h 12m` format)
- Removed seconds from BST clock display (`Wed, Jun 18 | 11:49 PM` format)
- Scroll position preserved on Sync button click and page refresh (sessionStorage)
- Active status filter (All/Live/Upcoming/Completed) persists across page refresh (sessionStorage)
- Clicking a match card opens its VLR.gg page in a new tab (uses `data-href`)
- Restyled "Select All" / "Clear" buttons as subtle pill buttons; renamed "Select All" → "All"
- Fixed All/Clear button alignment with tournament cards (padding fix)
- Fixed sidebar scrolling with matches (layout height constraint)
- Added light/dark theme toggle button (moon/sun icon) next to clock, persisted in localStorage
- Fixed clock pushed far right — grouped clock + toggle in `.header-right`
- Fixed light mode: active status button now solid red/white; countdown uses blue; winner score uses green

**Files Modified:**
- `static/js/main.js`
- `static/css/style.css`
- `templates/index.html`
