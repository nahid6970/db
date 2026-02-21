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

✅ **Link Management:**
  - Add, edit, delete, copy, hide/show
  - Multiple URLs per link
  - Display styles: Flex (row) or List-Item (column)

✅ **Rich Styling:**
  - Custom colors, gradients, borders
  - NerdFont icons, images, SVG support
  - Color preview in input fields

✅ **Sidebar & Navigation:**
  - customizable Sidebar buttons
  - Context menus (right-click)
  - Edit mode toggle (F1 key or button)

## Production Deployment

1. **Deploy to Convex:**
   ```bash
   npx convex deploy
   ```
   - Generates prod URL: `https://yyy.convex.cloud`

2. **Update app.js with prod URL**

3. **Deploy frontend to GitHub Pages or any static host**

## Notes

- Backend runs on Convex servers (free tier: 40 deployments/month)
- Only changes to `convex/` folder count as deployments
- HTML/CSS/JS changes don't count
- Database tables created automatically on first insert
