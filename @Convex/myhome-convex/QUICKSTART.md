# 🚀 Quick Start Guide

## Setup (5 minutes)

```bash
cd convex-myhome
npm install
npx convex dev
```

This will:
1. Install Convex SDK
2. Open browser to create/login to Convex account
3. Generate your deployment URL: `https://xxx.convex.cloud`
4. Start development server

## Configure

Open `app.js` and replace:
```javascript
const client = new ConvexHttpClient("YOUR_CONVEX_URL_HERE");
```

With your actual URL:
```javascript
const client = new ConvexHttpClient("https://xxx.convex.cloud");
```

## Run

Open `index.html` in your browser or use a local server:
```bash
python -m http.server 8000
# Then open http://localhost:8000
```

## Usage

### Basic Operations
- **F1** - Toggle edit mode
- **Right-click** - Context menu (New-Tab, Edit, Copy, Delete)
- **Drag & Drop** - Reorder links (in edit mode)

### Add Link
1. Click "+ Add Link" button
2. Fill in details:
   - Name, Group (optional)
   - URL (click + for multiple URLs)
   - Type: Text, NerdFont, Image, or SVG
   - Styling: colors, sizes, borders
3. Click "Add"

### Add Sidebar Button
1. Press F1 to enter edit mode
2. Click + in sidebar
3. Fill in details
4. Click "Add"

### Group Settings
1. Right-click on group name
2. Select "Edit"
3. Configure:
   - Collapsible (shows at top)
   - Password protect (password: 1823)
   - Horizontal stack
   - Display style (flex/list)
   - Colors and styling

### Color Preview
Just type any color in color fields:
- `#ff0000` → Red preview
- `blue` → Blue preview
- `rgb(255,0,0)` → Red preview
- Text color auto-adjusts for readability

### Multiple URLs
- Click + to add more URL fields
- Click − to remove (except first)
- First URL opens by default

### SVG Support
Paste SVG code directly:
```html
<svg viewBox="0 0 24 24"><path d="..."/></svg>
```
Works in:
- Links
- Group display names
- Sidebar buttons

## Tips

### NerdFont Icons
Use format: `nf nf-fa-home`
Browse icons: https://www.nerdfonts.com/cheat-sheet

### Collapsible Groups
- Enable "Collapsible" in group settings
- Group appears at top
- Click to expand/collapse
- Optional password protection

### Hidden Links
- Check "Hide" when adding/editing
- Only visible in edit mode (F1)
- Useful for organizing

### Horizontal Stack
- Enable in group settings
- Links display in a row
- Good for related items

## Keyboard Shortcuts

- **F1** - Toggle edit mode
- **Esc** - Close popup (click outside)

## Production Deployment

```bash
npx convex deploy
```

This generates production URL: `https://yyy.convex.cloud`

Update `app.js` with prod URL, then deploy frontend to:
- GitHub Pages
- Netlify
- Vercel
- Any static host

## Troubleshooting

### "Could not find public function"
- Make sure `npx convex dev` is running
- Check Convex URL in `app.js`
- Refresh browser

### Links not showing
- Check browser console for errors
- Verify Convex URL is correct
- Make sure functions deployed (check terminal)

### Colors not previewing
- Type valid color format
- Hex: `#ff0000`
- Named: `red`, `blue`, etc.
- RGB: `rgb(255,0,0)`

### SVG not displaying
- Ensure SVG code includes `<svg>` tags
- Check for syntax errors
- Try simpler SVG first

## Features Overview

✅ Link management (add, edit, delete, copy)
✅ Sidebar buttons
✅ Grouping (regular & collapsible)
✅ Password protection
✅ Multiple URLs
✅ Display types (text, icons, images, SVG)
✅ Hide/show
✅ Drag-and-drop
✅ Context menus
✅ Color preview
✅ Dynamic URL fields
✅ Smooth animations
✅ Mobile responsive

## Need Help?

Check these files:
- `README.md` - Full setup instructions
- `FEATURES.md` - Complete feature list
- `PHASE2_COMPLETE.md` - Advanced features
- `PROJECT_STATUS.md` - Development status

Enjoy! 🎉
