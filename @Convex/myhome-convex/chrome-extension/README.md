# MyHome Link Adder - Chrome Extension

This extension allows you to quickly add links to your MyHome dashboard.

## Features

- **Right-Click Context Menu**: Right-click on any page or link and select "Add Link to MyHome".
- **Popup Interface**: Click the extension icon to preview/edit the name, URL, and group before adding.
- **Automatic Metadata**: Uses the MyHome backend to automatically fetch:
  - Page titles
  - YouTube video titles (via oEmbed to avoid rate limiting)
  - YouTube channel icons/thumbnails
  - Standard favicons for other sites

## Installation

1. Open Chrome and go to `chrome://extensions/`.
2. Enable **"Developer mode"** in the top right corner.
3. Click **"Load unpacked"**.
4. Select this `chrome-extension` folder.

## Configuration

The extension is pre-configured to work with your MyHome Convex deployment at:
`https://lovable-wildcat-595.convex.cloud`

## Usage

- New links are added to the **"Inbox"** group by default.
- You can change the group name in the popup before clicking "Add".
- A desktop notification will confirm when a link is successfully added via the context menu.
