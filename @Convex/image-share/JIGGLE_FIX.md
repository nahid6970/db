# Folder Bar Jiggle / Flicker Fix

## Symptoms
- Folder bar / subfolder breadcrumb flickering rapidly between states
- `[CONVEX M(images:updateSettings)] Documents read from or written to the "settings" table changed` errors in logs repeating every ~2 seconds
- App constantly re-rendering even with no user interaction

## Root Causes Found

### 1. `persistUiState` called inside server subscription callbacks
`applyPersistedUiState()` was being called on every folder update, and it called `persistUiState()` (writes to Convex), which triggered another settings subscription update → infinite write loop.

**Fix:** Removed `void persistUiState()` from `applyPersistedUiState` and `normalizeCurrentFolderId`. These should only be called from explicit user actions.

### 2. `remoteFolderId` re-set on every settings update
The settings `onUpdate` callback unconditionally set `remoteFolderId = settings.currentFolderId` on every fire, causing `applyPersistedUiState` to overwrite `currentFolderId` repeatedly — even after the user had navigated to a subfolder.

**Fix:** `remoteFolderId` is now only set on the first settings hydration (`isFirstSettings` flag).

### 3. `normalizeCurrentFolderId` called on every folder subscription update
This function resets `currentFolderId = null` if the folder isn't in the list. Convex can fire subscription updates where a folder momentarily appears missing, causing `currentFolderId` to reset → `subscribeToImages()` re-fired → gallery flicker.

**Fix:** `normalizeCurrentFolderId` now only runs on the very first folder load (`firstLoad` flag in `subscribeToFolders`).

### 4. `applyPersistedUiState` called on every folder subscription update
The folder `onUpdate` callback was calling `applyPersistedUiState()` on every update, which re-ran the entire init flow including potential `persistUiState` writes.

**Fix:** Removed `applyPersistedUiState()` call from folder subscription callback entirely.

## Live Cross-Device Folder Sync

To support real-time folder sync across devices without the write-back loop, a `_lastAppliedRemoteFolder` marker is used:

- When **this device** changes folder: sets `window._lastAppliedRemoteFolder = folderId` before writing to Convex
- When settings subscription fires: only navigates if `nextFolderId !== _lastAppliedRemoteFolder` (i.e., another device changed it)
- This suppresses the echo from our own write while allowing other devices' changes to come through live

## Key Rule
> **Never call `persistUiState()` (or any Convex mutation) from inside a Convex subscription callback.**
> Subscriptions should only update local UI state. Writes to Convex must only happen from explicit user actions.
