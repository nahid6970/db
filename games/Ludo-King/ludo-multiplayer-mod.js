/**
 * Ludo Multiplayer Sync Module
 * ----------------------------
 * A reusable module for managing real-time game state across multiple devices 
 * using Convex as the backend source of truth.
 * 
 * Features:
 * - Real-time polling with "Revert-Flicker" protection.
 * - Player-indexed authentication and locking.
 * - Unified state management for dice, tokens, and winners.
 */

import { ConvexHttpClient } from "https://esm.sh/convex@1.16.0/browser";

export class GameSyncManager {
    constructor(convexUrl, options = {}) {
        this.client = new ConvexHttpClient(convexUrl);
        this.pollingInterval = options.interval || 500;
        this.localState = null;
        this.currentUser = null;
        this.onStateChange = options.onStateChange || (() => {});
        this.timer = null;
    }

    // --- AUTHENTICATION ---
    
    /**
     * Authenticate a user and map them to a player index.
     * @param {string} username e.g., 'p1'
     * @param {number} playerIdx e.g., 0
     */
    login(username, playerIdx) {
        this.currentUser = { username, playerIdx };
        localStorage.setItem('gameUser', JSON.stringify(this.currentUser));
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('gameUser');
    }

    loadSession() {
        const saved = localStorage.getItem('gameUser');
        if (saved) this.currentUser = JSON.parse(saved);
        return this.currentUser;
    }

    // --- STATE MANAGEMENT ---

    /**
     * Start the real-time syncing heartbeat.
     */
    startSync() {
        this.updateFromRemote();
        this.timer = setInterval(() => this.updateFromRemote(), this.pollingInterval);
    }

    stopSync() {
        if (this.timer) clearInterval(this.timer);
    }

    async updateFromRemote() {
        try {
            const state = await this.client.query("game:getGameState");
            if (!state) return;

            // Protection Logic: Only update if remote state is actually NEWER
            const serverTurnId = parseInt(state.turnId) || 0;
            const localTurnId = this.localState ? (parseInt(this.localState.turnId) || 0) : 0;

            if (!this.localState || serverTurnId > localTurnId || (serverTurnId === localTurnId && state.timestamp > this.localState.timestamp)) {
                this.localState = state;
                this.onStateChange(state);
            }
        } catch (err) {
            console.error("Sync Error:", err);
        }
    }

    /**
     * Sends a state update to the cloud.
     * @param {Object} patch The changes to apply to the state.
     */
    async pushState(patch) {
        if (!this.localState) return;
        
        // Optimistic Update
        this.localState = { ...this.localState, ...patch, timestamp: Date.now() };
        this.onStateChange(this.localState);
        
        // Push to Convex
        await this.client.mutation("game:setState", { patch: this.localState });
    }

    // --- GAME GATING ---

    /**
     * Verification helper: Checks if the current action is allowed for the logged-in user.
     * @param {number} actionPlayerIdx The index of the player whose turn it is.
     */
    canInteract(actionPlayerIdx) {
        return this.currentUser && this.currentUser.playerIdx === actionPlayerIdx;
    }
}
