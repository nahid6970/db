# VLR BST — Developer Guide

## Setup
```bash
pip install flask requests beautifulsoup4
python app.py
# → http://localhost:5025
```

## Project Structure
```
vlr/
├── app.py                  # Flask server
├── scraper.py              # VLR.gg scraper + data pipeline
├── matches.db              # SQLite match cache (gitignored)
├── matches.json            # Legacy export/backup cache (gitignored)
├── matches.backup.json     # Manual backup (gitignored)
├── settings.json           # User preferences (gitignored)
├── ignorelist.json         # Ignored tournaments [{name, logo}]
├── templates/index.html    # Jinja2 template
├── static/
│   ├── css/style.css
│   ├── js/main.js
│   └── images_cache/       # Downloaded logos (gitignored)
└── md/
    ├── AI_CONTEXT.md
    ├── RECENT.md
    ├── PROBLEMS_AND_FIXES.md
    └── dev.md              # (this file)
```

## Data Flow
1. User clicks SYNC → `GET /api/matches?start=N&end=M` → `fetch_and_update_matches(start_page, end_page)`
2. Scraper upserts `matches.db`; detail pages (logos, timestamps) are fetched lazily on match open
3. `GET /` queries only the visible tournaments from SQLite and renders the filtered matches
4. JS handles live countdowns, sidebar filters (year/series/custom tags), checkbox state, theme

## Key Files
- #[[file:md/AI_CONTEXT.md]]
- #[[file:md/RECENT.md]]
- #[[file:md/PROBLEMS_AND_FIXES.md]]
