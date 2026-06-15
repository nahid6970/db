# Recent Development Log
All sessions recorded here — no archiving, full history in one place.

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

**Known Issues:**
- MEGA decryption is client-side; large galleries may experience slow initial preview loads.

*Next session: Optimize MEGA decryption performance or add more customization options.*
