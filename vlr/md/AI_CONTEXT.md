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
- `GET /api/match/<match_id>` — returns full match detail (lazy-fetches stats if missing)
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
  "filter_custom_series": [],
  "tournament_order": {"Tournament Name": 1},
  "tourney_sort_order": "none"
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

## Match Detail Modal
- Click any match card → opens in-app modal (no longer opens VLR.gg tab)
- Modal shows: tournament name, team logos + scoreline, map cards, player stats tabs
- **Map tabs:** "All Maps" (default) + one per map — click to switch stats view
- **Player stats:** ACS, K/D/A, KAST, ADR, HS%, agent icons (multiple per player for All Maps), top ACS highlighted gold
- **VLR.gg ↗** button on same row as map tabs
- Stats fetched lazily on first click if not yet in cache; background sync also fills them
- `matches.json` stores `maps: []` and `players: {"all": {team1,team2}, "0": {...}, "1": {...}}`
- Re-fetch triggered if `"all"` key missing (old format detection)

## Tournament Pin Order
- Right-click sidebar item → context menu → set position number
- `tournament_order: {name: pos}` in `settings.json`
- Sort key in `app.py`: `(tournament_order.get(name, 9999), unchecked, name)`
- JS `setPinOrder`: removes old pos (closes gap) → shifts ≥ newPos up → inserts at newPos
- Pin badge `#N` rendered on item; `×` removes pin

## Tournament Sort
- Dropdown beside crosshairs logo icon: "Pin order" / "Date ↑" / "Date ↓"
- Sorts by earliest match timestamp per tournament (`TOURNEY_FIRST_MATCH` injected from app.py)
- Pinned items always sort first by pin number; non-pinned sorted by date
- Saved as `tourney_sort_order` in `settings.json`

## Ignore Buttons
- **Ignore Unchecked** — adds visible (non-filtered) unchecked tournaments to ignore list
- **Ignore Checked** — adds visible checked tournaments to ignore list
- Both respect active filter (only operate on visible sidebar items)

## Sidebar Filters
- Year dropdown + Series text input (live filter, not persisted) + custom tag chips (persisted)
- Custom tags saved to `settings.json` as `filter_custom_series: []`
- Text input filters sidebar and match cards live; custom tags apply OR logic on top
- `custom-series-tags:empty` hidden via CSS to avoid blank space

## What Not to Break
- Atomic file writes (tmp → rename) for all JSON files
- `sync_lock` and `details_lock` threading guards
- `WERKZEUG_RUN_MAIN` guard prevents double thread start in debug mode
- Match `href` field used for VLR.gg modal link
- `customSeriesFilters` must be declared before `applyFilters()` is called on init (TDZ risk)
- `players` format check: re-fetch if `"all"` key missing or old `{team1, team2}` format
