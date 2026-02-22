# Separator Feature

Visual separators to organize groups and a "Start on New Line" toggle for groups/items.

## Visual Separators

### Usage

**Adding a Separator:**
1. Right-click on any group (regular, collapsible, or box group)
2. Select "Add Separator" from the context menu
3. A horizontal line separator will be added before that group

**Removing a Separator:**
1. Hover over the separator
2. Click the × button that appears in the center

### Visual Design

- Thin gradient line (transparent → cyan → transparent)
- Subtle opacity (30%) that increases on hover (60%)
- Delete button visible on hover
- Matches the overall app aesthetic

## Start on New Line Toggle

### For Items (Working ✅)

When enabled on an individual item:
- That specific item starts on a new line within its group
- Other items in the group are unaffected
- No visual separator is shown

**How to use:**
1. Edit a link
2. Check "Start on New Line"
3. Save

### For Groups (Known Issue ⚠️)

When enabled on a group:
- **Expected:** The entire group starts on a new line
- **Current Bug:** All items inside the group display on separate rows

See `START_NEW_LINE_ISSUE.md` for technical details and planned fixes.

## Technical Details

### Database Schema

**Separator entries:**
- `is_separator: true`
- `group: "GroupName"`
- `name: "---"`
- `default_type: "separator"`
- Empty `urls` and `url` fields

**Start on New Line:**
- `start_new_line: boolean` (on any link/group)

### Implementation

Separators are stored as special link entries with `is_separator: true`. They are rendered as invisible flex elements with `flex-basis: 100%` that force line breaks.

Items with `start_new_line: true` get an invisible `<div class="item-line-break">` inserted before them.

### Supported Group Types

- Regular groups
- Collapsible groups (Top Groups)
- Box groups
- Horizontal stack groups

## Related Files

- `convex/schema.ts` - Schema definitions
- `convex/functions.ts` - Mutations
- `links-handler.js` - Rendering logic
- `style.css` - Separator and line break styles
- `index.html` - Edit popup checkboxes

## Similar Implementation

This feature is inspired by the sheet separator feature in the Flask 5018_cell project, adapted for the Convex MyHome link management system.
