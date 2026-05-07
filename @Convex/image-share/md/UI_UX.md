# UI/UX Design & Guidelines

## Top Bar Controls
**Layout:** Sticky top bar containing upload zone, clear/download buttons, and settings.
**Recent Change:** The active storage badge has been unified with the settings button as an icon-only control. The button's background and border color dynamically update to reflect the selected storage provider, eliminating the need for text labels and reducing visual noise.

## Settings Modal
**Layout:** Tabbed interface with three sections:
1. **Storage:** Core storage provider selection.
2. **Theme:** Personalization window for storage badge colors.
3. **MEGA:** Advanced configuration for MEGA.nz integration.
**Rationale:** Reduces cognitive load by grouping related settings and allowing the user to focus on one "window" at a time.

## Dynamic Theming
**Implementation:** Uses CSS variables (`--color-cloudinary`, etc.) injected via JavaScript.
**Application:** Custom colors apply to:
- The **Icon-Only Settings/Storage Button**.
- The **Storage Dots** displayed next to each image name in the gallery.
**Visual Feedback:** Integrated color pickers with real-time previews for immediate visual confirmation.

