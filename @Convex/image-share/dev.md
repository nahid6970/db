# Image Share Development Guide

This project is a web-based gallery that supports multiple storage providers (Cloudinary, Convex, and MEGA).

## Architecture
- **Frontend:** Vanilla HTML/CSS/JS with Convex Client.
- **Backend:** Convex (functions in `convex/images.ts`).
- **Storage:** Supports Cloudinary, Convex Storage, and MEGA.

## Documentation
- #[[file:md/RECENT.md]] - Recent development sessions.
- #[[file:md/PROBLEMS_AND_FIXES.md]] - Bug tracking and solutions.
- #[[file:md/FEATURES.md]] - Feature specifications.
- #[[file:md/UI_UX.md]] - UI/UX design decisions.

## Setup
1. Configure Convex URL in `index.html`.
2. Set Cloudinary credentials in `index.html`.
3. Configure MEGA credentials in the Settings UI.
