# Vercel + Convex Migration Guide

This document outlines the steps required to migrate the frontend hosting from **GitHub Pages** to **Vercel**, while maintaining **Convex** as the backend database and actions provider.

---

## Step 1: Push Current Code to GitHub
Ensure all your local changes are committed and pushed to your GitHub repository:
```bash
git add .
git commit -m "Prepare for Vercel migration"
git push origin main
```

---

## Step 2: Create a Vercel Account & Import Project
1. Go to [Vercel](https://vercel.com/) and sign up / log in using your **GitHub account**.
2. Click **Add New** -> **Project**.
3. Import your dashboard repository from the list of GitHub repositories.

---

## Step 3: Configure Project Settings on Vercel
Before clicking **Deploy**, configure the following options in the project setup screen:

### 1. Build & Development Settings
Since this is currently a static HTML frontend (`index.html`, `style.css`, `links-handler.js` etc.):
- **Framework Preset:** Select **Other** (for plain HTML/JS projects).
- **Build Command:** Leave empty (or override if using a static site bundler like Vite).
- **Output Directory:** Leave default (or `.` to deploy the root directory).

### 2. Environment Variables
Add your Convex deployment URL so the client knows where to connect:
- **Key:** `NEXT_PUBLIC_CONVEX_URL` (if migrating to Next.js/Vite in the future) or simply map your Convex client endpoint correctly.
- **Value:** Your Convex URL (e.g., `https://vibrant-mammal-123.convex.cloud`).

---

## Step 4: Update Convex Client Initialization (Optional)
If your Convex client endpoint is hardcoded in the frontend, update it to read from Vercel's environment variables. 

In your frontend config initialization:
```javascript
const convexUrl = window.location.hostname === 'localhost' 
  ? 'http://localhost:5025' 
  : (process.env.NEXT_PUBLIC_CONVEX_URL || 'YOUR_PRODUCTION_CONVEX_URL');
```

---

## Step 5: Disable GitHub Pages Deployment
To prevent duplicate deployments and confusion:
1. Go to your repository settings on GitHub.
2. In the sidebar under **Code and automation**, click **Pages**.
3. Under **Build and deployment**, change the source from **Deploy from a branch** to **GitHub Actions** (without active workflows), or simply unpublish the pages site.

---

## Step 6: Deploy & Verify
1. Click **Deploy** in Vercel. 
2. Once the build finishes, Vercel will provide you with a production URL (e.g., `your-project.vercel.app`).
3. Open the URL and test the dashboard actions, especially checking that Convex mutations and your local custom URI protocol handlers (`opendir:` / `openfile:`) function correctly.
