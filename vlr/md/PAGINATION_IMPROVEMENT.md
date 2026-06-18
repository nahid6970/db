# Pagination Improvement — Future Implementation

## Current State (Option B)
- Server filters matches by `unchecked_tournaments` before paginating
- `/?page=N` URL-based pagination — correct page count, correct matches
- Checking/unchecking a tournament triggers `window.location.href = "/"` (full page reload to page 1)
- **Tradeoff:** sidebar scroll position is lost on tournament check/uncheck

## What Was Wanted
- Checking/unchecking a tournament updates **only the match cards** — no full page reload
- Sidebar scroll position preserved
- Pagination prev/next still works and reflects the current filter

---

## Approach: Client-Side Pagination + Filtered API

### How It Works
1. Server always renders all matches (no server-side per_page slicing)
2. JS `applyFilters()` marks filtered-out cards with `data-filtered-out="1"` and hides them
3. `applyPagination()` reads only non-filtered cards, slices by page, renders prev/next bar
4. On tournament check/uncheck: save settings → `applyFilters()` → pagination resets to page 1 — no reload

### Key Changes

**`app.py`**
- Remove server-side `unchecked_tournaments` filtering from index route
- Remove per_page slicing (or keep as a hard cap for "all" case)
- Remove Jinja pagination template block

**`main.js`**
- `applyFilters()` sets `data-filtered-out="0"/"1"` instead of `display:none/flex`
- `applyPagination()`:
  - Reads `visibleCards = cards.filter(c => c.getAttribute("data-filtered-out") !== "1")`
  - Slices by `currentPage` and `perPage`
  - Renders `#js-pagination` bar with Prev/Next buttons
  - Called from `applyFilters()` with `resetPage=true`
- `saveTournamentSettings()`: remove `window.location.href = "/"` — just save + `applyFilters()`
- `perPageSelect` change: reset `currentPage = 1`, call `applyFilters()`

**`style.css`**
- Keep `.pagination`, `.page-btn`, `.page-info` CSS (already exists)

**`index.html`**
- Remove `{% if total_pages > 1 %}...{% endif %}` Jinja pagination block
- Remove `page`, `total_pages`, `total_matches` from `render_template` call

### Performance Note
Without server-side per_page slicing, "all" will render all match cards in HTML again.
To avoid this, keep a server-side hard cap (e.g. 500 matches max) regardless of per_page,
and rely on JS pagination for the rest.

### Why Not Done Yet
The client-side approach was implemented and tested but reverted because:
- It conflicted with the existing `applyPagination` which used `display:none` to track visibility
- `applyFilters` and `applyPagination` shared the same `display` property causing conflicts
- Required more careful coordination between filter state and pagination state
