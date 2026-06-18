# Problems & Fixes Log

## [2026-06-18 12:10] - Sidebar layout broken after adding custom-series-tags div
**Problem:** Search box and tournament list appeared outside the sidebar panel.
**Root Cause:** A stray `</div>` was inserted after `<div id="custom-series-tags">`, which closed the `<aside>` element prematurely.
**Solution:** Removed the extra `</div>` so all sidebar children remain inside `<aside>`.
**Files Modified:** `templates/index.html`

## [2026-06-18 12:05] - All buttons dead / timers not showing
**Problem:** Entire JS stopped working — no clock, no filters, no buttons.
**Root Cause:** `let customSeriesFilters = []` was declared at line ~91, but `applyFilters()` was called at line ~56. Since `applyFilters` (a hoisted `function`) internally references `customSeriesFilters` (a `let`), accessing it before the declaration is reached throws a TDZ `ReferenceError`, crashing the entire `DOMContentLoaded` handler.
**Solution:** Moved `let customSeriesFilters = []` to the top of the handler alongside `searchQuery` and `checkedTournaments`.
**Files Modified:** `static/js/main.js`

## [2026-06-18 00:03] - Sidebar scrolls with matches
**Problem:** Scrolling the matches panel also scrolled the sidebar.
**Root Cause:** `.main-layout` had no height constraint; `.app-container` used `min-height` instead of `height`.
**Solution:** Set `.app-container` to `height: 100vh`, `.main-layout` to `overflow: hidden; min-height: 0`, sidebar to `height: 100%; overflow-y: auto`.
**Files Modified:** `static/css/style.css`

## [2026-06-18 00:01] - Select All / Clear buttons misaligned
**Problem:** Buttons appeared outside the tournament card boundary.
**Root Cause:** `.tourney-group-header` had no horizontal padding while `.tourney-item` had `padding: 10px`.
**Solution:** Added `padding: 0 10px` to `.tourney-group-header`.
**Files Modified:** `static/css/style.css`

## [2026-06-17 23:54] - Status filter resets to "All" on refresh
**Problem:** Selected filter (Live/Upcoming/Completed) lost on page refresh.
**Root Cause:** `activeStatus` was hardcoded to `"all"` on init with no persistence.
**Solution:** Save to `sessionStorage` on change, restore on load, re-activate matching button.
**Files Modified:** `static/js/main.js`
