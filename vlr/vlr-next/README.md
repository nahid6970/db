# VLR Match Tracker — Vercel + Convex + GitHub Actions

A fully serverless VLR.gg match tracker. No local server needed.  
Scraper runs hourly via GitHub Actions → pushes to Convex → frontend on Vercel live-updates instantly.

```
VLR.gg ──scrape──► GitHub Actions ──POST──► Convex (DB)
                                                │
                              Vercel (Next.js) ◄─ live subscription
```

---

## Architecture

```
Click ⟳ Sync button
        │
        ▼
Vercel Python Function (api/sync.py)
  - Scrapes VLR.gg match list + detail pages
  - No player photos during sync (fetched on-demand)
  - POSTs results to Convex via HTTP
        │
        ▼
Convex Database
        │
        ▼ (live subscription)
Next.js Frontend on Vercel — updates instantly, no refresh needed
```

No GitHub Actions, no cron jobs. Just click the sync button like the original Flask app.

---

## One-time Setup (follow in order)

### 1. Create a Convex project

```bash
# Inside vlr-next/
npm install
npx convex dev
```

This opens a browser prompt — sign in and create a new project. Convex will:
- Generate `convex/_generated/` files
- Print your **Deployment URL** (`https://xxxx.convex.cloud`) and **Site URL** (`https://xxxx.convex.site`)

Copy both — you'll need them.

### 2. Set the Convex secret env var

In the [Convex dashboard](https://dashboard.convex.dev) → your project → **Settings → Environment Variables**:

| Key | Value |
|-----|-------|
| `CONVEX_SECRET` | Pick any strong random string, e.g. `openssl rand -hex 32` |

This protects the `/ingest-matches` HTTP endpoint from unauthorized POSTs.

### 3. Deploy to Vercel

1. Push the `vlr-next/` folder to a GitHub repository.
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo.
3. Set **Root Directory** to `vlr-next` (if it's a subfolder).
4. Add these **Environment Variables** in Vercel dashboard → Project → Settings → Environment Variables:

| Variable | Value | Where to find |
|----------|-------|---------------|
| `NEXT_PUBLIC_CONVEX_URL` | `https://xxxx.convex.cloud` | Convex dashboard → Settings |
| `CONVEX_SITE_URL` | `https://xxxx.convex.site` | Convex dashboard → Settings |
| `CONVEX_SECRET` | Same value from step 2 | You created this |

5. Click **Deploy**.

That's it — no GitHub token, no Actions secrets needed.

### 4. Run the first scrape

Click the **⟳ button** in the top-right of the app. The Vercel Python function runs the scraper and populates Convex. Takes ~30–60 seconds depending on scrape range.

---

## Local Development

```bash
cd vlr-next
cp .env.example .env.local
# Fill in all three vars from your Convex dashboard

npm install
npx convex dev        # terminal 1 — keeps Convex functions in sync
npx vercel dev        # terminal 2 — runs Next.js + Python functions together
```

> Use `vercel dev` (not `next dev`) so the Python `api/sync.py` function is served alongside the Next.js app. Install the Vercel CLI with `npm i -g vercel` if you don't have it.

---

## Project Structure

```
vlr-next/
├── app/
│   ├── layout.tsx               # Root layout + Convex provider
│   ├── page.tsx                 # Home page → renders AppShell
│   ├── globals.css              # All styles (ported from original)
│   ├── ConvexClientProvider.tsx # Wraps app with ConvexProvider
│   └── api/sync/route.ts        # POST → triggers GitHub Actions scraper
│
├── components/
│   ├── AppShell.tsx             # Main orchestrator (header, state, modals)
│   ├── Sidebar.tsx              # Tournament filter sidebar
│   ├── MatchCard.tsx            # Individual match card
│   ├── MatchDetailModal.tsx     # Full match detail + player stats
│   ├── SettingsModal.tsx        # Settings (ignore list, scrape range, logos)
│   ├── TeamHistoryModal.tsx     # Per-team match history
│   ├── LeaderboardModal.tsx     # Aggregated player stats leaderboard
│   └── StandingsModal.tsx       # Per-tournament team standings
│
├── convex/
│   ├── schema.ts                # DB schema (matches, settings, ignorelist)
│   ├── matches.ts               # match queries + mutations
│   ├── settings.ts              # settings + ignorelist queries/mutations
│   └── http.ts                  # HTTP actions: /ingest-matches, /upsert-match
│
├── lib/
│   ├── types.ts                 # Shared TypeScript types
│   └── utils.ts                 # Sorting, filtering, formatting helpers
│
├── scraper/
│   ├── scraper.py               # VLR.gg scraper → posts to Convex
│   └── requirements.txt
│
└── .github/workflows/
    └── scraper.yml              # Hourly + manual scraper trigger
```

---

## How the Sync Button Works

Clicking **⟳** calls `POST /api/sync` → handled by `api/sync.py` (Vercel Python function).  
The Python function scrapes VLR.gg, posts all matches to Convex via the HTTP actions.  
Convex notifies all connected clients → UI updates in real-time, no page refresh needed.

Player photos are intentionally skipped during sync (they'd take too long). They're fetched on-demand when you open a match detail modal.

---

## GitHub Actions (optional fallback)

`.github/workflows/scraper.yml` is kept as a **manual fallback only** — no cron schedule.  
Use it if you want to run a very deep scrape (e.g. 20+ pages) that might exceed Vercel's 300s limit.  
Trigger it from: GitHub repo → Actions → VLR Scraper (Manual Fallback) → Run workflow.

For that to work, add these secrets to your GitHub repo:
- `CONVEX_SITE_URL`
- `CONVEX_SECRET`

---

## FAQ

**Q: The sync button spins but nothing happens**  
A: Make sure `CONVEX_SITE_URL` and `CONVEX_SECRET` are set in Vercel environment variables and that you redeployed after adding them.

**Q: Convex ingest returns 401**  
A: The `CONVEX_SECRET` in Vercel env vars must exactly match the `CONVEX_SECRET` set in Convex dashboard env vars.

**Q: Match detail stats are missing**  
A: Click sync — the scraper fetches detail pages (maps + player stats) for every match. Player photos are loaded separately when you open the match modal.

**Q: Local dev sync button doesn't work**  
A: Use `vercel dev` not `next dev`. The Python function only runs under the Vercel dev server.

**Q: I want to scrape more pages**  
A: In Settings → Scrape tab, increase the page range. The Vercel free tier allows 300s — scraping 1–5 pages with details comfortably fits. For deeper scrapes (10+ pages), use the GitHub Actions fallback.
