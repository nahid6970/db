# Recent Development Log
All sessions recorded here — no archiving, full history in one place.

## [2026-06-16 00:00] - Paint Editor, Folder Styling, UI Polish
**What We Accomplished:**

### Paint Editor
- Added full-screen paint editor modal (`#paintModal`) with Brush/Eraser tools, color picker, size slider, zoom slider, Undo, Save, and close button — all in a single toolbar row.
- Paint button (`#lbPaint`) added to lightbox actions bar; only shown for Convex-stored images (not MEGA/Cloudinary/PDFs).
- `openPaintEditor(id, url, filename, folderId)` fetches image as blob (avoids canvas taint), draws onto canvas.
- `savePaint()` flattens to white bg, uploads via `generateUploadUrl`, calls `saveStorageImage` with original `folderId`, then removes original.
- Fixed: `client` and `api` were scoped inside another IIFE — exposed as `window._convexClient` and `window._convexApi`.
- Fixed: saved image now stays in the same folder as the original.
- Zoom slider (20–300%) added; drawing coordinates still map correctly via canvas/display ratio.

### Folder Chip UI
- Removed fixed `min-height` from `.folder-chip`; chips now size from padding + content.
- `line-height: 1.4` prevents descender clipping (g, j, p, q, y).
- Folder bar changed to `align-items: stretch` so chips on the same row share equal height.
- Lock icon and hidden-dot indicator now inline inside chip span so text+indicator group centers together.

### Hidden-from-All Indicator
- Replaced grey dot indicator with `opacity: 0.45` on the chip/card.
- Applied to both folder chips and subfolder cards.
- Tooltip still says "Hidden from All view".

### Folder Color Customization
- Added **Border Color** picker to the folder style modal (bg, text, border).
- Border color stored in Convex via new `borderColor` field on `updateFolder` mutation.
- Removed `border-color` override that was matching bg color (made border invisible).
- Border color applied to both folder chips and subfolder cards.
- Number input spinner arrows hidden globally via CSS.
- Removed `top-folder-only` class from Colors button — subfolders now support color/font styling.
- Subfolder cards in gallery now render bg/text/border/bold/italic/fontSize styles.

### Folder Bar Jiggle / Settings Write Loop Fix
- Removed `persistUiState()` calls from inside Convex subscription callbacks.
- `remoteFolderId` now only set on first settings hydration (`isFirstSettings` flag).
- `normalizeCurrentFolderId()` only runs on first folder load (`firstLoad` flag).
- Removed `applyPersistedUiState()` call from folder subscription callback.
- `persistUiState` debounced at 600ms to reduce write conflicts.
- Live cross-device folder sync: `window._lastAppliedRemoteFolder` tracks last applied value to suppress write-back echo while allowing other devices' changes through.

### PDF Export Button
- Moved from folder bar text to top bar icon button (`#exportPdfBtn`).

**Files Modified:**
- `index.html`
- `convex/images.ts` (added `borderColor` to `updateFolder`)

## [2026-06-15 11:25] - Subfolder Improvements & Selection Fixes
**What We Accomplished:**
- Fixed "Hide from All" context menu button now appears for subfolders (was `top-folder-only` only).
- Subfolder cards now show a `hidden-dot` indicator when hidden from All view.
- Fixed folder dropdowns (`getFolderOptions`, `getFolderPickerItems`, settings modal) to recursively show all nesting levels beyond depth-1 with proper indentation.
- Moving images via the folder dropdown now moves all selected images when the target image is part of a multi-selection.
- Fixed shift+hover selection to toggle (deselect if already selected) instead of add-only.

**Files Modified:**
- `index.html`

## [2026-05-07 10:15] - Icon-Only Unified Settings/Storage Button
**What We Accomplished:**
- Removed the explicit storage provider text ("Cloudinary", etc.) from the settings button.
- Refactored the button to be an icon-only element that uses dynamic CSS colors (background/border) to indicate the active storage provider.
- Simplified the top bar further by reducing text clutter while maintaining visual status feedback.

**Files Modified:**
- `index.html`: Removed text elements and updated JavaScript color-application logic.

## [2026-05-07 10:00] - Unified Settings and Storage Badge

## [2026-05-05 17:15] - Tabbed Settings and Dynamic Theme Integration
**What We Accomplished:**
- Refactored Settings modal into a tabbed UI (Storage, Theme, MEGA) [16:45].
- Implemented CSS variables for storage provider colors to enable dynamic styling [17:00].
- Applied custom theme colors to the storage dots next to image names in the gallery [17:05].
- Fixed a bug where theme colors didn't apply to existing gallery items until page reload [17:10].

**Files Modified:**
- `index.html`: Refactored settings UI, implemented tab switching, and added dynamic CSS variable logic.

