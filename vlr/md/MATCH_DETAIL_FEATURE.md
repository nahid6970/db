# Match Detail Feature — Future Implementation

## Overview
Currently clicking a match card opens VLR.gg in a new tab.
When implemented: clicking a card opens an in-app detail modal/panel showing full match stats, with a "View on VLR.gg" button.

---

## Behaviour Change
| Now | After |
|-----|-------|
| Click card → opens VLR.gg tab | Click card → opens detail modal |
| — | Modal has "View on VLR.gg ↗" button |

---

## Data to Scrape (from existing detail page — already fetched in background)
We already GET `/12345/team-a-vs-team-b`. Just parse more from the same response.

**Map results**
- Map name, team scores per map, winner

**Player stats per map (or overall)**
- Player name, player photo (cached locally like team logos), agent(s), ACS, K/D/A, HS%, KAST, ADR, FK/FD

**Only available for Completed matches.** Upcoming/Live have no stats yet.

---

## Scraper Changes (`scraper.py`)
- In `fetch_match_detail_page()`, parse additional sections from the already-fetched soup
- Add `maps: []` and `players: {team1: [], team2: []}` to the returned dict
- Only parse if match status is `Completed`
- Store in `matches.json` under each match ID — file size will grow noticeably

---

## Backend Changes (`app.py`)
- Add `GET /api/match/<match_id>` endpoint returning full detail from `matches.json`
- No extra scrape needed — data already in cache after background thread runs

---

## UI Style (follow `match_detail_mockup.html`)

**Modal layout (top → bottom):**
1. **Header bar** — tournament name (left) · "View on VLR.gg ↗" red button + × close (right)
2. **Scoreline block** — dark bg (`#0f1116`), team logo + name left, `WINNER – LOSER` score centre (winner green, loser grey smaller), team logo + name right
3. **Maps row** — small cards per map, border tinted green (win) or red (loss), map name + `W–L` score
4. **Player stats** — one table per team, columns: Player (photo + name) · Agent icon · ACS (gold if top) · K · D · A · HS% · ADR
   - Player photo: circular, 28px, fallback grey circle
   - Agent icon: 20px rounded square

**Colours (reuse existing CSS vars where possible):**
- Modal bg: `var(--card-bg)` / `var(--bg-darker)` for inner blocks
- Winner score: `#22c55e` · Loser score: `var(--text-muted)`
- Map win border: `#22c55e33` · Map loss border: `var(--accent-red)33`
- Top ACS highlight: `#fbbf24`

**Interaction:**
- Click outside modal → close
- Esc key → close
- Card click → fetch `/api/match/<id>` → populate modal → open overlay

---

## Frontend Changes

**`main.js`**
- Remove `data-href` click-to-open-tab behaviour (or move to the VLR button)
- On card click → fetch `/api/match/<id>` → render detail modal

**`index.html`**
- Add `<div id="match-detail-modal">` with:
  - Team names + logos + score
  - Map-by-map breakdown (map name, score, winner highlight)
  - Player stats table per team (ACS, K/D/A, HS%, ADR)
  - `<a href="https://vlr.gg{href}" target="_blank">View on VLR.gg ↗</a>` button
  - Close button / click-outside to dismiss

**`style.css`**
- Modal overlay, stats table styling, map score cards

---

## Notes
- Stats only shown for `Completed` matches; show a "Match hasn't started yet" placeholder otherwise
- Background detail fetch already runs — stats just need to be parsed and stored alongside logos/timestamps
- Consider lazy-fetching stats only when a match card is first clicked to avoid bloating `matches.json` on every sync
