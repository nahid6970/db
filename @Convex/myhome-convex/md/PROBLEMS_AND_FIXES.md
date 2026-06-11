# Problems & Fixes Log

---

## [2026-06-11] - Group Styling/Position Changes After Item Drag-Drop

**Problem:** After dragging an item within a group (or between groups), the group's CSS styling (colors, borders), position on screen, and layout flags would change unexpectedly.

**Root Cause:** Group properties are denormalized — stored on every item but read only from `items[0]` (the first item of the group in the sorted flat array). `updateAllLinks` deletes all records and re-inserts in flat array order, which reassigns `_creationTime`. The frontend sorts by `_creationTime`, so which item is `items[0]` changes after any reorder. If the new `items[0]` has different/missing group property values (e.g., added before the group was styled, or moved in from another group), the entire group's visual identity changes.

**Solution:** Added normalization in `reorderLinks()` — after splicing, finds the "canonical" item per group (whichever has the most group props set) and copies all group-level fields to all items in that group before saving.

**Files Modified:** `links-handler.js`

---

## [2026-05-15] - Links Ignoring "Open in Same Tab" Setting

**Problem:** Setting `a.target = '_self'` had no effect — links still opened in a new tab.

**Root Cause:** `a.onclick` calls `e.preventDefault()` then `handleUrlOpening()`, which always used `window.open(url, '_blank')`. The `a.target` attribute is irrelevant when `preventDefault` is called.

**Solution:** Updated `handleUrlOpening()` to read `localStorage('myhome-settings').openSameTab` and use `_self` or `_blank` accordingly.

**Files Modified:** `links-handler.js`

---

## [2026-05-15] - Local File Extension Opening Not Working

**Problem:** Clicking `file:///` links on GitHub Pages showed the extension error message even after implementing `openLocalFileViaExtension`.

**Root Cause:** The chrome extension bridge approach was unreliable — extension not always active, message passing timing issues.

**Solution:** Removed extension-based approach entirely. Now copies the URL to clipboard and opens `about:blank` in a new tab. User presses Ctrl+V + Enter to navigate.

**Files Modified:** `links-handler.js`, `sidebar-handler.js`

---

## [2026-05-04] - Wrong Password alert() Blocking UI

**Problem:** Entering a wrong group password showed a browser `alert()` dialog requiring a click to dismiss, making it annoying especially on repeated attempts.

**Solution:** Replaced all `alert('Incorrect password!')` and `alert('Incorrect master password.')` calls with `window.showNotification(..., 'error')` toast notifications that auto-dismiss.

**Files Modified:** `links-handler.js`, `index.html`

---

## [2026-05-04] - Format Painter Not Working

**Problem:** 📋/🎨 buttons in Edit Link popup did nothing when clicked.

**Root Cause:** Format painter code was inside `app.js` which is `type="module"`. If the Convex `import` fails or errors, the entire module silently fails and `window.formatPainter` is never set. The `onclick` attributes then call an undefined function.

**Solution:** Moved format painter entirely out of `app.js` into a plain `<script>` tag at the bottom of `index.html`, independent of the Convex module.

**Files Modified:** `index.html`, `app.js`

---

## [2026-02-25] - Border Colors Not Showing on Groups

**Problem:** Custom border colors set in group settings were not appearing for Normal and Box groups.

**Root Cause:** CSS had a hardcoded blue fallback color that overrode custom values. Border width was inconsistent (1px vs 2px).

**Solution:** Removed hardcoded fallback from CSS. Standardized all group borders to `2px solid`. Applied `style.borderColor` directly in JS.

**Files Modified:** `links-handler.js`, `style.css`

---

## [2026-02-25] - Group Conversion Reference Error

**Problem:** Converting a group between types (Normal ↔ Box ↔ Top) threw a JS reference error.

**Root Cause:** Variable referenced before declaration in the conversion handler.

**Solution:** Fixed variable declaration order in `openEditGroupPopup()`.

**Files Modified:** `links-handler.js`

---

## [2026-02-22] - Chrome Extension 404 Error

**Problem:** Chrome extension failed to add links with a 404 error.

**Root Cause:** Wrong Convex HTTP API endpoint format. Was using `/api/mutation/functions:addLink`, should be `/api/mutation` with `path` in the request body.

**Solution:** Updated endpoint format in both `background.js` and `popup.js`.

**Files Modified:** `chrome-extension/background.js`, `chrome-extension/popup.js`

---

## [2026-02-22] - YouTube Title Fetching (HTTP 429)

**Problem:** YouTube video URLs showed "youtube.com" as the title instead of the actual video title.

**Root Cause:** YouTube rate-limits/blocks server-side fetch requests from Convex backend (HTTP 429).

**Solution:** Used YouTube oEmbed API (`https://www.youtube.com/oembed?url=...&format=json`) which is designed for third-party integrations and doesn't require an API key.

**Files Modified:** `convex/actions.ts`

---

## [2026-02-22] - Context Menu Appearing Far From Cursor

**Problem:** Right-click context menu appeared far from where the user clicked.

**Root Cause:** Used `pageX/pageY` (includes scroll offset) instead of `clientX/clientY`.

**Solution:** Switched to `clientX/clientY` and added viewport boundary detection so menu stays within screen bounds.

**Files Modified:** `context-menu.js`

---

## [2026-02-22] - Image Width/Height Not Applied

**Problem:** Custom width/height values for image-type links were ignored.

**Root Cause:** Code set `img.width` (HTML attribute, integers only) instead of `img.style.width` (CSS, supports "px" strings).

**Solution:** Changed to `img.style.width` and `img.style.height`.

**Files Modified:** `links-handler.js`

---

## [2026-02-21] - Group Order Not Persisting After Drag-and-Drop

**Problem:** Group order reset to default on page refresh after drag-and-drop reordering.

**Root Cause (3 issues):**
1. `renderLinks` used `Object.keys()` for Regular groups (unstable order) instead of the sorted array
2. `saveGroupOrder` used strict CSS class checks, missing groups dragged between containers
3. DOM not fully settled when save fired (100ms delay too short)

**Solution:**
1. Used `sortedGroupNames` array for all group types in `renderLinks`
2. Rewrote `saveGroupOrder` to detect groups by `dataset.groupName` regardless of container
3. Added stable sort fallback (alphabetical) for equal order values
4. Increased save delay to 300ms

**Files Modified:** `links-handler.js`

---

## [2026-02-21] - Start on New Line Affecting All Items in Group

**Problem:** Setting "Start on New Line" on a group caused all items inside to stack vertically.

**Root Cause:** The same `start_new_line` field was used for both groups and individual items. When saved to a group, it propagated to all items.

**Solution:** Added separate `group_start_new_line` field in schema. Group edit popup saves to this field; item rendering only checks `start_new_line`.

**Files Modified:** `convex/schema.ts`, `convex/functions.ts`, `links-handler.js`, `index.html`

---

## [2026-02-19] - window.convexMutation is not a function

**Problem:** App threw "window.convexMutation is not a function" on load.

**Root Cause:** `app.js` was missing the Convex client initialization code. Helper functions weren't set on `window` before other scripts tried to use them.

**Solution:** Restored Convex client setup in `app.js`, added `window.convexQuery` and `window.convexMutation` helpers, added `convexReady` event.

**Files Modified:** `app.js`, `links-handler.js`, `sidebar-handler.js`
