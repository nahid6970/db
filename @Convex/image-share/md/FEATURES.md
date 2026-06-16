# Feature Specifications

## Paint Editor
**Status:** ✅ Complete
**Description:** Full-screen paint/annotation editor for Convex-stored images, opened from the lightbox.
**Implementation:**
- Toolbar: Brush, Eraser, Color picker, Size slider, Zoom slider (20–300%), Undo, Save, Close — all in one row.
- Canvas draws at full image resolution; zoom only affects display size.
- Save: flattens to white background, uploads as JPEG, preserves original folder, deletes original image.
- Only available for Convex-stored images (not MEGA/Cloudinary/PDFs).
**Files Involved:** `index.html`

## Folder Style Customization
**Status:** ✅ Complete
**Description:** Per-folder customization of background color, text color, border color, bold, italic, and font size.
**Implementation:** Color modal accessible via right-click context menu on any folder or subfolder. Styles stored in Convex and applied to both folder chips in the sidebar and subfolder cards in the gallery.
**Fields:** `bgColor`, `fgColor`, `borderColor`, `fontBold`, `fontItalic`, `fontSize`
**Files Involved:** `index.html`, `convex/images.ts`

## Live Cross-Device Folder Sync
**Status:** ✅ Complete
**Description:** Active folder is synced across devices in real-time via Convex subscriptions.
**Implementation:** Uses `window._lastAppliedRemoteFolder` to suppress write-back echo (prevents the device that changed the folder from re-navigating when its own write comes back as a subscription update). Other devices see the change immediately.
**Files Involved:** `index.html`

## Hidden-from-All Folders (opacity indicator)
**Status:** ✅ Complete
**Description:** Folders/subfolders hidden from All view appear at 45% opacity in the sidebar and gallery. Tooltip says "Hidden from All view".
**Files Involved:** `index.html`

## Subfolder Hide from All
**Status:** ✅ Complete
**Description:** Subfolders can be hidden from the All section, same as top-level folders.
**Files Involved:** `index.html`

## Recursive Folder Dropdown
**Status:** ✅ Complete
**Description:** Folder picker popup, image move dropdown, and settings folder select now show all nesting levels with indented labels.
**Files Involved:** `index.html`

## Bulk Move via Dropdown
**Status:** ✅ Complete
**Description:** When multiple images are selected, changing the folder via any selected image's dropdown moves all selected images to that folder.
**Files Involved:** `index.html`

## Shift+Hover Toggle Selection
**Status:** ✅ Complete
**Description:** Holding shift and hovering over images toggles their selection state.
**Files Involved:** `index.html`

## MEGA Integration
**Status:** ✅ Complete
**Description:** Support for using MEGA.nz as an image storage provider.
**Implementation:** Uses `megajs` library for file uploads and client-side decryption of image previews.
**Files Involved:** `index.html`, `convex/images.ts`

## Multi-Storage Support
**Status:** ✅ Complete
**Description:** Seamless switching between Cloudinary, Convex, and MEGA.
**Files Involved:** `index.html`, `convex/images.ts`

## UI Theme Customization
**Status:** ✅ Complete
**Description:** Customize colors of storage provider indicators. Colors persisted in Convex settings.
**Files Involved:** `index.html`, `convex/images.ts`


