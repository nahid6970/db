# Convex MyHome Project - Complete Guide

## Project Overview
This is a personal homepage/dashboard application built with **Convex** as the backend (replacing the original Flask backend). It allows users to manage links and sidebar buttons with a customizable interface.

## Technology Stack
- **Backend**: Convex (serverless backend with real-time database)
- **Frontend**: Vanilla JavaScript (ES6+)
- **Styling**: Custom CSS with cyberpunk theme elements
- **Icons**: Nerd Fonts (JetBrains Mono NFP)

## Project Structure

```
convex-myhome/
├── index.html              # Main HTML file
├── app.js                  # Main app initialization & Convex client setup
├── links-handler.js        # Link management logic
├── sidebar-handler.js      # Sidebar button management logic
├── context-menu.js         # Right-click context menu functionality
├── style.css               # All styling
├── convex/
│   ├── functions.ts        # Convex backend functions (queries & mutations)
│   ├── schema.ts           # Database schema definitions
│   └── _generated/         # Auto-generated Convex files
├── .env.local              # Convex deployment URL (DO NOT COMMIT)
└── package.json            # Dependencies
```

## Database Schema

### Links Table (`links`)
Stores all link items with their styling and metadata.

**Fields:**
- `name` (string): Display name
- `url` (string): Target URL
- `group` (string): Group name for organization
- `link_type` (string): "text", "nerd-font", or "img"
- `nerd_font_icon` (optional string): Nerd font icon class
- `img_url` (optional string): Image URL for img type
- `click_action` (string): "same-tab" or "new-tab"
- `group_type` (string): "normal", "top", "box", "horizontal-stack", "list", "simple"
- `hidden` (boolean): Visibility toggle
- `order` (number): Display order
- Styling fields: `text_color`, `bg_color`, `hover_color`, `border_color`, `border_radius`, `font_size`, `font_family`, `content_*` fields
- `note` (optional string): Markdown notes

### Sidebar Buttons Table (`sidebar_buttons`)
Stores sidebar/topbar buttons.

**Fields:**
- `id` (string): Unique identifier
- `name` (string): Button name
- `url` (string): Target URL
- `display_type` (string): "icon", "image", or "svg"
- `icon_class` (optional string): Nerd font icon class
- `img_src` (optional string): Image URL
- `svg_code` (optional string): SVG markup
- Styling fields: `text_color`, `bg_color`, `hover_color`, `border_color`, `border_radius`, `font_size`
- `has_notification` (boolean): Notification feature flag
- `notification_api` (optional string): API endpoint for notifications
- `mark_seen_api` (optional string): API to mark notifications as seen

## Key Backend Functions (convex/functions.ts)

### Queries (Read Operations)
- `getLinks()`: Fetch all links ordered by `order` field
- `getSidebarButtons()`: Fetch all sidebar buttons

### Mutations (Write Operations)
- `addLink(link)`: Add new link
- `updateLink({ dbId, ...fields })`: Update existing link by database ID
- `deleteLink({ id })`: Delete link by database ID
- `updateAllLinks(links)`: Bulk update all links (used for reordering)
- `addSidebarButton(button)`: Add new sidebar button
- `updateSidebarButton({ dbId, ...fields })`: Update sidebar button
- `deleteSidebarButton({ id })`: Delete sidebar button

## Frontend Architecture

### 1. app.js - Main Initialization
**Purpose**: Initialize Convex client and set up global helpers.

**Key Functions:**
- Dynamically imports Convex client
- Creates `window.convexClient` instance
- Sets up helper functions:
  - `window.convexQuery(functionName, args)`: Execute queries
  - `window.convexMutation(functionName, args)`: Execute mutations
  - `window.showNotification(message, type)`: Show toast notifications
- Sets up close button handlers for popups
- Applies color preview to form fields

**Important**: Uses dynamic import to load Convex as ES module.

### 2. links-handler.js - Link Management
**Purpose**: Handle all link-related operations.

**Key Functions:**
- `loadLinks()`: Fetch links from Convex and render
- `renderLinks()`: Render links grouped by `group` and `group_type`
- `createLinkElement(link)`: Create individual link DOM element
- `openEditLinkPopup(link)`: Open edit form with link data
- `deleteLink(id)`: Delete link with confirmation
- `updateLinkOrder()`: Save new order after drag-and-drop

**Important Features:**
- F1 key toggles edit mode (`window.editMode`)
- Right-click context menu on links (Edit, Duplicate, Delete, Copy URL, Copy Note, Open in New Tab)
- Drag-and-drop reordering within groups
- Floating "+" button at bottom-right for adding links
- Color preview on color input fields
- Nerd font icons use `jetbrainsmono nfp` font family

