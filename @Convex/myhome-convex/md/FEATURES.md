# Feature Specifications

---

## Per-Group Password
**Status:** ✅ Complete
**Description:** Each group can have its own password set in the group edit form. Password field uses `type="password"` (hidden characters).
**Implementation:** `group_password` field stored in Convex. Password check: `pwd !== (firstLink.group_password || '1823') && pwd !== '182358'`
**Files Involved:** `convex/schema.ts`, `convex/functions.ts`, `links-handler.js`, `index.html`
**Usage:** Edit group → check "Password" chip → type password → Save (requires master password)

---

## Master Password
**Status:** ✅ Complete
**Description:** Master password `182358` that:
- Unlocks any password-protected group regardless of its own password
- Required to save group settings (any change)
- Required to uncheck the Password protection chip (reverts if wrong)
**Implementation:** Hardcoded in `links-handler.js` and `index.html` change listener.

---

## Settings Panel
**Status:** ✅ Complete
**Description:** ⚙️ button at left of topbar opens a centered modal panel (red border) with app-wide settings. Persisted in `localStorage` under key `myhome-settings`.
**Current Settings:**
- Hide group names — adds `body.hide-group-names` class, CSS hides `h3` in normal groups
- Open links in same tab — when enabled, `handleUrlOpening` uses `window.open(url, '_self')` instead of `_blank`
**Files Involved:** `index.html`, `style.css`, `links-handler.js`

---

## Static Version Label
**Status:** ✅ Complete
**Description:** A small label in the topbar (left of ⚙️) showing the current version text (e.g. `v1`, `v2`). Change it before each push to verify GitHub Pages has deployed the latest version.
**Implementation:** Plain `<div id="version-badge">` in topbar. No JS logic — purely static text.
**Helper:** `set_version.py` — PyQt6 GUI to update the label without opening a text editor.
**Files Involved:** `index.html`, `set_version.py`
**Usage:** Run `python set_version.py`, type new label, click Save, then push.

---

## Custom Password Modal
**Status:** ✅ Complete
**Description:** All password prompts use a custom modal with `<input type="password">` instead of browser `prompt()`. Characters are hidden as dots.
**Implementation:** `window.promptPassword(message)` returns a Promise. Resolves with the entered value or `null` on cancel. Enter/Escape key support.
**Files Involved:** `index.html`, `links-handler.js`

---

## Auto Fit (Link Items)
**Status:** ✅ Complete
**Description:** Toggle in Edit Link form that removes the default item box padding/min-size and shrinks the item to exactly wrap its content (icon, SVG, NerdFont, text).
**Implementation:** `li_auto_fit` boolean field. When true: `min-width:0; min-height:0; padding:0; width:fit-content; height:fit-content` applied to the `li` element.
**Files Involved:** `convex/schema.ts`, `convex/functions.ts`, `links-handler.js`, `index.html`
**Usage:** Edit Link → check "Auto Fit" chip → Save

---

## Format Painter
**Status:** ✅ Complete
**Description:** Copy styling from one link item and paste it to another.
**Implementation:** Plain `<script>` in `index.html` (IIFE, not in app.js module). Captures 14 style fields on 📋 click, applies them on 🎨 click. Persisted in `localStorage`.
**Files Involved:** `index.html`, `style.css`
**Usage:** Edit Link popup → click 📋 to copy current item's styles → open another link → click 🎨 to paste
**Style Fields Captured:** color, background-color, li-bg-color, li-hover-color, li-border-color, li-border-radius, border-radius, font-family, font-size, width, height, li-width, li-height

---

## Group Types
**Status:** ✅ Complete
**Description:** Three group display modes with different behaviors.

### Normal Group
- Displays inline with items visible
- Styling: Horizontal Stack Colors section (with Top Group fallback)
- Corner radius: `popup_border_radius`

### Top Group (Collapsible)
- Compact button in top container
- Click opens popup window
- Styling: Top Group Colors section
- Popup styling: Popup Colors section

### Box Group
- Compact button inline with other groups
- Click opens popup window
- Styling: Horizontal Stack Colors section
- Popup styling: Popup Colors section

**Files Involved:** `links-handler.js`, `style.css`, `index.html`

---

## Visual Separators
**Status:** ✅ Complete
**Description:** Horizontal line separators between groups to organize layout.
**Implementation:** Stored as special link entries with `is_separator: true`. Rendered as `flex-basis: 100%` elements.
**Files Involved:** `convex/schema.ts`, `convex/functions.ts`, `links-handler.js`, `style.css`
**Usage:** Right-click group → "Add Separator". Hover separator → click × to delete.

---

## Start on New Line
**Status:** ✅ Complete
**Description:** Force items or groups to start on a new row.
**Implementation:**
- Items: `start_new_line` field — inserts `div.item-line-break` before the item
- Groups: `group_start_new_line` field — inserts line break before the group container
**Files Involved:** `convex/schema.ts`, `convex/functions.ts`, `links-handler.js`, `index.html`

---

