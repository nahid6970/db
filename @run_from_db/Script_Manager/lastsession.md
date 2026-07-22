# Recent Changes Summary (Handoff)

We implemented several key layout, alignment, and formatting options in the script manager:

1. **Search Results Partitioning**:
   - Visual items (having `icon_path`, `svg_content`, or `nf_char` Nerd Font glyphs) are displayed first as boxed layouts.
   - Text-only items are displayed below in a clean list column layout.
   - The layouts are separated via independent grid containers to prevent layout stretching or distortion, with a `SCRIPTS & ACTIONS` text label divider.

2. **Search Mode Global Settings (Right Panel)**:
   - Added a new right panel section to configure search box width/height, visual icon size, and box columns count.
   - Configure text list width/height and list columns count.
   - Toggle setting **Left Align Text during search** to override text alignments to the left during search.

3. **Label Line Break Formatting**:
   - Stripped `<br>`, `<br/>`, and `<BR>` html line breaks and replaced them with spaces in search mode so that long titles are flattened to a single line.

4. **Search Filters**:
   - Excluded folder items from matching/appearing in search results (only scripts are collected, though folders are still traversed recursively to find them).

5. **Folder & Item Batch Updates**:
   - Supported batch foreground/background colors and transparent background options for folder contents recursively on save.
   - Supported individual and batch alignments (left/right/center) for labels.
