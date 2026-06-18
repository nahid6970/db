# Recent Development Log

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