**Edit Mode (F1 Key):**
- Shows edit buttons on group headers
- Hides edit buttons on individual items (use right-click instead)
- Dispatches `editModeChanged` event

### 3. sidebar-handler.js - Sidebar Button Management
**Purpose**: Handle sidebar button operations.

**Key Functions:**
- `loadSidebarButtons()`: Fetch and render sidebar buttons
- `renderSidebarButtons()`: Render buttons in `#sidebar-buttons-container`
- `createSidebarButton(button, index)`: Create button DOM element with styling
- `showAddSidebarButtonPopup()`: Open add form
- `openEditSidebarButtonPopup(button, index)`: Open edit form
- `deleteSidebarButton(id)`: Delete button

**Important Features:**
- Right-click context menu (Edit, Duplicate, Delete)
- Inline styles with `!important` to override CSS
- Uses `setProperty()` for dynamic styling
- Listens to `editModeChanged` event to re-render
- Waits for `window.convexClient` and `window.convexQuery` before loading

**Styling Notes:**
- Buttons use inline styles for custom colors
- Border must be set with `border-width`, `border-style`, and `border-color`
- Icons use `jetbrainsmono nfp, monospace` font family
- Hover effects change background color

### 4. context-menu.js - Context Menu
**Purpose**: Show right-click context menus.

**Key Functions:**
- `showContextMenu(event, items)`: Display menu at cursor position
- `hideContextMenu()`: Hide menu
- Items format: `{ label: string, action: function }`

**Usage:**
```javascript
window.showContextMenu(event, [
  { label: 'Edit', action: () => editItem() },
  { label: 'Delete', action: () => deleteItem() }
]);
```

## Critical Implementation Details

### 1. Convex Client Initialization
The Convex client is initialized in `app.js` using dynamic import:
```javascript
const { ConvexHttpClient } = await import("https://cdn.jsdelivr.net/npm/convex@latest/+esm");
window.convexClient = new ConvexHttpClient(CONVEX_URL);
```

**Why**: Convex requires ES modules, but the project doesn't use a build system.

### 2. Helper Functions
All files use these global helpers:
- `window.convexQuery()`: For reading data
- `window.convexMutation()`: For writing data
- `window.showNotification()`: For user feedback

**Important**: Always check if helpers exist before using, or provide fallbacks.

### 3. Database ID vs Custom ID
- `_id`: Convex auto-generated database ID (used for updates/deletes)
- `id`: Custom identifier field (used in sidebar buttons)
- Always use `dbId` parameter when updating to specify the `_id`

### 4. Nerd Font Icons
- Font family: `jetbrainsmono nfp` (lowercase!)
- Import: `@import url("https://www.nerdfonts.com/assets/css/webfont.css");`
- Icon classes: `nf nf-dev-terminal`, `nf nf-fa-plus`, etc.
- Must set `font-family`, `font-style: normal`, `display: inline-block`

### 5. Color Preview Feature
Input fields with "color" in placeholder or class `color-preview` get live color preview:
- Background changes to the input value
- Text color adjusts for contrast
- Uses `setProperty()` with `!important`
- Applied via `applyColorPreviewToContainer()` function

### 6. Edit Mode (F1 Key)
- Toggles `window.editMode` boolean
- Adds/removes `edit-mode` class on `.flex-container2`
- Shows edit buttons on group headers only
- Individual items edited via right-click context menu
- Dispatches `editModeChanged` event for other handlers

### 7. Popup Forms
- All popups use `.popup-container` with `.Menu` class
- Close via X button or clicking outside
- Submit buttons positioned vertically on left side (desktop only)
- Forms have color preview on color fields
- Display type toggles show/hide relevant input fields

### 8. Drag and Drop
- Links can be reordered within their group
- Uses HTML5 drag and drop API
- Updates `order` field on all links in group
- Calls `updateAllLinks()` mutation to save

### 9. Styling with Inline Styles
Sidebar buttons use inline styles with `!important` to ensure custom colors work:
```javascript
btn.style.setProperty('color', button.text_color, 'important');
btn.style.setProperty('background-color', button.bg_color, 'important');
```

**Why**: CSS specificity issues with multiple style sources.

### 10. Async/Await Pattern
All Convex operations are async:
```javascript
const data = await window.convexQuery("functions:getLinks");
await window.convexMutation("functions:addLink", newLink);
```

Always use try-catch for error handling.

## Common Issues & Solutions

