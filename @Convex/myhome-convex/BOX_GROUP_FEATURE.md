# Box Group Feature Added

## What is Box Group?

Box Group is a display style similar to Top Group - it shows as a compact button that opens a popup window when clicked. The difference:
- **Top Group**: Uses `collapsible` checkbox, displays at the top
- **Box Group**: Uses `box_group` checkbox, displays inline with other groups

## Changes Made

### 1. HTML (`index.html`)
Added checkbox after line 57:
```html
<label><input type="checkbox" id="edit-group-box-group"> Box Group</label>
```

### 2. CSS (`style.css`)
Added box group styling:
```css
.group_type_box {
  flex: 1 1 auto;
  margin-right: 10px;
  border: 1px solid #0056b3;
  border-radius: 0px;
  font-family: jetbrainsmono nfp;
  background-color: #2d2d2d;
  color: #ffffff;
  cursor: pointer;
  padding: 10px;
  min-width: 50px;
}
.group_type_box:hover { background-color: #3a3a3a; }
.group_type_box .group-header-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}
.group_type_box .group-title {
  color: inherit;
  text-align: center;
  margin: 0;
  font-size: 16px;
  flex-grow: 1;
}
```

### 3. JavaScript (`links-handler.js`)

**Added box group detection in `createRegularGroup()`:**
- Checks for `firstLink.box_group`
- If true, creates compact button with `.group_type_box` class
- Applies horizontal styling (colors, borders)
- Click handler opens popup (same as Top Group)
- Uses `top_name` for display name
- Supports password protection

**Updated `openEditGroupPopup()`:**
- Line 806: Load `box_group` checkbox value
- Line 864: Save `box_group` to groupSettings

## How to Use

1. **Create a Box Group:**
   - Edit any group (F1 → right-click group → Edit)
   - Check "Box Group" checkbox
   - Set "Display Name" for the button text
   - Configure colors under "Horizontal Stack Colors"
   - Save

2. **Styling Options:**
   - Background Color: `horizontal_bg_color`
   - Text Color: `horizontal_text_color`
   - Border Color: `horizontal_border_color`
   - Popup styling: `popup_bg_color`, `popup_text_color`, etc.

3. **Features:**
   - ✅ Compact button display
   - ✅ Opens popup on click
   - ✅ Custom display name (text, icon, or SVG)
   - ✅ Password protection
   - ✅ Custom colors and styling
   - ✅ Edit mode support

## Comparison

| Feature | Top Group | Box Group | Regular Group |
|---------|-----------|-----------|---------------|
| Display | Top container | Inline | Inline expanded |
| Click | Opens popup | Opens popup | N/A |
| Checkbox | Collapsible | Box Group | Neither |
| Styling | Top colors | Horizontal colors | Regular colors |
| Position | Separate container | With other groups | With other groups |

## Example

To create a box group for "Tools":
1. F1 to enable edit mode
2. Right-click "Tools" group → Edit
3. Check "Box Group"
4. Set Display Name: "🛠️" or "nf nf-dev-tools"
5. Set colors as desired
6. Save

The group will now appear as a compact button that opens a popup when clicked!
