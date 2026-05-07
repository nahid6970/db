# Feature Specifications

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

