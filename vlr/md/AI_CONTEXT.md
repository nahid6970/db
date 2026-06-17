# VLR BST — AI Context

## What It Is
A Flask web app that scrapes VLR.gg for Valorant match schedules and displays them in Bangladesh Standard Time (BST, UTC+6). Runs locally on port 5025.

## Stack
- **Backend:** Python + Flask (`app.py`)
- **Scraper:** BeautifulSoup (`scraper.py`) — scrapes VLR.gg, caches to `matches.json`
- **Frontend:** Vanilla JS (`static/js/main.js`), CSS (`static/css/style.css`), Jinja2 template (`templates/index.html`)
- **Images:** Cached locally in `static/images_cache/`

## Entry Points
- `app.py` — Flask server, run with `python app.py`
- `scraper.py` — `fetch_and_update_matches()` is the main sync function
- `GET /` — renders index with match data
- `GET /api/matches` — triggers sync, returns JSON
- `POST /api/settings` — saves tournament filter preferences to `settings.json`

## Key Invariants
- Match data stored as dict keyed by match ID in `matches.json`
- Background sync runs every 5 minutes in a daemon thread
- Team/tournament logos cached locally; paths stored as `/static/images_cache/<hash>.png`
- `js_timestamp` = `unix_timestamp * 1000` (milliseconds for JS)
- Settings (unchecked tournaments) saved to `settings.json` via atomic rename

## What Not to Break
- Atomic file writes (tmp → rename) for `matches.json` and `settings.json`
- `sync_lock` and `details_lock` threading guards
- `WERKZEUG_RUN_MAIN` guard prevents double thread start in debug mode
- Match `href` field (e.g. `/12345/team-a-vs-team-b`) used for VLR.gg card click links
