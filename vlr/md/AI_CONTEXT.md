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
- `scraper.py` — `fetch_and_update_matches(start_page, end_page)` is the main sync function
- `GET /` — renders index with match data (server-side limited by `per_page`)
- `GET /api/matches?start=N&end=M` — triggers sync for page range, returns JSON
- `GET/POST /api/settings` — read/write all user preferences to `settings.json`
- `POST /api/ignorelist/add` — add `[{name, logo}]` to `ignorelist.json`
- `POST /api/ignorelist/remove` — remove by name
- `POST /api/backup` / `POST /api/restore` — backup and restore `matches.json`

## Settings (`settings.json`)
```json
{
  "theme": "dark",
  "per_page": "all",
  "scrape_start": 1,
  "scrape_end": 5,
  "unchecked_tournaments": [],
  "filter_year": "all",
  "filter_series": "all",
  "filter_custom_series": []
}
```

## Ignore List (`ignorelist.json`)
Array of `{name, logo}` objects, oldest-first (newest rendered first via JS/Jinja `|reverse`).

## Key Invariants
- Match data stored as dict keyed by match ID in `matches.json`
- **No auto-sync** — sync only on manual SYNC button click
- Team/tournament logos cached locally; paths stored as `/static/images_cache/<hash>.png`
- `js_timestamp` = `unix_timestamp * 1000` (milliseconds for JS)
- All JSON saves use atomic write (`.tmp` → `os.replace()`)
- `sync_lock` and `details_lock` are module-level threading locks in `scraper.py`
- Theme applied server-side on `<body class="light">` — no flash

## Sidebar Filters
- Year dropdown + Series dropdown + `+` button for custom text tags
- Custom tags saved to `settings.json` as `filter_custom_series: []`
- Filters apply to both sidebar tournament list and match cards (OR logic with series dropdown)

## What Not to Break
- Atomic file writes (tmp → rename) for all JSON files
- `sync_lock` and `details_lock` threading guards
- `WERKZEUG_RUN_MAIN` guard prevents double thread start in debug mode
- Match `href` field used for VLR.gg card click links
- `customSeriesFilters` must be declared before `applyFilters()` is called on init (TDZ risk)
