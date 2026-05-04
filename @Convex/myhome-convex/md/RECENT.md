# Recent Development Log
All sessions recorded here — no archiving, full history in one place.

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
