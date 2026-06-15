# Problems & Fixes Log

## [2026-06-15] - Hide from All Missing for Subfolders
**Problem:** Right-clicking a subfolder showed no "Hide from All" option.
**Root Cause:** The button had `class="top-folder-only"` which hid it for any folder with a `parentId`.
**Solution:** Removed `top-folder-only` class from the hide button; added explicit `hideBtn.style.display = ''` in `openFolderContextMenu` so it always shows.
**Files Modified:** `index.html`

## [2026-06-15] - Folder Dropdowns Only Showed One Level of Subfolders
**Problem:** Folder picker popup, move dropdown, and settings folder select only listed top-level folders and their direct children.
**Root Cause:** All three used `topLevel.flatMap(f => [f, ...children])` — a one-level-deep expansion.
**Solution:** Replaced with a recursive `flattenFolders(parentId, depth)` function in all three locations.
**Files Modified:** `index.html`

## [2026-06-15] - Shift+Hover Could Not Deselect
**Problem:** Hovering over an already-selected image while holding shift did nothing (couldn't deselect).
**Root Cause:** `selectImageByHover` had an early return if `selectedImageIds.has(imageId)`.
**Solution:** Changed to toggle logic — removes from set if present, adds if not.
**Files Modified:** `index.html`

## [2026-05-05 14:45] - UI Breakage after MEGA Status Relocation
**Problem:** The gallery UI stopped working and remained stuck on "Cloudinary" after moving the MEGA status badge.
**Root Cause:** JavaScript code was still trying to access `megaStatusBadge` (which was removed from the HTML), causing a script crash.
**Solution:** Removed dead references to the old badge element and updated the logic to use the new settings-based status display.
**Files Modified:** `index.html`

## [2026-05-05 15:05] - Missing Previews for MEGA Uploads
**Problem:** Uploading images to MEGA resulted in broken icons in the gallery.
**Root Cause:** MEGA public links are not direct image URLs; they require decryption via the MEGA API/library.
**Solution:** Implemented `loadMegaPreview` using `megajs` to fetch, decrypt, and create blob URLs for gallery images.
**Files Modified:** `index.html`
