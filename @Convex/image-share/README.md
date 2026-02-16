# Image Share - Convex + Cloudinary

## Setup Steps

### 1. Install Dependencies
```bash
cd convex-image-share
npm install
```

### 2. Initialize Convex
```bash
npx convex dev
```
- This will create a Convex account and give you a deployment URL
- Copy the URL (looks like `https://xxx.convex.cloud`)

### 3. Setup Cloudinary (Free)
1. Go to https://cloudinary.com/users/register_free
2. Sign up for free account
3. Go to Dashboard
4. Note your **Cloud Name**
5. Go to Settings → Upload → Upload Presets
6. Create a new preset:
   - Name it (e.g., "image_share")
   - Set "Signing Mode" to "Unsigned"
   - Save

### 4. Update Configuration
Edit `index.html` and replace:
- `YOUR_CONVEX_URL_HERE` with your Convex URL
- `YOUR_CLOUD_NAME` with your Cloudinary cloud name
- `YOUR_UPLOAD_PRESET` with your upload preset name

### 5. Run Locally
- Keep `npx convex dev` running in terminal
- Open `index.html` in browser

### 6. Deploy (Optional)
```bash
npx convex deploy
```
- Use the production URL in `index.html`
- Deploy HTML to GitHub Pages or any static host

## Features
- Upload multiple images
- Auto-refresh gallery every 5 seconds
- Delete individual images
- Clear all images
- Click image to open full size

## Free Tier Limits
- Convex: 40 deployments/month
- Cloudinary: 25GB storage, 25GB bandwidth/month
