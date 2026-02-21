# Start New Line Feature - Issue Documentation

## Current Status: PARTIALLY WORKING

### What Works ✅
1. **Visual Separators**: Right-click group → "Add Separator" → Creates visible line that forces groups to next line
2. **Items "Start on New Line"**: Individual items can start on new line within their group
3. **Box Group Popups**: Line breaks work correctly in box group popups
4. **Collapsible Group Popups**: Line breaks work correctly in collapsible group popups

### What Doesn't Work ❌
**Groups "Start on New Line"**: When enabling "Start on New Line" in group settings, ALL items inside that group display on separate rows (one item per row) instead of just the group starting on a new line.

## Expected Behavior

### For Groups
When "Start on New Line" is enabled on a group:
- The **entire group** should start on a new line
- Items **inside the group** should display normally (multiple items per row based on flex layout)
- Only the group's position changes, not its internal layout

### For Items
When "Start on New Line" is enabled on an item:
- That specific item starts on a new line within its group
- Other items in the group are unaffected
- ✅ **This currently works correctly**

## Technical Details

### Current Implementation

**Files Modified:**
- `convex/schema.ts` - Added `start_new_line: v.optional(v.boolean())`
- `convex/functions.ts` - Added field to `addLink` and `updateLink` mutations
- `index.html` - Added checkboxes in edit group and edit link popups
- `links-handler.js` - Added logic to insert invisible line break elements
- `style.css` - Added `.group-line-break` and `.item-line-break` styles

**How It Works:**
1. When rendering, checks if item/group has `start_new_line: true`
2. Inserts invisible `<div>` with `flex-basis: 100%` before the element
3. This forces a flex line break without visual separator

**Item Implementation (Working):**
```javascript
items.forEach(({ link, index }) => {
  if (link.start_new_line) {
    const lineBreak = document.createElement('div');
    lineBreak.className = 'item-line-break';
    ul.appendChild(lineBreak);
  }
  const item = createLinkItem(link, index);
  ul.appendChild(item);
});
```

**Group Implementation (Broken):**
```javascript
const firstLink = grouped[groupName][0].link;
if (firstLink.start_new_line) {
  const lineBreak = document.createElement('div');
  lineBreak.className = 'group-line-break';
  container.appendChild(lineBreak);
}
container.appendChild(groupDiv);
```

### The Problem

The issue is that `start_new_line` is stored on individual link objects, not on the group itself. When we check `firstLink.start_new_line`, we're checking if the first item in the group should start on a new line, not if the group should.

**Current Data Structure:**
```javascript
{
  _id: "...",
  name: "Link 1",
  group: "MyGroup",
  start_new_line: true,  // This is per-item, not per-group
  // ... other fields
}
```

## Possible Solutions

### Option 1: Separate Group Metadata Table
Create a new Convex table for group settings:
```javascript
groups: defineTable({
  name: v.string(),
  start_new_line: v.optional(v.boolean()),
  // other group-level settings
})
```

### Option 2: Use First Link as Group Representative
When updating group settings, only apply `start_new_line` to the first link, and check it differently:
- For items: Check `link.start_new_line` (current behavior)
- For groups: Check `firstLink.start_new_line` but DON'T pass it to items

### Option 3: Add Group-Level Flag
Add a separate field like `group_start_new_line` that only applies to the group container, not items.

### Option 4: CSS-Only Solution
Instead of using the same field for both, use different CSS classes:
- `.item-line-break` - for items (current, working)
- `.group-line-break` - for groups (needs different approach)

The group line break should be inserted in `#links-container` (flex parent), not inside the group's `<ul>`.

## Next Steps

1. Decide on solution approach (probably Option 2 or 3)
2. Ensure `start_new_line` on group settings doesn't propagate to all items
3. Test that group starts on new line while items inside maintain normal flex layout
4. Update documentation once fixed

## Related Files

- `/mnt/c/@delta/db/@Convex/myhome-convex/convex/schema.ts`
- `/mnt/c/@delta/db/@Convex/myhome-convex/convex/functions.ts`
- `/mnt/c/@delta/db/@Convex/myhome-convex/links-handler.js` (lines ~220-250, ~520-560)
- `/mnt/c/@delta/db/@Convex/myhome-convex/style.css` (lines with `.group-line-break`, `.item-line-break`)
- `/mnt/c/@delta/db/@Convex/myhome-convex/index.html` (edit popups)

## Testing Checklist

Once fixed, verify:
- [ ] Group with "Start on New Line" starts on new line
- [ ] Items inside that group display normally (multiple per row)
- [ ] Individual items with "Start on New Line" still work
- [ ] Works for regular groups
- [ ] Works for box groups
- [ ] Works for collapsible groups
- [ ] Works in popups
- [ ] Visual separators still work independently
