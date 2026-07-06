# Tasks for Free AI Models Checklist Flask App

We need to create a Flask-based application that parses the `ai_models.md` file, renders the list of AI tools nicely, and allows the user to:
- Mark links/models as working, not working, or favorite ("nice").
- Persist the status of these links.
- Add additional cool features like filtering, notes, sorting, checking links, and metadata display.

## Task List
- [x] Initialize the Flask application directory structure.
- [x] Implement python script to parse `ai_models.md` dynamically into structured data (Categories, Subcategories, Items).
- [x] Create a persistent database/JSON store to save tool statuses (e.g. status: untested/working/broken, favorite: true/false, notes, last checked).
- [x] Build a premium-looking HTML interface (with sleek dark mode, nice typography, custom CSS cards, and micro-interactions).
- [x] Implement backend API endpoints to update statuses (working/broken/favorite/notes) via fetch/AJAX.
- [x] Add search, filter, and statistics components on the frontend.
- [x] Run and test the application to ensure it works correctly.
- [x] Fix Jinja2 TypeError: 'builtin_function_or_method' object is not iterable on cat.items.
- [x] Filter out internal anchor links (starting with `#`) from being parsed as items.
- [x] Redesign layout to a high-density sidebar + table dashboard layout.
- [x] Implement category-based view switching (hide other categories instead of scrolling).
- [x] Fix Jinja2 UndefinedError: LoopContext object has no attribute parent.
- [x] Implement sidebar collapse/toggle (show/hide left panel).
- [x] Persist sidebar collapsed status and selected category tab in localStorage across refreshes.
- [x] Add settings dropdown with Notes column visibility toggle (persisted).
- [x] Merge Actions and Status columns into a single column with active button indicator.
