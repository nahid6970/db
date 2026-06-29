# Feature Specifications

## Move Storage (Per-Image & Bulk)
**Status:** ✅ Complete
**Description:** Move any image(s) from one storage provider to another without creating a new record.
**Implementation:**
- Green action dot on each card opens a storage picker popup (Cloudinary / Convex / MEGA).
- Green arrow button appears in top toolbar when multiple images are selected (bulk move).
- Downloads file from current storage, uploads to target, updates the same DB record (`updateImageStorage` mutation).
- Moving from Convex: old file is deleted from Convex file storage inside the mutation.
- Moving from MEGA: uses `getMegaBlobUrl` for client-side decryption before download.
**Files Involved:** `index.html`, `convex/images.ts`

## Dedup Upload Prevention
**Status:** ✅ Complete
**Description:** Before uploading any file, checks if an image with the same filename and file size already exists in the gallery. If so, skips the upload.
**Implementation:** Checked in `performUpload` against `window._lastImages`. Shows amber "Skipped duplicate" status message. Applies to all storage types.
**Files Involved:** `index.html`

## Convex Function Call Optimizations
**Status:** ✅ Complete
**Description:** Reduces unnecessary Convex function calls (was: getSettings 44K, list 34K, updateSettings 30K).
**Implementation:**
- `persistUiState` dirty-check: skips `updateSettings` mutation if state hasn't changed since last write.
- `subscribeToImages` dedup: skips re-subscription if folderId is unchanged.
- `subscribeToSettings` guard: `applyPersistedUiState` only called when remote sort/folder actually changed.
- Initial settings load seeds the dirty-check state to prevent echo-write.
- Cross-device folder sync preserved: `currentFolderId` changes always write through.
**Files Involved:** `index.html`

## Paint Editor
**Status:** ✅ Complete
**Description:** Full-screen paint/annotation editor for Convex-stored images and PDFs, opened from the lightbox.
**Implementation:**
- Toolbar: Brush, Eraser, Shape Picker (Line, Rectangle, Filled Rectangle, Highlighter, Rounded Rectangle, Curved Arrow, Smilies, Text, etc. -- Text tool opens a canvas-positioned horizontal resizable `contenteditable` rich-text editor with a drag-to-move floating styles toolbar supporting selection-level formatting: Bold, Italic, Underline, and size increase/decrease A-/A+ buttons, close/delete X button, and synchronous chunk-based canvas text rendering to prevent security taints), Size, Zoom, Undo, Save, Close.
- Canvases draw at full image resolution; zoom acts as a CSS-transform on display container to prevent aspect ratio distortion.
- Supports both images and PDF files (with transparent drawing canvas layered on top to preserve original PDF selectable text using `pdf-lib` overlay slice stitching).
- Dynamic page indicator (`currentPage / totalPages`) scroll-aware tracking.
- Remembers exact vertical scroll ratio (`scrollTop / totalHeight`) per document keyed by filename in `localStorage` and automatically restores it to preserve pixel-perfect viewport alignment across sessions and saves.
- Remembers last used zoom value via `localStorage`.
- Includes Undo/Redo stack with global keyboard shortcuts (`Ctrl + Z` / `Ctrl + Y`).
- Custom dropdown color chooser with 20 preselected swatches and custom picker fallback (compact `24x20px` button in toolbar, "Color:" text label removed). Includes a `transparent` option to perform region-based text recoloring without drawing/filling background shapes.
- Multi-rule Text Recolor tool (`▭T` toggle button in toolbar) to scan and replace text colors inside highlighted regions using L1 color distance with custom tolerances.
- Integrates EyeDropper tool (`🎯` button) for picking scan colors from document pixels.
- Persists all recolor rules (active state, row toggles, colors, and tolerances) in the Convex DB `settings` table (with local storage cache fallback) to retain setup across reloads/devices.
- Save:
  - **Save:** Overwrites the original file in the DB, preserves original folder location, and deletes original image.
  - **Save As:** Saves drawings as a separate new file copy (appending `_edited` to filename before extension), keeping original document intact.
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


