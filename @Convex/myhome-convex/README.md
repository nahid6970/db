# Convex MyHome - Setup Instructions

## Initial Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Initialize Convex (creates account and deployment):**
   ```bash
   npx convex dev
   ```
   - This will open a browser to create/login to Convex account
   - Generates dev URL: `https://xxx.convex.cloud`
   - Keep terminal open during development

3. **Update Convex URL:**
   - Open `app.js`
   - Replace `YOUR_CONVEX_URL_HERE` with your actual dev URL from step 2

4. **Open the app:**
   - Open `index.html` in your browser
   - Or use a local server: `python -m http.server 8000`

## Features Included

✅ **Robust Group Management:**
  - Drag-and-drop reordering that **persists after refresh**
  - Collapsible groups (Top Groups)
  - Horizontal stack layout
  - Password-protected groups (password: "1823")
  - Visual separators between groups
  - "Start on New Line" toggle for groups

✅ **Link Management:**
  - Add, edit, delete, copy, hide/show
  - Multiple URLs per link
  - Display styles: Flex (row) or List-Item (column)
  - "Start on New Line" toggle for individual items
  - YouTube channel icon auto-detection

✅ **Rich Styling:**
  - Custom colors, gradients, borders
  - NerdFont icons, images, SVG support
  - Color preview in input fields
  - Custom width/height for images

✅ **Sidebar & Navigation:**
  - Customizable Sidebar buttons
  - Context menus (right-click) with smart positioning
  - Edit mode toggle (F1 key or button)

✅ **Chrome Extension:**
  - Add links via right-click context menu
  - Extension popup for quick link addition
  - See `chrome-extension/README.md` for setup

## Production Deployment

1. **Deploy to Convex:**
   ```bash
   npx convex deploy
   ```
   - Generates prod URL: `https://yyy.convex.cloud`

2. **Update app.js with prod URL**

3. **Update Chrome extension files (`background.js` and `popup.js`) with prod URL**

4. **Deploy frontend to GitHub Pages or any static host**

## Notes

- Backend runs on Convex servers (free tier: 40 deployments/month)
- Only changes to `convex/` folder count as deployments
- HTML/CSS/JS changes don't count
- Database tables created automatically on first insert
- Chrome extension can be moved to any folder location

## Known Issues

- Group "Start on New Line" feature applies to all items inside the group (see `START_NEW_LINE_ISSUE.md` for details)
