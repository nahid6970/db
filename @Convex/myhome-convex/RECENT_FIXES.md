# Recent Fixes and Improvements

## Session: 2026-02-25 (Latest)

### Group Styling and Border Resolution
- **Fixed Border Visibility**: Resolved issues where border colors were not appearing for "Normal" and "Box" groups.
  - Standardized all group borders to `2px solid`.
  - Removed hardcoded blue fallback from CSS to allow custom color overrides.
  - Implemented direct property application (`style.borderColor`) to ensure settings reflect immediately.
- **Unified Styling Logic**: All group types now check both "Top" and "Horizontal" color fields.
  - Prevents losing color settings when switching group types.
  - Priorities: Primary field for group type first, then secondary field as fallback.
- **Global Corner Radius**: The "Popup Radius" setting now applies to the **Group Tile** corners on the dashboard as well.
  - Works for all types (Normal, Top, Box).
  - Provides a more consistent and adjustable UI.
- **Fixed Group Conversion**: Resolved a reference error that was preventing groups from being converted between types (Normal ↔ Box ↔ Top).
- **Files Modified**: 
  - `links-handler.js` - Rendering and form logic
  - `style.css` - Standardized border rules
  - `index.html` - UI labels and cache-busting version string

---

## Session: 2026-02-22

### Chrome Extension Fixes
- **Fixed 404 Error**: Corrected Convex HTTP API endpoint format
  - Changed from `/api/mutation/functions:addLink` to `/api/mutation` with `path` in body
  - Updated both `background.js` and `popup.js`
- **Removed Default Group**: Extension no longer sets "Inbox" as default group
- **Files Modified**: `chrome-extension/background.js`, `chrome-extension/popup.js`

### Separator Feature
- **Visual Separators**: Added horizontal line separators between groups
  - Right-click group → "Add Separator"
  - Hover to show delete button (×)
  - Gradient cyan line with subtle opacity
- **Start on New Line Toggle**: Added checkbox in edit popups
  - Works for individual items ✅
  - Known issue with groups (applies to all items inside) ⚠️
- **Files Modified**: 
  - `convex/schema.ts` - Added `is_separator` and `start_new_line` fields
  - `convex/functions.ts` - Updated mutations
  - `links-handler.js` - Rendering logic
  - `style.css` - Separator styles
  - `index.html` - Edit popup checkboxes

### UI/UX Improvements
- **Context Menu Positioning**: Fixed menu appearing far from cursor
  - Changed from `pageX/pageY` to `clientX/clientY`
  - Added viewport boundary detection
  - Menu now stays within screen bounds
- **Image Width/Height Fix**: Images now display correctly with custom dimensions
  - Changed from `img.width` attribute to `img.style.width`
  - Supports both numeric values and "px" strings
- **Quick Add Link Improvements**:
  - URL field auto-focuses when popup opens
  - Remembers last used group (saved in localStorage)
- **Files Modified**: `context-menu.js`, `links-handler.js`

### YouTube Integration
- **Channel Icon Detection**: Automatically fetches YouTube channel icons
  - Detects channel URLs (`/@`, `/channel/`, `/c/`)
  - Extracts channel icon from page HTML
  - Falls back to favicon if extraction fails
- **Files Modified**: `convex/actions.ts`, `links-handler.js`

## Known Issues

- **Group Width Wrap Bug**: Groups with manual line breaks stay too wide. See `GROUP_WIDTH_BREAK_ISSUE.md`.
- **Start on New Line Toggle**: Known issue with groups (applies to all items inside) ⚠️. See `START_NEW_LINE_ISSUE.md`.

## Next Steps

- Fix group "Start on New Line" to only affect group position, not internal items
- Consider adding separator support for collapsible groups in the top container
