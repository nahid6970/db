# Royal Roulette - Project Overview

This project is a premium, 2-player competitive Roulette game built with HTML5, CSS3, and Vanilla JavaScript. It features a unique "Zero-Sum" mechanic where players act as the "Banker" for each other.

## Core Mechanics

### 1. Zero-Sum "Banker vs Bettor" Mode
- **Turn-Based**: Players alternate roles every round. One player is the **Bettor**, and the other is the **Banker**.
- **No House**: There is no computer-controlled casino. Every dollar lost by the Bettor is added to the Banker's balance. Every dollar won by the Bettor is deducted from the Banker's balance.
- **Tug-of-War**: Both players share a total pool of $20,000. The game ends when one player goes bankrupt.

### 2. Smart Betting System
- **Conflict Prevention**: The game prevents "hedging" on mutually exclusive bets (e.g., Red vs. Black). If a player attempts to bet on both, the system refunds the previous bet and switches to the new choice.
- **Visual Feedback**: Chips are color-coded (Gold for Player 1, Cyan for Player 2) and appear directly on numerals or category buttons with their specific bet amounts.

### 3. Personalization
- **Custom Names**: A settings menu (gear icon) allows players to set custom names which are reflected in the UI, win announcements, and the scoreboard.
- **Series Score**: Tracks the number of rounds won by each player across the current session.

## Visual Design
- **Theme**: Luxury casino aesthetic with deep blacks, gold accents, and glassmorphism UI.
- **Animations**:
    - Smooth Canvas-based wheel rotation with cubic-bezier easing.
    - Floating result display that pulses with the winning color.
    - "No-funds" red flash on balance displays.
    - Success/Loss overlays with dynamic messaging.

## Technical Structure
- `index.html`: Optimized semantic layout with separate overlays for Gameplay, Results, and Settings.
- `style.css`: Contains the CSS variables, animations, and responsive design tokens.
- `script.js`: Handles the game loop, physics-based wheel calculations, and the zero-sum financial logic.

## Winning Odds (Standard European Roulette)
- **Straight Up**: 35:1
- **Red/Black/Even/Odd/High/Low**: 1:1
- **Dozens**: 2:1

---
*Created by Antigravity for Nahid.*
