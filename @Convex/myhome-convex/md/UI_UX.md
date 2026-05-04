# UI/UX Design & Guidelines

---

## Overall Layout

**Layout:** Dark theme. Top bar with sidebar buttons. Main content area (`#links-container`) with flex-wrap groups.
**Colors & Theme:** Dark background `#1a1a1a` / `#2d2d2d`, white text, accent green `#4CAF50`
**Typography:** JetBrainsMono NFP for group buttons and icons
**Edit Mode:** Toggle with F1 key or ✏️ Edit button. Shows drag handles, edit/delete buttons on items.

---

## Group Display

### Normal Group
- Bordered box with title and items visible
- Items in flex row (or list-item column)
- Title bar with edit button (edit mode)

### Top Group / Box Group
- Compact button (no visible items)
- Click → popup overlay with items
- Popup: centered, dark background, scrollable

### Separators
- Thin gradient line (transparent → cyan → transparent)
- 30% opacity, increases to 60% on hover
- × delete button appears on hover

---

## Popups

**Structure:** `.popup-container` (full-screen overlay) → `.Menu` (centered card)
**Header:** Title + optional action buttons (📋, 🎨) + × close button
**Close:** × button, clicking outside overlay, or Esc key

### Edit Link Popup
- Header: "Edit Link" + 📋 (copy format) + 🎨 (paste format) + ×
- Fields: name, group, hide/start-new-line chips, URLs, type picker, text/icon/image/SVG, size, colors, font, border, tooltip, reminder

### Edit Group Popup
- Sections: Group Type (Normal/Top/Box), Display (Flex/List), Password, Display Name, Top Group Colors, Popup Colors, Horizontal Stack Colors

---

## Color Inputs

All color fields have class `.color-input`. As you type a valid color:
- Input background changes to that color
- Text color auto-adjusts for contrast (black or white)
- Triggered by `applyColorPreview()` on `input` event

---

## Context Menu

Right-click on items/groups → floating menu near cursor.
- Positioning: `clientX/clientY` with viewport boundary detection
- Closes on click outside or Esc

---

## Notifications

`.copy-notification` element at bottom of screen.
- `success` type: green
- `info` type: blue/neutral
- `error` type: red
- Auto-hides after 2 seconds

---

## Format Painter Buttons

Located in Edit Link popup header, between title and × close:
- **📋** (blue hover) — copies current item's style fields to clipboard (localStorage)
- **🎨** (green hover) — pastes last copied styles into current item's fields

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| F1 | Toggle edit mode |
| Esc | Close popup |

---

## Accessibility Notes

- Color inputs show contrast-adjusted text for readability
- Buttons have `title` attributes for tooltips
- Popups trap focus (close on outside click)
- Edit mode clearly indicated by button state and container class
