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
├── app.py                  # Flask server + background sync
├── scraper.py              # VLR.gg scraper + data pipeline
├── matches.json            # Match cache (auto-generated)
├── settings.json           # User tournament filter preferences
├── templates/index.html    # Jinja2 template
├── static/
│   ├── css/style.css
│   ├── js/main.js
│   └── images_cache/       # Downloaded logos
└── md/
    ├── AI_CONTEXT.md       # Stable project brief for AI handoff
    ├── RECENT.md           # Dev session log (full history)
    ├── PROBLEMS_AND_FIXES.md
    └── (this file) dev.md
```

## Data Flow
1. `scraper.fetch_and_update_matches()` scrapes VLR.gg → upserts `matches.json`
2. Detail pages (team logos, exact timestamps) fetched in background thread
3. `app.get_matches_for_display()` reads cache, sorts, adds `js_timestamp`
4. Template renders server-side; JS handles live countdowns, filters, sync

## Key Files
- #[[file:md/AI_CONTEXT.md]]
- #[[file:md/RECENT.md]]
- #[[file:md/PROBLEMS_AND_FIXES.md]]
