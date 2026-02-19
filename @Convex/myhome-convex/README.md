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

✅ Link management (add, edit, delete, copy, reorder)
✅ Multiple URLs per link
✅ Link grouping with collapsible groups
✅ Password-protected groups (password: "1823")
✅ Horizontal stack layout
✅ Display styles: flex or list-item
✅ Hide/show links
✅ Drag-and-drop reordering
✅ Context menus (right-click)
✅ Sidebar button management
✅ Custom styling with gradients
✅ NerdFont icons, images, SVG support
✅ Edit mode (F1 key)
✅ Color preview in inputs

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
