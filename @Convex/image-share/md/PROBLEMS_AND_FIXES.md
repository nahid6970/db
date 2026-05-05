# Problems & Fixes Log

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
