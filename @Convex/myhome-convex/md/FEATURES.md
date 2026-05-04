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

## Sidebar Buttons
**Status:** ✅ Complete
**Description:** Customizable sidebar buttons with icon/image/SVG display types and custom styling.
**Files Involved:** `sidebar-handler.js`, `index.html`, `style.css`

---

## Known Limitations

- **Group Width with Line Breaks:** When items use "Start on New Line", the group border stays as wide as all items in a single row. CSS `fit-content` doesn't shrink correctly with flex line breaks. See `md/PROBLEMS_AND_FIXES.md` for investigation notes.
