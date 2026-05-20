# Recent Development Log
All sessions recorded here — no archiving, full history in one place.

---

## [2026-05-20] - Top Bar Notification Badges & Cyberpunk Popup Styling

**What We Accomplished:**

**Top Bar Notification Badges:**
- Implemented notification badge system for sidebar (topbar) buttons — ported from old Flask project
- Schema already had `has_notification`, `notification_api`, `mark_seen_api` fields — wired up the UI
- Added "Has Notification Badge" checkbox + two API endpoint inputs to both Add and Edit sidebar button popups
- Badge renders as red pill (top-right of button), hidden when count is 0
- Click handler: if count > 0, confirms then POSTs to `mark_seen_api` before opening URL; if 0, opens URL directly
- `initNotificationBadges()` called after load — fetches counts for all notification buttons on page load
- Added CORS header (`Access-Control-Allow-Origin: *`) to `5011_tv_show/app.py` and `5013_movie_tracker/app.py`
- Added `/api/unseen_count` and `/api/mark_all_seen` routes to `5013_movie_tracker/app.py` (didn't exist before)

**Topbar UI Improvements:**
- Grouped version badge (`v2`) and settings button (⚙️) into a separate left section with a right border separator
- Stacked them vertically (v2 on top, ⚙️ below) to match topbar button height

**Cyberpunk Popup Styling:**
- Applied cyberpunk dark theme to all popups: add/edit link, add/edit sidebar button, edit group, quick-add, reminder
- Black background (`#0a0a0f`), neon green borders/focus glow, red close button, transparent submit with green border
- Custom checkbox/radio styling with neon green fill
- `.add-url-btn` and `.preview-note-button` styled to match

**Files Modified:**
- `style.css` - notification badge CSS, cyberpunk popup styles
- `index.html` - notification fields in add/edit sidebar popups, topbar version+settings grouping
- `sidebar-handler.js` - badge rendering, click handler, `updateButtonNotifications`, `initNotificationBadges`, checkbox toggle wiring, form save/load
- `C:\@delta\ms1\@Flask\5011_tv_show\app.py` - CORS header
- `C:\@delta\ms1\@Flask\5013_movie_tracker\app.py` - CORS header + notification API routes

---

## [2026-05-19] - YouTube Notification Bug Fixes & Optimizations

**What We Accomplished:**

**Root Cause Investigation:**
- Confirmed `window.api` was `undefined` at check time (app.js fails to load via `file://` due to CORS on ES modules) — silently blocked all YouTube checks
- Confirmed YouTube RSS feed (`/feeds/videos.xml`) returns 404 for all channels — YouTube has shut it down
- Confirmed 40 channels had `youtube_channel_id` stored correctly but checks never ran

**Fixes:**
- Added `window.convexAction` helper to `links-handler.js` (same string-path pattern as `convexMutation`) — no longer depends on `window.api`
- Removed broken `convexAction` stub that silently returned `undefined`
- Removed `window.api` from the YouTube check guard condition
- Added `window.convexAction` to `app.js` as well for when it loads successfully
- Replaced dead RSS feed with **channel page scraping** — fetches `youtube.com/channel/{id}/videos` and extracts video IDs from embedded JSON using regex
- Fixed empty `youtube_last_video_id` (`""`) being treated as a valid baseline — now treated as "no baseline yet", sets baseline without counting old videos as new
- Fixed check running only once per page load — now runs every **30 minutes** via `setInterval` (first run 3s after load)
- Fixed unconditional `loadLinks()` after check — now only reloads when mutations were actually made
- Fixed local `links` array not being updated after mutation — prevented re-counting on next interval check

**Optimizations:**
- **Parallel fetching** — 5 channels checked simultaneously (batched) instead of sequential awaits
- **Deduplication** — channels sharing the same `channelId + lastVideoId` make only one HTTP request

**Files Modified:**
- `convex/actions.ts` - replaced RSS with channel page scraping
- `links-handler.js` - added `convexAction` helper, fixed check trigger, parallel+dedup logic, baseline handling
- `app.js` - added `window.convexAction` helper

---

## [2026-05-18] - YouTube Update Notifications

**What We Accomplished:**
- Implemented automatic YouTube channel update tracking
- **Backend (Convex):**
    - Updated schema with `youtube_channel_id`, `youtube_last_video_id`, and `youtube_new_video_count`
    - Added `checkYouTubeUpdates` action to fetch channel RSS feeds and count new videos
    - Added `updateYouTubeStatus` mutation to reset counts when channels are visited
- **Frontend:**
    - Modified `links-handler.js` to extract `channelId` during link creation/update
    - Implemented background update check on page load (3s delay)
    - Added bottom-left notification badge showing new video count
    - Implemented auto-reset of video count when clicking a channel link
    - Added per-item YouTube Tracking chip toggle in the edit link form
    - Added matching YouTube Tracking toggle to the add link form
    - Added baseline initialization so enabling tracking does not count old uploads as new
    - Improved channel ID extraction for more YouTube URL/page formats
- **UI/UX:**
    - Styled red notification badges at bottom-left corner of items
    - Added small yellow dot state when tracking is enabled but there are no unseen uploads
    - Fixed oversized edit-link popup width and compact row sizing issues

**Files Modified:**
- `convex/schema.ts` - added YouTube tracking fields
- `convex/functions.ts` - added update/reset mutations
- `convex/actions.ts` - added RSS check action and channelId extraction
- `links-handler.js` - added background checking and badge rendering logic
- `style.css` - added `.link-badge-count` and `.youtube-badge` styles
- `md/FEATURES.md`, `README.md`, `md/UI_UX.md` - documentation updates

---

## [2026-05-15 22:00] - Open in Same Tab, Local File Fix, Version Label

**What We Accomplished:**
- Added "Open links in same tab" toggle to Settings panel (persists in `localStorage` under `myhome-settings.openSameTab`)
- Fixed: links were ignoring `a.target` because `a.onclick` calls `handleUrlOpening()` with hardcoded `window.open(..., '_blank')` — fixed `handleUrlOpening` to read the setting
- Removed chrome-extension-based local file opening (`openLocalFileViaExtension`) from call sites — replaced with: copy URL to clipboard + open `about:blank` new tab (user presses Ctrl+V to navigate)
- Added static version label `<div id="version-badge">v1</div>` in topbar before ⚙️ button — change text before each push to verify GitHub Pages has updated
- Added `set_version.py` — PyQt6 GUI script to change the version label without opening a text editor
- Added `align-items: center` to `.topbar` CSS so version badge aligns with buttons

**Files Modified:**
- `index.html` - "Open links in same tab" checkbox in settings, version badge in topbar
- `links-handler.js` - `handleUrlOpening` respects `openSameTab` setting; local file handling uses copy+open-blank
- `sidebar-handler.js` - local file handling uses copy+open-blank
- `app.js` - added `window.APP_VERSION` constant (unused now, kept for reference)
- `style.css` - `align-items: center` on `.topbar`
- `set_version.py` - new PyQt6 GUI to update version label

*Next session: Continue feature development*

---

## [2026-05-05 01:20] - Custom Password Modal & Various Fixes

**What We Accomplished:**
- Replaced all `prompt()` password dialogs with a custom modal using `<input type="password">` (characters hidden as dots)
- Modal has red border, Cancel/OK buttons, Enter/Escape key support
- Master password now only required when password protect checkbox or password value actually changes (not on every group save)
- Added ⚙️ settings button to topbar (no background, left side) opening a centered panel with red border
- Settings panel: "Hide group names" toggle (persists in localStorage via `body.hide-group-names` CSS class)
- Added section labels to group edit form color rows: "Button Colors", "Button Size & Font", "Popup Colors", "Group Colors"
- Auto Fit toggle for link items (shrinks item box to content size)

**Files Modified:**
- `index.html` - custom password modal, settings button/panel, section labels, auto-fit chip
- `links-handler.js` - async prompt replacements, master password change detection, auto-fit apply
- `style.css` - `body.hide-group-names .link-group > h3 { display:none }`
- `convex/schema.ts`, `convex/functions.ts` - `li_auto_fit` field

*Next session: Continue feature development*

---

## [2026-05-04 15:40] - Auto Fit Toggle for Link Items

**What We Accomplished:**
- Added "Auto Fit" chip toggle in Edit Link form (beside Start on New Line)
- When enabled: removes default `min-width/min-height/padding` from item `li`, sets `width/height: fit-content` so item shrinks to wrap its content exactly
- Added `li_auto_fit: v.optional(v.boolean())` to schema and functions

**Files Modified:**
- `index.html` - Auto Fit option-chip in edit-link form
- `links-handler.js` - load/save/apply li_auto_fit
- `convex/schema.ts`, `convex/functions.ts` - li_auto_fit field

*Next session: Continue feature development*

---

## [2026-05-04 15:10] - Group Password System & UI Overhaul

**What We Accomplished:**
- Redesigned group edit form UI to match link edit form (type-chip, option-chip, SVG icons, compact-size-row color fields)
- Added per-group configurable password (`group_password` field in schema/functions)
- Added master password `182358` that unlocks any group and is required to save group settings or uncheck password protection
- Replaced all `alert()` wrong-password dialogs with `showNotification` toast (no more blocking popups)
- Password input uses `type="password"` (hidden characters)
- Unchecking "Password" chip requires master password — reverts if wrong

**Files Modified:**
- `index.html` - Group edit form redesign, password chip toggle with master password guard
- `links-handler.js` - Master password check on group save, unlock checks accept master password, alert → showNotification
- `convex/schema.ts` - Added `group_password: v.optional(v.string())`
- `convex/functions.ts` - Added `group_password` to updateLink args

*Next session: Continue feature development*

---

## [2026-05-04 14:30] - Format Painter Feature

**What We Accomplished:**
- Added 📋 (copy format) and 🎨 (paste format) buttons to Edit Link popup header
- Captures style fields: color, background-color, li-bg-color, li-hover-color, li-border-color, li-border-radius, border-radius, font-family, font-size, width, height, li-width, li-height
- Removed format painter buttons from all non-link popups (groups, sidebar, quick-add)
- Fixed: moved format painter out of app.js module into a plain `<script>` tag in index.html so it works regardless of Convex module load status

**Files Modified:**
- `index.html` - Added 📋/🎨 buttons to edit-link popup header; added inline format painter script before `</body>`
- `app.js` - Removed format painter code (moved to index.html)
- `style.css` - Added `#format-capture-btn` styles

**Known Issues:**
- None

*Next session: Continue feature development*

---

## [2026-02-25] - Group Styling and Border Resolution

**What We Accomplished:**
- Fixed border visibility for Normal and Box groups (standardized to `2px solid`)
- Removed hardcoded blue fallback from CSS
- Unified styling logic: all group types check both Top and Horizontal color fields
- Global corner radius: Popup Radius now applies to Group Tile corners on dashboard
- Fixed group conversion reference error (Normal ↔ Box ↔ Top)

**Files Modified:**
- `links-handler.js` - Rendering and form logic
- `style.css` - Standardized border rules
- `index.html` - UI labels and cache-busting version string

---

## [2026-02-22] - Chrome Extension, Separator Feature, UI/UX

**What We Accomplished:**
- Fixed Chrome extension 404 error (corrected Convex HTTP API endpoint format)
- Removed default "Inbox" group from extension
- Added visual separators between groups (right-click → Add Separator)
- Added Start on New Line toggle for items and groups
- Fixed context menu positioning (clientX/clientY + viewport boundary detection)
- Fixed image width/height (style.width instead of img.width attribute)
- Quick Add Link: URL auto-focus + remembers last group
- YouTube channel icon detection via oEmbed API

**Files Modified:**
- `chrome-extension/background.js`, `chrome-extension/popup.js`
- `convex/schema.ts` - Added `is_separator`, `start_new_line`, `group_start_new_line`
- `convex/functions.ts` - Updated mutations
- `links-handler.js` - Rendering logic
- `style.css` - Separator styles
- `index.html` - Edit popup checkboxes
- `context-menu.js` - Positioning fix
- `convex/actions.ts` - YouTube oEmbed

---

## [2026-02-21] - Group Order Persistence Fix

**What We Accomplished:**
- Fixed group order not persisting after drag-and-drop
- Unified rendering: `sortedGroupNames` used for all group types (not just Top)
- Stable sorting: secondary alphabetical sort when order values are equal
- Robust group detection: uses `dataset.groupName` regardless of CSS class/nesting
- Increased save delay from 100ms to 300ms

**Files Modified:**
- `links-handler.js` - `renderLinks`, `saveGroupOrder`, `handleGroupDrop`

---

## [2026-02-21] - Phase 2 Advanced Features Complete

**What We Accomplished:**
- Color preview system (live preview as you type, contrast-based text color)
- Advanced SVG styling (proper sizing, color inheritance)
- Dynamic URL field management (add/remove multiple URLs)
- Collapsible form sections using `<details>` tags
- Group Picker Dropdown (▼ button on group inputs)
- Start on New Line for items and groups (separate `group_start_new_line` field)
- Visual separators between groups
- Popup live refresh (updates instantly on edit)
- Loading states, smooth animations, fade-in effects

**Files Modified:**
- `links-handler.js`, `sidebar-handler.js`, `style.css`, `index.html`
- `convex/schema.ts`, `convex/functions.ts`

---

## [2026-02-20] - Box Group Feature

**What We Accomplished:**
- Added Box Group type: compact button inline with other groups, opens popup on click
- Uses `box_group` checkbox in group settings
- Styling via Horizontal Stack Colors section
- Password protection support

**Files Modified:**
- `index.html` - Added Box Group checkbox
- `style.css` - Box group styles
- `links-handler.js` - Box group rendering and click handler

---

## [2026-02-19] - Initial Setup & Core Features

**What We Accomplished:**
- Project initialized with Convex backend
- All core features implemented: Link CRUD, Sidebar CRUD, grouping, drag-and-drop
- Top Group (collapsible) with popup behavior
- Password protection (password: 1823)
- Multiple URLs per link, display types (text, NerdFont, image, SVG)
- Chrome extension for adding links via right-click
- Fixed Convex client initialization issues

**Files Modified:**
- All files (initial creation)

*Next session: Format painter, additional features*
