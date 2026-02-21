# Group Order Persistence Fixes

## Overview
This document details the fixes applied to resolve the issue where group order was not persisting correctly after drag-and-drop operations, especially when moving groups between different sections (e.g., from Normal to Top).

## Issues Addressed
1. **Unstable Sorting:** Groups with the same order value would jump around on refresh.
2. **Cross-Section Dragging:** Dragging a group into the "Top Group" container wouldn't save its new position correctly because the save logic was too strict about where it looked for groups.
3. **Rendering Inconsistency:** The rendering logic calculated a sorted order but only applied it to Top Groups, ignoring it for Regular Groups.

## Fixes Applied

### 1. Unified Rendering Logic
**File:** `links-handler.js`
**Function:** `renderLinks`

Updated the rendering loop for Regular Groups to use the `sortedGroupNames` array instead of `Object.keys(grouped)`. This ensures that the `group_order` field from the database is respected for all group types.

```javascript
// Before
Object.keys(grouped).forEach(groupName => { ... })

// After
sortedGroupNames.forEach(groupName => { ... })
```

### 2. Stable Sorting
**File:** `links-handler.js`
**Function:** `renderLinks`

Added a secondary sort criteria (alphabetical) to the sorting logic. If two groups have the same `group_order` (or are both undefined/999), they will now be sorted alphabetically instead of randomly.

```javascript
const sortedGroupNames = Object.keys(grouped).sort((a, b) => {
  const aOrder = grouped[a][0].link.group_order ?? 999;
  const bOrder = grouped[b][0].link.group_order ?? 999;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return a.localeCompare(b); // Stability fallback
});
```

### 3. Robust Group Detection
**File:** `links-handler.js`
**Function:** `saveGroupOrder`

Rewrote the `saveGroupOrder` function to be more flexible. It now:
1. Iterates through the `links-container` children in order.
2. Checks inside `.group_type_top-container` for any nested groups.
3. Captures all groups that have a `dataset.groupName`, regardless of their specific CSS class or nesting depth.

This ensures that if a "Regular" group is dragged into the "Top" container (or vice versa), its new position is correctly recorded.

### 4. Increased Save Delay
**File:** `links-handler.js`
**Function:** `handleGroupDrop`

Increased the timeout before `saveGroupOrder` is called from 100ms to **300ms**. This gives the browser's DOM renderer enough time to fully complete the move operation before we attempt to read the new order.

## Verification
- **Test:** Drag a Normal group to the first position. **Result:** Persists after refresh.
- **Test:** Drag a Top group to the middle of Normal groups. **Result:** Persists after refresh.
- **Test:** Refresh multiple times. **Result:** Order remains identical (stable).
- **Test:** Create a new group. **Result:** Appears at the end (order 999).

## Status
✅ **FIXED** - Group ordering is now fully functional and robust.
