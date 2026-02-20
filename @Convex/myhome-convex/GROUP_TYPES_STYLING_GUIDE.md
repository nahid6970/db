# Group Types and Styling Guide

## Overview
There are 3 group types in the application. Each type has specific styling options that apply to different parts of the group.

---

## Group Types

### 1. Normal Group (Default)
**Radio Value:** `horizontal`  
**Display:** Regular group with title and items  
**Layout:** Controlled by Flex/List option

**Styling Options:**
- **Horizontal Stack Colors** (applies to group container):
  - Background Color (`horizontal_bg_color`)
  - Text Color (`horizontal_text_color`) - applies to group title
  - Border Color (`horizontal_border_color`)
  - Hover Color (`horizontal_hover_color`)

**When to use:** Standard groups with visible items

---

### 2. Top Group
**Radio Value:** `top`  
**Display:** Compact button in top container  
**Behavior:** Click to open popup window

**Styling Options:**
- **Top Group Colors** (applies to compact button):
  - Background Color (`top_bg_color`)
  - Text Color (`top_text_color`)
  - Border Color (`top_border_color`)
  - Hover Color (`top_hover_color`)
  - Width/Height (`top_width`, `top_height`)
  - Font Family/Size (`top_font_family`, `top_font_size`)

- **Popup Colors** (applies to popup window):
  - Background Color (`popup_bg_color`)
  - Text Color (`popup_text_color`)
  - Border Color (`popup_border_color`)
  - Border Radius (`popup_border_radius`)

**When to use:** Frequently accessed groups, save space

---

### 3. Box Group
**Radio Value:** `box`  
**Display:** Compact button inline with other groups  
**Behavior:** Click to open popup window

**Styling Options:**
- **Horizontal Stack Colors** (applies to compact button):
  - Background Color (`horizontal_bg_color`)
  - Text Color (`horizontal_text_color`)
  - Border Color (`horizontal_border_color`)
  - Hover Color (`horizontal_hover_color`)

- **Popup Colors** (applies to popup window):
  - Background Color (`popup_bg_color`)
  - Text Color (`popup_text_color`)
  - Border Color (`popup_border_color`)
  - Border Radius (`popup_border_radius`)

**When to use:** Space-saving grouped links, inline with other groups

---

## Styling Implementation Summary

| Group Type | Button/Container Styling | Popup Styling | Title Color Source |
|------------|-------------------------|---------------|-------------------|
| **Normal** | Horizontal Stack Colors | N/A | `horizontal_text_color` |
| **Top Group** | Top Group Colors | Popup Colors | `top_text_color` |
| **Box Group** | Horizontal Stack Colors | Popup Colors | `horizontal_text_color` |

---

## Common Settings (All Types)

### Display Name
- Field: `top_name`
- Supports: Text, NerdFont icons, SVG
- Used for: Button text (Top/Box) or custom group title

### Password Protection
- Field: `password_protect`
- Password: `1823`
- Applies to: All group types

### Display Style
- Options: Flex (row) or List (column)
- Applies to: Normal groups and items inside popups

---

## Code Implementation

### Normal Group
```javascript
if (isHorizontal) {
  if (firstLink.horizontal_bg_color) div.style.backgroundColor = firstLink.horizontal_bg_color;
  if (firstLink.horizontal_text_color) title.style.color = firstLink.horizontal_text_color;
  if (firstLink.horizontal_border_color) div.style.borderColor = firstLink.horizontal_border_color;
  if (firstLink.horizontal_hover_color) {
    div.addEventListener("mouseenter", () => div.style.backgroundColor = firstLink.horizontal_hover_color);
    div.addEventListener("mouseleave", () => div.style.backgroundColor = firstLink.horizontal_bg_color || "");
  }
}
```