### Issue: Convex client not available
**Solution**: Wait for initialization with interval check:
```javascript
await new Promise(resolve => {
  const checkInterval = setInterval(() => {
    if (window.convexClient && window.convexQuery) {
      clearInterval(checkInterval);
      resolve();
    }
  }, 100);
});
```

### Issue: Nerd font icons not showing
**Solution**: 
- Use lowercase `jetbrainsmono nfp`
- Set `font-family`, `font-style: normal`, `display: inline-block`
- Ensure CSS import is present

### Issue: Sidebar button borders not working
**Solution**: Use `setProperty()` with `!important` and set all border properties:
```javascript
btn.style.setProperty('border-width', '2px', 'important');
btn.style.setProperty('border-style', 'solid', 'important');
btn.style.setProperty('border-color', color, 'important');
```

### Issue: Popups not closing
**Solution**: 
- Ensure close button has click handler
- Add click-outside-to-close on `.popup-container`
- Use `e.stopPropagation()` on `.Menu` to prevent bubbling

### Issue: Color preview not working
**Solution**:
- Call `applyColorPreviewToContainer()` after popup opens
- Use setTimeout to ensure DOM is ready
- Check if function exists before calling

### Issue: Items not persisting after refresh
**Solution**:
- Ensure `loadLinks()` or `loadSidebarButtons()` is called on DOMContentLoaded
- Check Convex deployment URL in `.env.local`
- Verify schema matches data structure

## Development Workflow

### 1. Starting Development
```bash
npm install
npx convex dev
```

### 2. Deploying Schema Changes
```bash
npx convex deploy
```

### 3. Testing
- Open `index.html` in browser
- Check browser console for errors
- Test CRUD operations on links and sidebar buttons
- Test F1 edit mode toggle
- Test right-click context menus
- Test drag-and-drop reordering

### 4. Common Commands
```bash
# Install dependencies
npm install

# Start Convex dev server
npx convex dev

# Deploy to production
npx convex deploy

# View logs
npx convex logs

# Open dashboard
npx convex dashboard
```

## File Dependencies

### index.html depends on:
- style.css
- app.js
- links-handler.js
- sidebar-handler.js
- context-menu.js

### app.js depends on:
- Convex CDN (https://cdn.jsdelivr.net/npm/convex@latest/+esm)
- .env.local (CONVEX_URL)

### links-handler.js depends on:
- window.convexClient (from app.js)
- window.convexQuery (from app.js)
- window.convexMutation (from app.js)
- window.showNotification (from app.js)
- window.showContextMenu (from context-menu.js)

### sidebar-handler.js depends on:
- window.convexClient (from app.js)
- window.convexQuery (from app.js)
- window.convexMutation (from app.js)
- window.showNotification (from app.js)
- window.showContextMenu (from context-menu.js)
- applyColorPreviewToContainer (from app.js)

## Important Notes for AI Assistants

1. **Always check if Convex client is initialized** before making queries/mutations
2. **Use `dbId` for updates**, not `id` (except for sidebar buttons which have custom `id`)
3. **Nerd fonts must use lowercase** `jetbrainsmono nfp`
4. **Inline styles need `!important`** for sidebar buttons to override CSS
5. **F1 toggles edit mode**, not a button
6. **Right-click context menu** is used for editing individual items
7. **Color preview** requires calling `applyColorPreviewToContainer()` after popup opens
8. **All Convex operations are async** - use await
9. **Edit mode only shows edit buttons on groups**, not individual items
10. **Duplicate function must include all required fields** including `has_notification`, `notification_api`, `mark_seen_api`, `id`

## Future Enhancements

Potential features to add:
- Search/filter functionality
- Import/export data
- Themes/color schemes
- Keyboard shortcuts
- Link categories/tags
- Analytics/usage tracking
- Mobile app version
- Collaborative features
- Backup/restore functionality

## Troubleshooting Checklist

When debugging issues:
1. ✅ Check browser console for errors
2. ✅ Verify Convex deployment URL in `.env.local`
3. ✅ Confirm schema matches data structure
4. ✅ Check if `window.convexClient` is initialized
5. ✅ Verify helper functions exist (`convexQuery`, `convexMutation`, `showNotification`)
6. ✅ Test with simple console.log statements
7. ✅ Check network tab for failed requests
8. ✅ Verify CSS imports (especially nerd fonts)
9. ✅ Test in different browsers
10. ✅ Clear cache and hard reload

---

**Last Updated**: February 19, 2026
**Project Status**: Active Development
**Maintainer**: User (nahid)
