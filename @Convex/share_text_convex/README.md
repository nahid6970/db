# Share Text - Convex Version

Simple text sharing app using Convex backend and vanilla HTML/JS.

## Setup Instructions (Run Manually)

1. Install dependencies:
```bash
npm install
```

2. Initialize Convex:
```bash
npx convex dev
```
- This will create a Convex account if needed
- Copy the **deployment URL** provided (looks like `https://xxx.convex.cloud`)
- Keep this terminal running

3. Update `index.html`:
- Open `index.html` in a text editor
- Find line with `YOUR_CONVEX_URL_HERE`
- Replace it with your actual Convex URL from step 2

4. Test locally:
- Open `index.html` in your browser
- Try adding, copying, and deleting text entries

## After Setup - What to Do Next

### For Local Development:
- Keep `npx convex dev` running in terminal
- Any changes to `convex/functions.ts` auto-deploy
- Refresh browser to see changes

### For Production Deployment:
1. Run production deployment:
```bash
npx convex deploy
```

2. Copy the **production URL** (different from dev URL)

3. Update `index.html` with production URL

4. Deploy `index.html` to:
   - GitHub Pages
   - Netlify
   - Vercel
   - Any static file host

5. Access your app from anywhere via the deployed URL

## Features

- Add text entries with timestamps
- Copy text to clipboard
- Delete individual entries
- Clean all entries
- Auto-refresh every 5 seconds

## Important Notes

- Dev URL is for testing only
- Production URL is for public deployment
- Backend runs on Convex servers (free tier: 40 deployments/month)
- Only `convex/` folder changes count as deployments
