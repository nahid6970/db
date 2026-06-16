# Problems & Fixes Log

## [2026-06-16] - Folder Bar Jiggle / Constant Re-render Loop
**Problem:** Folder bar and subfolder breadcrumb flickered rapidly. `updateSettings` Convex errors every ~2 seconds.
**Root Cause (multi-part):**
1. `applyPersistedUiState()` called on every folder subscription update → it called `persistUiState()` (writes to Convex) → triggers another subscription → infinite loop.
2. `remoteFolderId` re-set on every settings update → `applyPersistedUiState` overwrote `currentFolderId` repeatedly, even after user navigated to a subfolder.
3. `normalizeCurrentFolderId()` ran on every folder update → could reset `currentFolderId = null` if folder momentarily missing → `subscribeToImages()` re-fired → gallery flicker.
**Solution:**
- Removed `persistUiState()` from `applyPersistedUiState` and `normalizeCurrentFolderId`.
- `remoteFolderId` only set on first settings hydration (`isFirstSettings` flag).
- `normalizeCurrentFolderId()` only runs on first folder load (`firstLoad` flag).
- Removed `applyPersistedUiState()` from folder subscription callback.
- Debounced `persistUiState` at 600ms.
**Key Rule:** Never call `persistUiState()` (Convex mutation) from inside a subscription callback.
**Files Modified:** `index.html`
**See Also:** `JIGGLE_FIX.md`

## [2026-06-16] - Live Folder Sync Write-Back Loop
**Problem:** Enabling always-on `remoteFolderId` sync caused the same device to re-navigate when its own write came back as a subscription echo.
**Solution:** Track `window._lastAppliedRemoteFolder`. On folder change: set it before writing. On subscription update: skip navigation if value matches last applied.
**Files Modified:** `index.html`

## [2026-06-16] - Paint Save Fails: `client is not defined` / `api is not defined`
**Problem:** `savePaint()` threw "client is not defined" then "api is not defined".
**Root Cause:** Both `client` and `api` were `const` inside the main app IIFE, not accessible from the paint IIFE.
**Solution:** Exposed as `window._convexClient` and `window._convexApi` immediately after declaration.
**Files Modified:** `index.html`

## [2026-06-16] - Paint Save Moved Image to No Folder
**Problem:** After saving a painted image, it appeared in "No folder" instead of the original folder.
**Root Cause:** `saveStorageImage` was called without `folderId`.
**Solution:** Stored `folderId` in `_paintFolderId` when opening editor, passed to `saveStorageImage`.
**Files Modified:** `index.html`

## [2026-06-16] - Folder Chip Border Invisible on Custom-Colored Folders
**Problem:** Folders with a custom background color showed no visible border.
**Root Cause:** Inline style set `border-color` equal to `bgColor`.
**Solution:** Removed `border-color` from the custom style override; border now always uses CSS default (`#d6dbe1`) unless explicitly set via the new Border Color picker.
**Files Modified:** `index.html`

## [2026-06-16] - Colors Option Missing from Subfolder Context Menu
**Problem:** Right-clicking a subfolder showed no "🎨 Set Colors" option.
**Root Cause:** The Colors button had `class="top-folder-only"` which hid it for any folder with a `parentId`.
**Solution:** Removed `top-folder-only` class from the Colors button.
**Files Modified:** `index.html`

## [2026-06-15] - Hide from All Missing for Subfolders
**Problem:** Right-clicking a subfolder showed no "Hide from All" option.
**Root Cause:** The button had `class="top-folder-only"`.
**Solution:** Removed `top-folder-only` class from the hide button.
**Files Modified:** `index.html`

## [2026-06-15] - Folder Dropdowns Only Showed One Level of Subfolders
**Problem:** Folder picker popup, move dropdown, and settings folder select only listed top-level folders and their direct children.
**Root Cause:** Used `topLevel.flatMap(f => [f, ...children])` — one-level-deep only.
**Solution:** Replaced with recursive `flattenFolders(parentId, depth)`.
**Files Modified:** `index.html`

## [2026-06-15] - Shift+Hover Could Not Deselect
**Problem:** Hovering over an already-selected image while holding shift did nothing.
**Root Cause:** `selectImageByHover` had early return if `selectedImageIds.has(imageId)`.
**Solution:** Changed to toggle logic.
**Files Modified:** `index.html`

## [2026-05-05 14:45] - UI Breakage after MEGA Status Relocation
**Problem:** Gallery UI stopped working after moving the MEGA status badge.
**Root Cause:** JS still referenced removed `megaStatusBadge` element, causing script crash.
**Solution:** Removed dead references.
**Files Modified:** `index.html`

## [2026-05-05 15:05] - Missing Previews for MEGA Uploads
**Problem:** Uploading images to MEGA resulted in broken icons in the gallery.
**Root Cause:** MEGA public links require decryption via the MEGA API/library.
**Solution:** Implemented `loadMegaPreview` using `megajs`.
**Files Modified:** `index.html`

