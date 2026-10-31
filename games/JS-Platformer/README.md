# Neon Runner

A 2D platformer written in vanilla JavaScript with the Canvas 2D API.
No dependencies, no build step, no internet needed.

## Play

Double-click **`index.html`** (opens in your default browser).

## Controls

| Action | Key |
| --- | --- |
| Move | `A` / `D` (or arrow keys) |
| Jump / Double jump | `W` / `Space` / `Up` |
| Fast-fall | `S` / `Down` (in the air) |
| Dash (i-frames) | `Shift` |
| Aim & shoot | Mouse (hold to fire) |
| Switch weapon | `Q`, or `1` `2` `3` |
| Pause | `P` |
| Restart | `R` |

## What's in it

- **Movement:** acceleration/friction, coyote time (jump shortly after leaving a ledge),
  jump buffering, variable jump height, double jump, wall slide + wall jump.
- **Dash** with brief invulnerability frames and a cooldown meter.
- **3 weapons:** Pistol (fast, single shot), Shotgun (7-pellet spread, big knockback),
  SMG (rapid fire, spread).
- **3 enemy types:** Walkers (patrol, turn at ledges), Flyers (hover and chase),
  Shooters (fire aimed projectiles).
- **Stomping:** land on an enemy to kill it and bounce.
- **Pickups:** coins (score) and health packs.
- **Hazards:** spikes, and one bottomless pit.
- Particles, muzzle flashes, screen shake, camera follow, parallax background,
  WebAudio sound effects (no audio files).
- Death / win / pause states with score.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page shell + canvas + controls hint |
| `style.css` | Fullscreen canvas, HUD hint styling |
| `game.js` | The whole game |

## Tuning

Most of the game feel lives at the top of `game.js`:

- `TILE` — tile size in pixels (40).
- `COLS` / `ROWS` — level dimensions in tiles.
- Gravity, top speed, jump strength — inside `updatePlayer()`.
- `WEAPONS` — add or edit weapons (cooldown, pellets, spread, speed, damage, knockback).
- `buildLevel()` — the level itself, built from rectangles:

```js
const rect = (x, y, w, h, v = SOLID) => { ... };   // paint solid/spike tiles
rect(10, 20, 4, 1);        // a 4-wide platform
walker(10, 24);            // an enemy standing on a solid tile
flyer(21, 20);             // a flying enemy
coin(10, 19);              // a coin
heal(14, 18);              // a health pack
```

Tile values: `EMPTY` (0), `SOLID` (1), `SPIKE` (2). The level is 90 x 26 tiles.

## Notes

- The game runs at a fixed 60 Hz simulation step, decoupled from render rate.
- Sound needs one click/keypress first (browser autoplay policy) — it starts
  automatically the first time you shoot or jump.
