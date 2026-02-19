# Convex MyHome Project Documentation

## Overview
This is a customizable link management application built with **Convex** as the backend database. It allows users to create, organize, and manage links with extensive customization options including colors, icons, layouts, and grouping.

## Technology Stack
- **Backend**: Convex (serverless database and API)
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Icons**: Nerd Fonts (JetBrainsMono NFP)
- **Deployment**: Convex Cloud (https://lovable-wildcat-595.convex.cloud)

---

## Project Structure

```
convex-myhome/
├── convex/                      # Convex backend
│   ├── schema.ts               # Database schema definitions
│   ├── functions.ts            # API queries and mutations
│   └── _generated/             # Auto-generated Convex files
├── index.html                  # Main HTML structure
├── style.css                   # Global styles
├── app.js                      # Main app initialization (ES module)
├── links-handler.js            # Link management logic
├── sidebar-handler.js          # Sidebar button management
├── context-menu.js             # Right-click context menu
└── .env.local                  # Convex deployment URL
```

---

## Core Features

### 1. Link Management
- **Add/Edit/Delete** links with extensive customization
- **Drag and drop** reordering
- **Multiple URLs** per link (opens first URL by default)
- **Right-click context menu** for quick actions
- **Hide/Show** links (visible only in edit mode when hidden)
- **Copy/Duplicate** links

### 2. Group Management
- **Regular Groups**: Standard flex or list layout
- **Collapsible Groups**: Top-bar style groups that expand on click
- **Horizontal Stack Groups**: Items displayed in a row
- **Password Protection**: Optional password for collapsible groups
- **Custom Styling**: Per-group colors, fonts, borders

### 3. Sidebar Buttons
- **Custom buttons** in the top navigation bar
- **Display types**: Icon (Nerd Font), Image, or SVG
- **Right-click context menu**: Edit, Duplicate, Delete
- **Fully customizable**: Colors, borders, hover effects, font sizes

### 4. Edit Mode (F1 Key)
- Toggle edit mode with **F1 key**
- Shows edit/delete buttons on links and groups
- Edit buttons only visible for groups in edit mode
- Links and sidebar buttons use right-click context menu

### 5. Visual Customization
- **Color preview**: Input fields show the color as you type
- **Nerd Font icons**: Full support for icon fonts
- **Custom dimensions**: Width, height, padding, borders
- **Hover effects**: Custom hover colors
- **Responsive design**: Mobile-friendly layouts

---

## Database Schema

### Links Table (`links`)
Stores all link items with extensive customization options:

**Core Fields:**
- `name`: Link name
- `group`: Group name for organization
- `url`: Primary URL
- `urls`: Array of multiple URLs
- `default_type`: Display type (text, nerd-font, img, svg)

**Content Styling:**
- `text`, `icon_class`, `img_src`, `svg_code`: Content based on type
- `width`, `height`: Content dimensions
- `color`, `background_color`: Content colors
- `font_family`, `font_size`: Typography
- `border_radius`: Content border radius
- `title`: Tooltip text

**Container Styling (li_*):**
- `li_width`, `li_height`: Item container size
- `li_bg_color`, `li_hover_color`: Container colors
- `li_border_color`, `li_border_radius`: Container borders

**Group Settings:**
- `hidden`: Hide link (visible in edit mode)
- `collapsible`: Make group collapsible
- `display_style`: flex or list-item
- `horizontal_stack`: Display items horizontally
- `password_protect`: Require password to expand

**Collapsible Group Styling (top_*):**
- `top_name`: Custom display name
- `top_bg_color`, `top_text_color`, `top_border_color`, `top_hover_color`
- `top_width`, `top_height`, `top_font_family`, `top_font_size`

**Popup Styling (popup_*):**
- `popup_bg_color`, `popup_text_color`, `popup_border_color`, `popup_border_radius`

**Horizontal Stack Styling (horizontal_*):**
- `horizontal_bg_color`, `horizontal_text_color`, `horizontal_border_color`, `horizontal_hover_color`
- `horizontal_width`, `horizontal_height`, `horizontal_font_family`, `horizontal_font_size`

### Sidebar Buttons Table (`sidebar_buttons`)
Stores custom navigation buttons:

- `id`: Unique identifier
- `name`: Button name
- `url`: Target URL
- `display_type`: icon, image, or svg
- `icon_class`, `img_src`, `svg_code`: Content based on type
- `text_color`, `bg_color`, `hover_color`: Colors
- `border_color`, `border_radius`: Border styling
- `font_size`: Icon/text size
- `has_notification`: Boolean for notification support
- `notification_api`, `mark_seen_api`: API endpoints (optional)

---

## Key Functions

### Convex API Functions (`convex/functions.ts`)

**Links:**
- `getLinks()`: Query all links
- `addLink(args)`: Create new link
- `updateLink(args)`: Update existing link
- `deleteLink({ id })`: Delete link by ID
- `updateAllLinks({ links })`: Replace all links (for reordering)

**Sidebar Buttons:**
- `getSidebarButtons()`: Query all sidebar buttons
- `addSidebarButton(args)`: Create new button
- `updateSidebarButton(args)`: Update existing button
- `deleteSidebarButton({ id })`: Delete button by ID

### Frontend Functions

**Links Handler (`links-handler.js`):**
- `loadLinks()`: Fetch links from Convex and render
- `renderLinks()`: Render all links and groups
- `createCollapsibleGroup(groupName, items)`: Create top-bar group
- `createRegularGroup(groupName, items)`: Create standard group
- `createLinkItem(link, index)`: Create individual link element
- `showAddLinkPopup()`: Open add link form
- `openEditLinkPopup(link, index)`: Open edit link form
- `deleteLink(id)`: Delete link with confirmation
- `copyLink(link)`: Duplicate link
- `reorderLinks(fromIndex, toIndex)`: Drag-and-drop reordering
- `openEditGroupPopup(groupName)`: Edit group settings

**Sidebar Handler (`sidebar-handler.js`):**
- `loadSidebarButtons()`: Fetch and render sidebar buttons
- `renderSidebarButtons()`: Render all buttons
- `createSidebarButton(button, index)`: Create button element with context menu
- `showAddSidebarButtonPopup()`: Open add button form
- `openEditSidebarButtonPopup(button, index)`: Open edit button form
- `deleteSidebarButton(id)`: Delete button with confirmation

**Context Menu (`context-menu.js`):**
- `showContextMenu(event, items)`: Display context menu at cursor
- `hideContextMenu()`: Close context menu

**App Initialization (`app.js`):**
- Initializes Convex client
- Sets up global helper functions
- Loads links and sidebar buttons on page load

---

## Important Implementation Details

### 1. Convex Client Initialization
The Convex client is initialized in `links-handler.js` using dynamic import:
```javascript
import('https://esm.sh/convex@1.16.0/browser').then(module => {
  const { ConvexHttpClient } = module;
  window.convexClient = new ConvexHttpClient("https://lovable-wildcat-595.convex.cloud");
});
```

### 2. Helper Functions
Global helper functions are exposed on `window` object:
- `window.convexQuery(functionName, args)`: Execute Convex query
- `window.convexMutation(functionName, args)`: Execute Convex mutation
- `window.showNotification(message, type)`: Show toast notification
- `window.editMode`: Boolean for edit mode state
- `window.showContextMenu(event, items)`: Show context menu

### 3. Edit Mode Toggle
F1 key toggles edit mode:
- Adds/removes `edit-mode` class on `.flex-container2`
- Dispatches `editModeChanged` event
- Re-renders links and sidebar buttons
- Shows/hides edit buttons

### 4. Color Preview System
Automatically detects color input fields and shows live preview:
- Looks for `.color-input` class or "color" in placeholder/id
- Changes background to the color value
- Adjusts text color for contrast (black/white)
- Uses `MutationObserver` to detect popup opens

### 5. Popup Management
- Close with X button (`.close-button`)
- Close by clicking outside (on `.popup-container`)
- Submit buttons positioned vertically on left side (desktop only)
- Forms use `!important` CSS to override inline styles

### 6. Drag and Drop
Links can be reordered via drag and drop:
- Uses HTML5 drag and drop API
- Calls `updateAllLinks()` mutation to persist order
- Visual feedback with `.dragging` class

### 7. Context Menu
Right-click context menu for links and sidebar buttons:
- Links: New-Tab, Edit, Copy, Delete
- Sidebar Buttons: Edit, Duplicate, Delete
- Groups: Edit, Delete

### 8. Nerd Font Icons
Uses JetBrainsMono Nerd Font Propo (NFP):
- Imported from CDN: `https://cdn.jsdelivr.net/npm/nerd-fonts-web@3.0.0/dist/nerd-fonts-generated.min.css`
- Font family: `jetbrainsmono nfp, monospace` (lowercase)
- Icons use class format: `nf nf-dev-terminal`

### 9. Floating Action Button (FAB)
Fixed position button at bottom-right:
- Always visible for adding new links
- Green circular button with "+" icon
- Hover effect: scale and color change

---

## Common Workflows

### Adding a Link
1. Click FAB button (bottom-right) or large "+ Add New Link" button
2. Fill in form fields (name, group, URL, type, styling)
3. Click "Add" button (left sidebar on desktop)
4. Link appears in the specified group

### Editing a Link
1. Press F1 to enter edit mode, OR
2. Right-click link → "Edit"
3. Modify fields in popup
4. Click "Save"

### Creating a Collapsible Group
1. Add/edit a link
2. Set group name
3. Check "Collapsible" in group settings
4. Customize top bar colors and styling
5. Group appears as clickable box at top

### Adding Sidebar Button
1. Click "+" button in top navigation
2. Fill in name, URL, display type
3. Choose icon/image/SVG
4. Customize colors and styling
5. Button appears in top bar

### Reordering Links
1. Drag a link item
2. Drop on another link item
3. Order is automatically saved

---

## Styling System

### CSS Variables
Groups can use CSS variables for dynamic styling:
- `--top-bg-color`, `--top-text-color`, `--top-border-color`, `--top-hover-color`
- `--popup-bg-color`, `--popup-text-color`, `--popup-border-color`, `--popup-border-radius`
- `--horizontal-bg-color`, `--horizontal-text-color`, `--horizontal-border-color`, `--horizontal-hover-color`

### Important CSS Classes
- `.flex-container2`: Main content container
- `.edit-mode`: Applied when edit mode is active
- `.link-group`: Regular group container
- `.group_type_top`: Collapsible group (top bar)
- `.group_type_top.expanded`: Expanded collapsible group
- `.link-item`: Individual link container
- `.sidebar-button`: Sidebar navigation button
- `.popup-container`: Popup overlay
- `.Menu`: Popup content box
- `.context-menu`: Right-click menu
- `.hidden`: Hides elements

### Responsive Design
- Desktop: Submit buttons on left sidebar, wider popups
- Mobile: Stacked layout, full-width forms, horizontal scrolling topbar

---

## Troubleshooting

### Links not loading
- Check browser console for errors
- Verify Convex client initialized: `window.convexClient`
- Check `.env.local` has correct deployment URL

### Icons not displaying
- Ensure Nerd Fonts CSS is loaded
- Use lowercase font family: `jetbrainsmono nfp`
- Verify icon class format: `nf nf-dev-terminal`

### Sidebar buttons not persisting
- Check `loadSidebarButtons()` is called on page load
- Verify `window.convexQuery` is available
- Check browser console for mutation errors

### Color preview not working
- Ensure input has `.color-input` class or "color" in placeholder
- Check `applyColorPreviewToContainer()` is called when popup opens
- Verify color value is valid (hex, rgb, named color)

### Popups not closing
- Check close button event listeners are set up
- Verify `.close-button` class exists
- Check click-outside handler on `.popup-container`

---

## Future Enhancements

Potential features to add:
- Search/filter links
- Import/export data (JSON)
- Themes and presets
- Link categories/tags
- Analytics (click tracking)
- Keyboard shortcuts
- Bulk operations
- Link validation
- Backup/restore
- Multi-user support with authentication

---

## Development Notes

### Running Locally
1. Install Convex CLI: `npm install -g convex`
2. Run dev server: `npx convex dev`
3. Open `index.html` in browser

### Deploying Schema Changes
```bash
npx convex deploy
```

### Debugging
- Enable verbose logging in browser console
- Check Convex dashboard for database state
- Use browser DevTools Network tab for API calls

### Code Style
- Use ES6+ features (arrow functions, async/await, destructuring)
- Prefer `const` over `let`
- Use template literals for strings
- Add console.log statements with emoji prefixes for debugging

---

## Contact & Support

For issues or questions about this project, check:
- Convex documentation: https://docs.convex.dev
- Nerd Fonts: https://www.nerdfonts.com
- Browser console for error messages

---

**Last Updated**: February 2026
**Version**: 1.0
**Author**: AI-assisted development
