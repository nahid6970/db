# Convex MyHome - Developer Guide

Personal home page / link manager built with Convex backend and vanilla JS frontend.

---

## Quick Start

```bash
npm install
npx convex dev        # starts backend, keep open during development
# open index.html in browser
```

Production:
```bash
npx convex deploy     # deploy backend
# update Convex URL in app.js, then deploy frontend to static host
```

---

## Architecture

```
myhome-convex/
├── index.html              # All HTML + inline scripts (color preview, format painter)
├── style.css               # All styles
├── app.js                  # Convex client init (type="module"), edit mode, notifications
├── links-handler.js        # Link + group rendering, CRUD, drag-drop (~1600 lines)
├── sidebar-handler.js      # Sidebar button management (~500 lines)
├── context-menu.js         # Right-click context menus
├── convex/
│   ├── schema.ts           # Database schema
│   ├── functions.ts        # Queries + mutations
│   └── actions.ts          # Server-side actions (title fetch, YouTube oEmbed)
├── chrome-extension/       # Browser extension for adding links
├── md/                     # Documentation
│   ├── RECENT.md           # Session history
│   ├── PROBLEMS_AND_FIXES.md
│   ├── FEATURES.md
│   └── UI_UX.md
└── dev.md                  # This file
```

---

## Key Technical Notes

### Script Loading Order
```html
<script src="context-menu.js"></script>
<script src="links-handler.js"></script>
<script src="sidebar-handler.js"></script>
<script type="module" src="app.js"></script>   <!-- Convex client, deferred -->
<script>/* inline: close handlers, color preview, format painter */</script>
```
**Important:** `app.js` is a module with `import`. If the Convex import fails, the module silently fails. Any feature that must always work (like format painter) should be in a plain `<script>` tag, not in `app.js`.

### Convex Client
- `window.convexClient` — the ConvexHttpClient instance
- `window.convexQuery(path)` — shorthand for queries
- `window.convexMutation(path, args)` — shorthand for mutations
- `window.convexReady` — true after client init; `convexReady` event dispatched

### Edit Mode
- `window.editMode` — boolean
- Toggle: F1 key or ✏️ Edit button
- Container gets `.edit-mode` class → shows drag handles, edit/delete buttons

### Group Data Model
All group settings are stored on every link in that group (denormalized). Key fields:
- `group` — group name
- `collapsible` / `box_group` — group type flags
- `group_order` — sort order (default 999)
- `top_name` — display name for Top/Box groups
- `group_start_new_line` — force group to new row
- Color fields: `top_bg_color`, `horizontal_bg_color`, `popup_bg_color`, etc.

### Format Painter
Defined as `window.formatPainter` IIFE in inline `<script>` at bottom of `index.html`.
- `window.formatPainter.capture()` — reads style fields from `#edit-link-form`, saves to localStorage
- `window.formatPainter.paste()` — applies saved styles to `#edit-link-form`

---

## Documentation

- #[[file:md/RECENT.md]] — Session history
- #[[file:md/PROBLEMS_AND_FIXES.md]] — Bug tracker
- #[[file:md/FEATURES.md]] — Feature specs
- #[[file:md/UI_UX.md]] — UI/UX guidelines
- #[[file:chrome-extension/README.md]] — Extension setup
- #[[file:README.md]] — Setup instructions
- #[[file:QUICKSTART.md]] — Quick start

---

## Password

Group password protection uses hardcoded password: **`1823`**
