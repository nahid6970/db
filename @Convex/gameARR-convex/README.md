# GameARR - Convex Version

A game collection tracker built with Convex backend.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Initialize Convex
```bash
npx convex dev
```
- This will create a Convex account (if needed)
- You'll get a dev URL like: `https://xxx.convex.cloud`
- Copy this URL

### 3. Update Frontend
Open `index.html` and replace `YOUR_CONVEX_URL_HERE` with your actual Convex URL.

### 4. Test Locally
Open `index.html` in your browser to test the app.

## Features

- Add/view games with name, year, image, rating, progression, URL, and collection
- Search games by name
- Filter by collection
- Sort by name, year, or rating
- Auto-refresh every 10 seconds

## Deployment

### Development
Keep `npx convex dev` running while developing. Changes to `convex/` folder auto-deploy.

### Production
1. Run `npx convex deploy` to get production URL
2. Update `index.html` with production URL
3. Deploy `index.html` to GitHub Pages or any static host

## Database Schema

Table: `games`
- name (string)
- year (string)
- image (string)
- rating (number)
- progression (string)
- url (string)
- collection (string)
