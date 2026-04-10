# Multi-Device Synchronization Guide 🚀

This guide explains how to implement the real-time syncing system used in Ludo Master for your other projects.

## 1. The Core Architecture
The system uses a **Polled Source of Truth** model.
- **Backend (Convex):** Holds the master `game_state`.
- **Frontend (Browser):** Regularly polls the backend and updates the board if the remote state is newer.

## 2. Reusable Sync Logic (JavaScript)

```javascript
/**
 * REUSABLE MULTIPLAYER SYNC MODULE
 */
import { ConvexHttpClient } from \"https://esm.sh/convex@1.16.0/browser\";

export class GameSyncManager {
    constructor(convexUrl, options = {}) {
        this.client = new ConvexHttpClient(convexUrl);
        this.pollingInterval = options.interval || 500;
        this.localState = null;
        this.currentUser = null;
        this.onStateChange = options.onStateChange || (() => {});
    }

    // Auth & Permission Mapping
    login(username, playerIdx) {
        this.currentUser = { username, playerIdx };
        localStorage.setItem('gameUser', JSON.stringify(this.currentUser));
    }

    // The Sync Heartbeat
    startSync() {
        setInterval(async () => {
            const state = await this.client.query(\"game:getGameState\");
            if (!state) return;

            // --- REVERT-FLICKER PROTECTION ---
            // Only update if the remote state is actually NEWER
            const serverId = parseInt(state.turnId) || 0;
            const localId = this.localState ? parseInt(this.localState.turnId) : 0;

            if (!this.localState || serverId > localId || (serverId === localId && state.timestamp > this.localState.timestamp)) {
                this.localState = state;
                this.onStateChange(state);
            }
        }, this.pollingInterval);
    }

    // Secure Interaction
    canInteract(playerIdx) {
        return this.currentUser && this.currentUser.playerIdx === playerIdx;
    }

    // Push State to Cloud
    async pushState(patch) {
        await this.client.mutation(\"game:setState\", { patch });
    }
}
```

## 3. How to Implement in a New Project

### Step 1: Initialize
```javascript
const sync = new GameSyncManager(\"https://your-convex-url.cloud\", {
    onStateChange: (newState) => updateMyGameUI(newState)
});
sync.startSync();
```

### Step 2: Lock Interactions
Prevent players from clicking buttons that don't belong to them:
```javascript
function onTokenClick(tokenId) {
    const playerIdx = getPlayerOfToken(tokenId);
    if (!sync.canInteract(playerIdx)) {
        console.warn(\"Not your piece!\");
        return;
    }
    // Proceed with move...
}
```

### Step 3: Broadcast Changes
Every time a game action occurs, sync it to the cloud:
```javascript
function makeMove() {
   const newState = calculateNewState();
   sync.pushState(newState); 
}
```

---
**Happy Coding!** 🎮
