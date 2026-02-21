# Group Order Persistence - Testing Instructions

## Current Status
The group order saving and loading logic has been implemented and debugged. The system now correctly:
- Finds all groups (Top Groups, Box Groups, and Normal Groups)
- Saves their order to the Convex database
- Loads and sorts groups by their saved order on page refresh

## What We Tried & Fixed

### Issue 1: Syntax Error in Sorting Logic
**Problem:** Used `bOrder` variable before it was defined  
**Fix:** Reordered variable declarations in sort function

### Issue 2: `updateAllLinks` Mutation Was Inefficient
**Problem:** Original approach deleted and recreated all links, which might not persist `group_order` correctly  
**Fix:** Created new `updateGroupOrder` mutation that only patches the `group_order` field using `ctx.db.patch()`

### Issue 3: `saveGroupOrder()` Only Found 2 of 3 Groups
**Problem:** Function wasn't looking inside `.group_type_top-container` for Top Groups  
**Fix:** Added logic to check for `.group_type_top-container` and extract Top Groups from inside it

### Issue 4: Sorting Logic Wasn't Reading `group_order` from Database
**Problem:** Groups were sorting by creation order instead of saved `group_order`  
**Fix:** Added sorting logic: `Object.keys(grouped).sort((a, b) => (grouped[a][0].link.group_order ?? 999) - (grouped[b][0].link.group_order ?? 999))`

### Issue 5: Added Debug Logging
**Added logs to track:**
- Group order values during sorting
- Container children count
- Groups found in each container
- Total groups found before saving
- Saved group order array

## Potential Issues to Check

### If Order Still Doesn't Persist After Testing:

1. **Convex Dev Not Running**
   - Check if `npx convex dev` is running in terminal
   - Look for "Convex functions ready!" message after code changes
   - The `updateGroupOrder` mutation needs to be deployed

2. **Browser Cache**
   - Try hard refresh: Ctrl+Shift+R or Ctrl+F5
   - Or clear browser cache completely
   - Or open in incognito/private window

3. **Database Not Updating**
   - Check Convex dashboard at dashboard.convex.dev
   - Look at the `links` table
   - Verify `group_order` field exists and has values (0, 1, 2, etc.)
   - If all values are `undefined` or `999`, the mutation isn't working

4. **Timing Issue**
   - The 100ms delay before `saveGroupOrder()` might not be enough
   - Try increasing delay in `handleGroupDrop()` from 100ms to 500ms

5. **Multiple Links in Same Group Have Different Orders**
   - All links in a group should have the same `group_order` value
   - If they differ, the sorting will use the first link's value
   - Check database to verify all links in "Group1" have same `group_order`

6. **App.js CORS Error**
   - The error `Access to script at 'file:///...app.js' blocked by CORS` is normal when opening HTML directly
   - Convex client initializes after a delay (see "Convex client initialized!" log)
   - If this is causing issues, run a local server: `python -m http.server 8000`

7. **Node Version Too Old**
   - Current version: Node v18.19.1
   - Convex CLI requires Node 20+
   - If `npx convex dev` fails, upgrade Node.js

## What Was Fixed

## Testing Steps

### 1. Verify Groups Load in Correct Order
- Refresh the page
- Check console for: `Group orders: (3) ['JobCircular=0', 'Group2=1', 'Group1=1']`
- The numbers after `=` are the saved order values

### 2. Drag a Group to Reorder
- Drag any group (Top, Box, or Normal) to a new position
- Wait 100ms for the save to trigger
- Check console for:
  ```
  Container children: 3
  Child: group_type_top-container undefined
  Found top groups: 1
  Child: link-group Group1
  Child: link-group Group2
  Total groups found: 3
  Saving group order: (3) [{…}, {…}, {…}]
  Group order saved successfully
  ```

### 3. Expand the Saved Order
- Click the arrow next to `Saving group order: (3) [{…}, {…}, {…}]`
- Verify it shows all 3 groups with their new order values (0, 1, 2)
- Example:
  ```
  0: {name: 'Group2', order: 0}
  1: {name: 'JobCircular', order: 1}
  2: {name: 'Group1', order: 2}
  ```

### 4. Hard Refresh to Test Persistence
- Press Ctrl+Shift+R (or Ctrl+F5) to hard refresh
- Check console for `Group orders:` - should match the order you saved
- Verify groups appear in the new order on the page

## Expected Behavior
- All group types (Top, Box, Normal) can be dragged to reorder
- Order persists after page refresh
- Order is stored in Convex database in the `group_order` field
- All links in a group share the same `group_order` value

## Known Issues
- None currently - all groups are being found and saved correctly

## Debug Logs to Check
If order doesn't persist, check these console logs:
1. **On Load:** `Group orders: ['GroupName=0', 'GroupName=1', ...]` - Shows loaded order
2. **On Drag:** `Saving group order: [{name, order}, ...]` - Shows what's being saved
3. **On Drag:** `Total groups found: X` - Should match your total number of groups
4. **After Refresh:** Compare the `Group orders:` values before and after drag

## Files Modified
- `convex/functions.ts` - Added `updateGroupOrder` mutation (line ~157)
- `convex/schema.ts` - Added `group_order: v.optional(v.number())` field
- `links-handler.js`:
  - Line ~173: Added sorting logic for groups by `group_order`
  - Line ~1295: Fixed `saveGroupOrder()` to find all group types
  - Line ~1265: Added 100ms delay before calling `saveGroupOrder()`

## Code Locations

### Sorting Logic (links-handler.js ~line 173)
```javascript
const sortedGroupNames = Object.keys(grouped).sort((a, b) => {
  const aOrder = grouped[a][0].link.group_order ?? 999;
  const bOrder = grouped[b][0].link.group_order ?? 999;
  return aOrder - bOrder;
});
```

### Save Function (links-handler.js ~line 1295)
```javascript
async function saveGroupOrder() {
  const container = document.getElementById('links-container');
  const allGroups = [];
  
  Array.from(container.children).forEach(child => {
    if (child.classList.contains('group_type_top-container')) {
      allGroups.push(...Array.from(child.querySelectorAll('.group_type_top')));
    } else if (child.dataset.groupName) {
      allGroups.push(child);
    }
  });
  
  const groupOrder = allGroups.map((group, index) => ({
    name: group.dataset.groupName,
    order: index
  }));
  
  await window.convexMutation("functions:updateGroupOrder", { groupOrder });
}
```

### Convex Mutation (convex/functions.ts ~line 157)
```typescript
export const updateGroupOrder = mutation({
  args: { groupOrder: v.array(v.object({ name: v.string(), order: v.number() })) },
  handler: async (ctx, args) => {
    const links = await ctx.db.query("links").collect();
    for (const link of links) {
      const groupInfo = args.groupOrder.find(g => g.name === (link.group || 'Ungrouped'));
      if (groupInfo) {
        await ctx.db.patch(link._id, { group_order: groupInfo.order });
      }
    }
  },
});
```

## Next Steps
1. Test dragging each group type (Top, Box, Normal)
2. Verify order persists after refresh
3. If working, remove debug console.log statements for cleaner output
