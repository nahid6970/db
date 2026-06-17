# Problems & Fixes Log

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
