# Recent Development Log
All sessions recorded here — no archiving, full history in one place.

## [2026-06-29 08:30] - Paint Editor Enhancements: Redo, Shortcuts, PDF Page Indicator, Dynamic Color Palette, EyeDropper & Multi-rule Text Recolor Tool

### Redo Capabilities & Shortcuts
- Created a `_redoHistory` stack to track undone canvas actions.
- Draw actions clear the redo stack; undo moves the canvas state to the redo stack.
- Global key listeners inside Paint Editor: `Ctrl + Z` for Undo and `Ctrl + Y` for Redo.

### PDF Editing
- Integrated `pdf-lib` via CDN to allow saving drawings back to original PDF pages as overlayed transparent PNG slices, preserving selectable text layers.
- Wrapped paint canvases inside a container (`#paintCanvasContainer`) scaling uniformly on zoom (`width: 100%`) to prevent stretching.
- Added dynamic page indicator (`# / total`) that computes current centered page by comparing scroll viewport offset with zoomed page dimensions. Updates on scroll and zoom.
- Persists the exact vertical scroll ratio individually for *every* PDF file (using localStorage keyed by file ID `_paintId` to store `scrollTop / containerHeight`), automatically restoring the exact pixel-perfect scroll position when reopened (zoom-independent).

### Zoom Persistence
- Persists and restores last zoom level from `localStorage` (`image-share.paintZoom`).

### Dynamic Color Palette
- Replaced basic native color input with a custom dropdown grid showing 20 pre-selected swatches.
- Contains a "Custom Color..." button at the bottom to trigger the native picker on demand.
- Automatically closes picker when clicking outside.
- Resized the color button in the toolbar to a compact `24px` by `20px` to match the general height of text actions, and removed the "Color:" text label to declutter the toolbar.
- Added a `transparent` color swatch option (rendered as a dark-mode checkerboard pattern). Selecting this mode enables "Highlight-only Recoloring" where drawing bounding boxes displays a temporary dashed drag outline and recolors matching text internally without altering the document background at all.

### Text Tool Improvements
- Upgraded the text shape tool to replace the basic native `prompt()` dialog with an absolute `<textarea>` overlay positioned directly on the canvas at the click location.
- Textarea dynamically resizes to accommodate multiline text inputs and matches the selected font size, zoom scale, and active drawing color on screen.
- Commits multiline text blocks on blur or `Ctrl + Enter` (calculating line heights automatically to write multiple clean rows on the canvas), and discards on `Escape`.

### Multi-Rule Text Recolor (▭T)
- Replaced inline color inputs with a rule manager popup panel (`#paintRecolorRulesPopup`) toggled by a `▭T` button in the toolbar.
- Active toggle (`Recolor Text` checkbox) highlights the `▭T` button in green (`#22c55e`) when enabled.
- Dynamically add rules as rows with individual active toggle checkboxes, a Scan color picker, a Target color picker, and a Tolerance ratio (Tol %) number input.
- Tolerance ratio matches lower and higher shades of a text color to cleanly capture anti-aliased borders (scaled L1 distance matching).
- Integrates browser-native EyeDropper API (`🎯` button) to capture scan colors directly from any pixel on the document or screen.
- Scans background pixels inside drawn highlighter/filled rect boxes and swaps text colors in a single pass on mouse release.
- Persists all recolor rules (swatch inputs, checkboxes, tolerances) and the active state in the Convex DB `settings` table (`paintRecolorRules` and `paintRecolorActive` fields) with local storage cache fallback, ensuring settings are synced globally and remembered across page reloads/refreshes.

### Save Options
- Added a blue "Save As" button next to "Save" in the Paint Editor toolbar.
- "Save As" uploads and inserts a new separate copy of the drawing (appending `_edited` to the filename before the extension), preserving the original file.
- "Save" continues to perform the default overwrite action (uploading and registering the drawing, and then removing the original file).

## [2026-06-16 22:00] - Move Storage Feature, Dedup Upload, Convex Call Optimizations

### Move Storage Button
- Added green action dot on every image card → opens storage picker popup (Cloudinary / Convex / MEGA).
- Green arrow button appears in toolbar when images are selected (bulk move).
- `openStoragePickerPopup(event, imageId)` — single image or null for bulk (uses `selectedImageIds`).
- `confirmStorageMove(targetStorage)` — downloads file from current storage, uploads to target, updates same DB record via `updateImageStorage` mutation (no duplicate record created).
- Moving from Convex: old file deleted from Convex file storage automatically inside the mutation.
- Moving from MEGA: uses existing `getMegaBlobUrl` for decryption before download.
- Status bar shows progress: "Moving 1/N: filename..." and final count.

### Dedup on Upload
- `performUpload` checks `window._lastImages` for matching `filename + fileSize` before any upload.
- If duplicate found: skips upload, shows "Skipped duplicate: filename" in amber. Returns `true` so progress counter still advances.
- Applied to all storage types (Cloudinary, Convex, MEGA).

### Convex Function Call Optimizations
- `persistUiState` dirty-check: serializes storageType/mega/colors/sortOrder to JSON, skips mutation if unchanged. Prevents echo-writes after settings subscription fires.
- `_lastPersistedFolderId` tracked separately so folder changes still write (cross-device sync preserved).
- `subscribeToImages` dedup: tracks `window._lastImageSubKey`; skips re-subscription if folderId unchanged.
- `subscribeToSettings` guard: `_lastSettingsKey` tracks remoteSort+remoteFolder; `applyPersistedUiState` only called when something actually changed.
- Seed `_lastPersistedState` and `_lastPersistedFolderId` on first settings load to prevent immediate echo-write of what was just read.

### Backend
- Added `getStorageUrl` query: resolves a `storageId` to a public URL.
- Added `updateImageStorage` mutation: patches `url` + `storageId` on existing record, deletes old Convex file if present. Resolves URL server-side when only `storageId` provided.

**Files Modified:**
- `index.html`
- `convex/images.ts`

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