### Top Group
```javascript
// Button styling
if (firstLink.top_bg_color) div.style.backgroundColor = firstLink.top_bg_color;
if (firstLink.top_text_color) title.style.color = firstLink.top_text_color;
if (firstLink.top_border_color) div.style.borderColor = firstLink.top_border_color;

// Popup styling (on click)
if (firstLink.popup_bg_color) popupBox.style.backgroundColor = firstLink.popup_bg_color;
if (firstLink.popup_text_color) popupBox.style.color = firstLink.popup_text_color;
if (firstLink.popup_border_color) popupBox.style.borderColor = firstLink.popup_border_color;
if (firstLink.popup_border_radius) popupBox.style.borderRadius = firstLink.popup_border_radius;
```

### Box Group
```javascript
// Button styling
if (firstLink.horizontal_bg_color) div.style.backgroundColor = firstLink.horizontal_bg_color;
if (firstLink.horizontal_text_color) div.style.color = firstLink.horizontal_text_color;
if (firstLink.horizontal_border_color) div.style.borderColor = firstLink.horizontal_border_color;
if (firstLink.horizontal_hover_color) {
  div.addEventListener('mouseenter', () => div.style.backgroundColor = firstLink.horizontal_hover_color);
  div.addEventListener('mouseleave', () => div.style.backgroundColor = firstLink.horizontal_bg_color || '#2d2d2d');
}

// Popup styling (on click)
if (firstLink.popup_bg_color) popupBox.style.backgroundColor = firstLink.popup_bg_color;
if (firstLink.popup_text_color) popupBox.style.color = firstLink.popup_text_color;
if (firstLink.popup_border_color) popupBox.style.borderColor = firstLink.popup_border_color;
if (firstLink.popup_border_radius) popupBox.style.borderRadius = firstLink.popup_border_radius;
```

---

## Database Fields

All styling fields are stored in the `links` table with each link in a group:

```typescript
{
  // Group identification
  group: string,
  collapsible: boolean,      // true for Top Group
  box_group: boolean,         // true for Box Group
  horizontal_stack: boolean,  // true for Normal/Box Group
  
  // Display
  top_name: string,
  display_style: 'flex' | 'list-item',
  password_protect: boolean,
  
  // Top Group Colors
  top_bg_color: string,
  top_text_color: string,
  top_border_color: string,
  top_hover_color: string,
  top_width: string,
  top_height: string,
  top_font_family: string,
  top_font_size: string,
  
  // Horizontal/Box Colors
  horizontal_bg_color: string,
  horizontal_text_color: string,
  horizontal_border_color: string,
  horizontal_hover_color: string,
  
  // Popup Colors (Top & Box)
  popup_bg_color: string,
  popup_text_color: string,
  popup_border_color: string,
  popup_border_radius: string
}
```

---

## UI Form Structure

### Edit Group Form
```html
<!-- Group Type Selection -->
<input type="radio" name="edit-group-type" value="horizontal" checked> Normal
<input type="radio" name="edit-group-type" value="top"> Top Group
<input type="radio" name="edit-group-type" value="box"> Box Group

<!-- Display Options -->
<input type="radio" name="edit-group-display" value="flex" checked> Flex
<input type="radio" name="edit-group-display" value="list-item"> List

<!-- Password -->
<input type="checkbox" id="edit-group-password-protect"> Password Protect

<!-- Top Group Colors (always visible) -->
<div id="collapsible-settings">
  <input id="edit-group-top-bg-color">
  <input id="edit-group-top-text-color">
  <!-- ... popup colors ... -->
</div>

<!-- Horizontal Stack Colors (always visible) -->
<div id="horizontal-settings">
  <input id="edit-group-horizontal-bg-color">
  <input id="edit-group-horizontal-text-color">
  <!-- ... -->
</div>
```

---

## Best Practices

1. **Normal Groups**: Use for standard link lists with visible items
2. **Top Groups**: Use for frequently accessed collections, displayed prominently at top
3. **Box Groups**: Use for space-saving, displayed inline with other groups

4. **Color Consistency**: 
   - Set both Top and Horizontal colors if you plan to switch group types
   - All color sections are always visible to prevent losing settings

5. **Display Name**:
   - Use icons for compact buttons (Top/Box)
   - Use text for Normal groups

6. **Password Protection**:
   - Use for sensitive groups
   - Same password (1823) for all protected groups
