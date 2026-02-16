# MyHome Bookmark Manager - Convex Edition

Advanced bookmark manager with grouped links, extensive customization, and multiple display modes.

## Features

- **3 Group Display Types**: Collapsible top groups, flex grid layout, and compact list view
- **Icon Customization**: NerdFont icons, SVG code, or plain text
- **Advanced Styling**: Gradients, per-item colors, custom fonts
- **Drag & Drop**: Reorder items and groups
- **Password Protection**: Lock groups with passwords
- **Edit Mode**: Press F1 to toggle edit mode

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Initialize Convex:**
   ```bash
   npx convex dev
   ```
   This will:
   - Create a Convex project
   - Generate a deployment URL
   - Start the development server

3. **Update the Convex URL:**
   - Copy the URL from the terminal (e.g., `https://xxx.convex.cloud`)
   - Open `index.html`
   - Replace `YOUR_CONVEX_URL_HERE` with your actual URL

4. **Open the app:**
   - Open `index.html` in your browser
   - The app will connect to your Convex backend

## Migration from Flask

If you have existing data in `data.json`:

1. Open browser console on your app
2. Paste your JSON data:
   ```javascript
   const backupData = [...]; // Your JSON array
   await convexClient.mutation("importData:importLinks", { links: backupData });
   ```

## Development

- Keep `npx convex dev` running while developing
- Changes to `convex/` files auto-deploy
- Frontend changes require browser refresh

## Deployment

1. **Deploy backend:**
   ```bash
   npx convex deploy
   ```

2. **Update production URL in `index.html`**

3. **Deploy frontend to any static host:**
   - GitHub Pages
   - Netlify
   - Vercel
   - Or any web server

## Project Structure

```
.
├── convex/
│   ├── links.ts          # Links CRUD operations
│   ├── sidebar.ts        # Sidebar buttons
│   └── importData.ts     # Data migration utility
├── static/
│   └── style.css         # Styling
├── index.html            # Main app
└── package.json          # Dependencies
```

## API Reference

### Links

- `links:getLinks` - Get all links (ordered)
- `links:addLink` - Add new link
- `links:updateLink` - Update existing link
- `links:deleteLink` - Delete link
- `links:reorderLinks` - Reorder multiple links

### Sidebar

- `sidebar:getButtons` - Get all sidebar buttons
- `sidebar:addButton` - Add new button
- `sidebar:updateButton` - Update button
- `sidebar:deleteButton` - Delete button

## Styling Properties

Each link supports extensive customization:

- **Group Display**: `collapsible`, `display_style`, `horizontal_stack`
- **Top Group**: `top_name`, `top_bg_color`, `top_text_color`, `top_font_size`, `top_font_family`
- **Popup**: `popup_bg_color`, `popup_text_color`, `popup_border_color`
- **Items**: `li_bg_color`, `li_hover_color`, `li_width`, `li_height`, `li_font_size`, `li_font_family`

See `CONVEX_GUIDE.md` for complete documentation.

## Free Tier Limits

- 40 deployments/month
- 1GB database storage
- 1M function calls/month
- 10GB bandwidth/month

This project fits comfortably within free tier.
