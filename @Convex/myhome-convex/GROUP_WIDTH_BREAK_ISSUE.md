# Issue: Group Width with Line Breaks

## Description
When items inside a **Normal Group** are separated onto different lines using the `Start on New Line` feature, the group's container (the box with the border) does not shrink to match the new, narrower width. instead, it remains as wide as it would be if all items were on a single row.

## Current Behavior
- Border stays wide, creating empty space on the right after a wrap.
- The browser seems to calculate the `fit-content` width based on the sum of all item widths rather than the widest individual row.

## Attempted Fixes (Unsuccessful)
1.  **`display: inline-block`**: Changed the `.link-group` container to `inline-block` with `width: fit-content`.
2.  **`display: table`**: Changed the container to `display: table` to force shrink-wrapping.
3.  **Line Break Tweak**: Removed `width: 100%` from `.item-line-break` and relied on `flex-basis: 100%`.
4.  **List Reset**: Removed `width: fit-content` from the internal `ul`.

## Technical Context
- **Parent**: `#links-container` (Flexbox: `display: flex; flex-wrap: wrap;`)
- **Container**: `.link-group` (Current: `display: table; width: auto;`)
- **List**: `ul` (Flexbox: `display: flex; flex-wrap: wrap;`)
- **Wrap Mechanism**: A `div.item-line-break` with `flex-basis: 100%` is inserted between link items.

## Potential Investigations
- **Flexbox vs Block**: Try changing the `ul` from `display: flex` to `display: block` and see if the container shrinks correctly when items are floated or displayed inline-block.
- **Min-Content**: Test if `width: min-content` or `width: max-content` on the `.link-group` or `ul` affects the wrap calculation.
- **Title Influence**: Check if the `h3` title or the "Edit Group" button is forcing a minimum width that exceeds the wrapped rows.
- **Grid Layout**: Consider if switching the `ul` to a Grid layout would provide better "intrinsic width" calculations for the parent.

## Steps to Reproduce
1. Create a Normal Group with 6 items.
2. Toggle "Start on New Line" for the 4th item.
3. Observe the border width—it will likely stay wide enough for all 6 items in a row.
