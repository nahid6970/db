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

3. **Label Line Break Formatting & Text Elision**:
   - Stripped `<br>`, `<br/>`, and `<BR>` html line breaks and replaced them with spaces in search mode so that long titles are flattened to a single line.
   - Disabled word wrap (`QTextOption.WrapMode.NoWrap`) on single-line text documents. This forces long labels containing spaces (e.g. `IMG Dimension Size` or `AppControl Manager`) to stay on a single line so they are accurately measured and elided with `...` (using `QFontMetrics.elidedText`) instead of wrapping off-screen.

4. **Search Filters & Operations**:
   - Excluded folder items from matching/appearing in search results (only scripts are collected, though folders are still traversed recursively to find them).
   - Added `find_parent_list` to recursively trace item parent lists. This resolves context menu actions (Edit, Duplicate, Cut, Delete) failing inside search results, allowing items to be manipulated directly from their parent folder structures.

5. **Folder & Item Batch Updates**:
   - Supported batch foreground/background colors and transparent background options for folder contents recursively on save.
   - Supported individual and batch alignments (left/right/center) for labels.