## Color Preview System
**Status:** ✅ Complete
**Description:** Live color preview in all color input fields as you type.
**Implementation:** `applyColorPreview()` function in `index.html` inline script. Sets input background to the typed color, adjusts text color for contrast.
**Files Involved:** `index.html`, `style.css`
**Usage:** Type any color value (hex, rgb, named) in a color field → instant preview

---

## Group Picker Dropdown
**Status:** ✅ Complete
**Description:** Dropdown button (▼) on group input fields to select from existing groups.
**Files Involved:** `links-handler.js`, `index.html`
**Usage:** Click ▼ next to any Group input field

---

## Multiple URLs Per Link
**Status:** ✅ Complete
**Description:** Each link can have multiple URLs. Dynamic add/remove fields.
**Implementation:** `getAllUrls()` collects all URL inputs; `populateUrlFields()` loads them.
**Files Involved:** `links-handler.js`, `index.html`

---

## Display Types
**Status:** ✅ Complete
**Description:** Links can display as text, NerdFont icons, images, or inline SVG.
**Files Involved:** `links-handler.js`
**Usage:** Select type radio in Add/Edit Link form

---

## Password Protection
**Status:** ✅ Complete
**Description:** Groups can be password-protected. Password: `1823`
**Files Involved:** `links-handler.js`

---

## Drag-and-Drop Group Reordering
**Status:** ✅ Complete
**Description:** Drag groups to reorder. Order persists after refresh via `group_order` field.
**Implementation:** `saveGroupOrder()` detects all groups by `dataset.groupName`, saves order to Convex with 300ms delay.
**Files Involved:** `links-handler.js`, `convex/functions.ts`

---

## Chrome Extension
**Status:** ✅ Complete
**Description:** Add links via browser right-click context menu or extension popup.
**Files Involved:** `chrome-extension/`
**Usage:** See `chrome-extension/README.md`

---

## YouTube oEmbed Title Fetching
**Status:** ✅ Complete
**Description:** Auto-fetches YouTube video titles using the oEmbed API (no API key needed).
**Files Involved:** `convex/actions.ts`

---

## Reminder System
**Status:** ✅ Complete
**Description:** Set reminders on links with custom duration or specific date/time. Supports one-time and continuous repeat.
**Files Involved:** `links-handler.js`, `index.html`, `convex/schema.ts`, `convex/functions.ts`

---

## Sidebar Button Notification Badges
**Status:** ✅ Complete
**Description:** Topbar buttons can show a notification badge with an unseen count fetched from an external API endpoint.
**Implementation:** `has_notification` boolean on the button. When true, button is wrapped in `.notification-button-container` with a badge `<span>`. `initNotificationBadges()` fetches `notification_api` on page load and updates badge count. Click: if count > 0, confirms then POSTs to `mark_seen_api` before opening URL.
**Files Involved:** `sidebar-handler.js`, `style.css`, `index.html`, `convex/schema.ts`
**Usage:** Edit sidebar button → check "Has Notification Badge" → fill in Notification API URL and Mark Seen API URL → Save

---

## Cyberpunk Popup Styling
**Status:** ✅ Complete
**Description:** All add/edit popups use a cyberpunk dark theme — black background, neon green borders, red close button, custom checkbox/radio styling.
**Files Involved:** `style.css`

---

## Sidebar Buttons
**Status:** ✅ Complete
**Description:** Customizable sidebar buttons with icon/image/SVG display types and custom styling.
**Files Involved:** `sidebar-handler.js`, `index.html`, `style.css`

---

## YouTube Update Notifications
**Status:** ✅ Complete
**Description:** Automatically detects new video uploads for YouTube channels and displays a notification badge with the new video count.
**Implementation:** 
- **Per-Item Toggle:** Tracking is enabled or disabled per saved item, not globally per channel.
- **Auto-Detection:** Resolves `youtube_channel_id` from YouTube URLs using multiple HTML and URL fallback patterns.
- **Baseline Initialization:** When tracking is enabled, the current latest upload is stored as the baseline so older videos are not counted as new.
- **Backend Action:** `checkYouTubeUpdates` scrapes the channel's `/videos` page and extracts video IDs from embedded JSON (RSS feed was shut down by YouTube).
- **Background Check:** Runs 3s after page load, then every 30 minutes while the tab is open.
- **Parallel Fetching:** Up to 5 channels checked simultaneously; duplicate channel+lastVideoId pairs share one request.
- **Reset Logic:** Clicking the link to visit the channel resets the count to 0 via `updateYouTubeStatus` mutation.
- **UI:** A red badge at the **bottom-left** of the item shows the number of new videos. If tracking is enabled and there are no unseen videos, a small yellow dot is shown instead.
- **`window.convexAction`** helper defined in `links-handler.js` (and `app.js`) using string paths — does not depend on `window.api`.
**Files Involved:** `convex/schema.ts`, `convex/functions.ts`, `convex/actions.ts`, `links-handler.js`, `app.js`, `style.css`

---

## Known Limitations

- **Group Width with Line Breaks:** When items use "Start on New Line", the group border stays as wide as all items in a single row. CSS `fit-content` doesn't shrink correctly with flex line breaks. See `md/PROBLEMS_AND_FIXES.md` for investigation notes.
