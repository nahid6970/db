# UI/UX Design & Guidelines

## Top Bar Controls
**Layout:** Sticky top bar containing upload zone, clear/download buttons, and settings.
**Recent Change:** Moved the active storage badge ("Cloudinary/MEGA") from the bottom of the controls to directly beside the settings button for better vertical space utilization.

## Settings Modal
**Layout:** Tabbed interface with three sections:
1. **Storage:** Core storage provider selection.
2. **Theme:** Personalization window for storage badge colors.
3. **MEGA:** Advanced configuration for MEGA.nz integration.
**Rationale:** Reduces cognitive load by grouping related settings and allowing the user to focus on one "window" at a time.

## Dynamic Theming
**Implementation:** Uses CSS variables (`--color-cloudinary`, etc.) injected via JavaScript.
**Application:** Custom colors apply to:
- The main **Active Storage Badge**.
- The **Storage Dots** displayed next to each image name in the gallery.
**Visual Feedback:** Integrated color pickers with real-time previews for immediate visual confirmation.

