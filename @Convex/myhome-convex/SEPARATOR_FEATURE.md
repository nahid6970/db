# Separator Feature

Visual separators to organize links within groups.

## Usage

### Adding a Separator
1. Right-click on any group (regular, collapsible, or box group)
2. Select "Add Separator" from the context menu
3. A horizontal line separator will be added to that group

### Removing a Separator
1. Enable Edit Mode (if not already enabled)
2. Hover over the separator
3. Click the × button that appears

## Visual Design

- Thin gradient line (transparent → cyan → transparent)
- Subtle opacity (30%) that increases on hover (60%)
- Delete button only visible in edit mode and on hover
- Matches the overall app aesthetic

## Technical Details

- Separators are stored as special link entries with `is_separator: true`
- They belong to a specific group
- Rendered between regular link items
- Supported in all group types:
  - Regular groups
  - Collapsible groups (Top Groups)
  - Box groups
  - Horizontal stack groups

## Database Schema

Separator entries have:
- `is_separator: true`
- `group: "GroupName"`
- `name: "---"`
- `default_type: "separator"`
- Empty `urls` and `url` fields

## Similar Implementation

This feature is inspired by the sheet separator feature in the Flask 5018_cell project, adapted for the Convex MyHome link management system.
