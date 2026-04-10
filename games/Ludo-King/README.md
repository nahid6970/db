# Ludo King - Project Documentation

This document provides the necessary context for AI agents to maintain and extend this Ludo King implementation without issues.

## 🛠 Tech Stack
- **Frontend**: Pure HTML5, CSS3 (Grid Layout), and Vanilla JavaScript (ES Modules).
- **Backend**: [Convex](https://www.convex.dev/) (Real-time state management and server-side logic).
- **Icons**: Inline SVGs for stars and tokens.

## 📐 Board Architecture
The board is a **15x15 CSS Grid**.

### 1. Coordinate System
- **Path**: 52 unique squares following a clockwise loop.
- **Home Bases**: 6x6 squares at the four corners.
- **Center**: 3x3 square with four triangles (`clip-path`).
- **Safe Squares (Total 8)**: 
  - Absolute Indexes: `[1, 9, 14, 22, 27, 35, 40, 48]`
  - These include the 4 starting squares and 4 mid-arm safety squares.

### 2. Player Mapping
- **Player 0 (Red)**: Starts at `relative pos 0` -> Maps to `absolute index 1`.
- **Player 1 (Green)**: Starts at `relative pos 0` -> Maps to `absolute index 14`.
- **Player 2 (Yellow)**: Starts at `relative pos 0` -> Maps to `absolute index 40`.
- **Player 3 (Blue)**: Starts at `relative pos 0` -> Maps to `absolute index 27`.

## 🧠 Game Logic (Convex Backend)
All state-changing logic resides in `convex/game.ts`.

### Key Rules Implemented:
- **Roll 6 to Start**: Tokens only leave the base (`pos: -1`) and enter the path (`pos: 0`) on a roll of 6.
- **Consecutive Sixes**: 3 consecutive sixes automatically skips the turn.
- **Extra Turns**: Awarded for rolling a 6 or capturing an opponent's token.
- **Capture Logic**: Uses `getAbsPos()` to compare tokens from different players. Landing on an opponent sends them back to `pos: -1`.
- **Auto-Action**:
  - **Auto-Skip**: Occurs if a player has zero valid moves after a roll.
  - **Auto-Move**: Occurs if a player has exactly one valid token to move.
- **Turn Tracking**: A `turnId` (string) is updated on every state change to prevent duplicate frontend auto-actions.

## 🚀 How to Run
1. **Install Dependencies**: `npm install`
2. **Start Backend**: `npx convex dev`
3. **Environment**: Ensure `.env.local` has the correct `CONVEX_URL`.
4. **Open Frontend**: Open `index.html` in a local server or browser.

## 📝 Maintenance Notes for AI
- **Modifying Path**: If you change the `PATH` array in `index.html`, ensure the `START_INDEXES` in `convex/game.ts` are updated to match.
- **Capturing**: Never use relative `pos` to compare tokens for capturing; always use the `getAbsPos` helper function.
- **Frontend Updates**: The frontend uses `setInterval(updateUI, 2000)` for polling. For production, consider using a Convex `watch` query if switching to a React-based frontend.
