# Feature Specifications

## Subfolder Hide from All
**Status:** ✅ Complete
**Description:** Subfolders can now be hidden from the All section, same as top-level folders. Hidden subfolders show a grey dot indicator on their card.
**Files Involved:** `index.html`

## Recursive Folder Dropdown
**Status:** ✅ Complete
**Description:** Folder picker popup, image move dropdown, and settings folder select now show all nesting levels (depth 1, 2, 3…) with indented labels.
**Files Involved:** `index.html`

## Bulk Move via Dropdown
**Status:** ✅ Complete
**Description:** When multiple images are selected, changing the folder via any selected image's dropdown moves all selected images to that folder.
**Files Involved:** `index.html`

## Shift+Hover Toggle Selection
**Status:** ✅ Complete
**Description:** Holding shift and hovering over images toggles their selection state — hover selects unselected images and deselects already-selected ones.
**Files Involved:** `index.html`

## MEGA Integration
**Status:** ✅ Complete
**Description:** Support for using MEGA.nz as an image storage provider.
**Implementation:** Uses `megajs` library for file uploads and client-side decryption of image previews.
**Files Involved:** `index.html`, `convex/images.ts`
**Usage:** Configure MEGA credentials in Settings -> MEGA.
**Dependencies:** `megajs` (UMD version via unpkg).

## Multi-Storage Support
**Status:** ✅ Complete
**Description:** Seamless switching between Cloudinary, Convex, and MEGA.
**Implementation:** Dynamic storage type selection stored in Convex `settings`.
**Files Involved:** `index.html`, `convex/images.ts`

## UI Theme Customization
**Status:** ✅ Complete
**Description:** Customize the colors of storage provider indicators (Settings button and gallery dots).
**Implementation:** Integrated color pickers in Settings with live preview. Colors are persisted in Convex `settings` and applied dynamically via RGBA variants.
**Files Involved:** `index.html`, `convex/images.ts`
**Usage:** Open Settings -> UI Theme Colors -> Select color and Save.

