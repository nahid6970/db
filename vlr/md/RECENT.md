# Recent Development Log

## [2026-06-18 00:00] - UI Polish & Feature Session

**What We Accomplished:**
- 23:48 — Removed seconds from countdown timer display (`1d 19h 12m` format)
- 23:49 — Removed seconds from BST clock display (`Wed, Jun 18 | 11:49 PM` format)
- 23:51 — Scroll position preserved on Sync button click and page refresh (sessionStorage)
- 23:54 — Active status filter (All/Live/Upcoming/Completed) persists across page refresh (sessionStorage)
- 23:57 — Clicking a match card opens its VLR.gg page in a new tab (uses `data-href`)
- 23:59 — Restyled "Select All" / "Clear" buttons as subtle pill buttons; renamed "Select All" → "All"
- 00:01 — Fixed All/Clear button alignment with tournament cards (padding fix)
- 00:03 — Fixed sidebar scrolling with matches (layout height constraint)
- 00:06 — Added light/dark theme toggle button (moon/sun icon) next to clock, persisted in localStorage
- 00:09 — Fixed clock pushed far right — grouped clock + toggle in `.header-right`
- 00:11 — Fixed light mode: active status button now solid red/white; countdown uses blue (#2563eb); winner score uses forest green (#16a34a)

**Files Modified:**
- `static/js/main.js`
- `static/css/style.css`
- `templates/index.html`

**Known Issues:**
- None currently

*Next session: Further light theme refinements if needed; consider adding match detail tooltip or expand on click.*
