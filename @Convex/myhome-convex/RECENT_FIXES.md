# Recent Fixes and Improvements

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

See `START_NEW_LINE_ISSUE.md` for details on the group "Start on New Line" bug.

## Next Steps

- Fix group "Start on New Line" to only affect group position, not internal items
- Consider adding separator support for collapsible groups in the top container
