# MyHome Chrome Extension

Add links to your MyHome dashboard directly from your browser using right-click context menu or the extension popup.

## Installation

1. **Open Chrome Extensions:**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)

2. **Load Extension:**
   - Click "Load unpacked"
   - Select the `chrome-extension/` folder

3. **Configure Convex URL:**
   - Open `background.js` and `popup.js`
   - Update `CONVEX_URL` with your Convex deployment URL

## Usage

### Context Menu (Right-Click)
- Right-click anywhere on a webpage
- Select "Add Link to MyHome"
- Link is added automatically with page title and favicon

### Extension Popup
- Click the extension icon in Chrome toolbar
- Current page title and URL are pre-filled
- Optionally specify a group name
- Click "Add Link"

## Features

- Adds links with automatic favicon detection
- Optional group assignment (leave empty for no group)
- Notifications on success/failure
- Works on any webpage (except chrome:// pages)

## Moving the Extension

You can move this folder anywhere on your system:
1. Move the entire folder to new location
2. Go to `chrome://extensions/`
3. Remove the old extension
4. Click "Load unpacked" and select the new folder location

## Files

- `manifest.json` - Extension configuration
- `background.js` - Context menu handler and API calls
- `popup.html` - Extension popup UI
- `popup.js` - Popup functionality
- `icon.png` - Extension icon
