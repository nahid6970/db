# Python Server Integration - Universal Guide

## Overview

This guide shows you how to integrate ANY Chrome extension with the Python server for automatic data backup.

## Step-by-Step Integration

### Step 1: Create background.js

Create a new file called `background.js` in your extension folder:

```javascript
// Background script for Python server integration
const PYTHON_SERVER = 'http://localhost:8765';
const EXTENSION_NAME = 'your_extension_name';  // ⚠️ CHANGE THIS
const FILE_NAME = 'your_data.json';            // ⚠️ CHANGE THIS

// Send data to Python server
async function sendDataToPython(data) {
  try {
    const response = await fetch(PYTHON_SERVER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extension_name: EXTENSION_NAME,
        file_name: FILE_NAME,
        data: data
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Data saved to Python server:', result);
    return result;
  } catch (error) {
    console.error('Failed to send data to Python server:', error);
    return { success: false, error: error.message };
  }
}

// Auto-save on storage changes
chrome.storage.local.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    chrome.storage.local.get(null, (items) => {
      sendDataToPython(items);
    });
  }
});

// Load data from Python server
async function loadDataFromPython() {
  try {
    const response = await fetch(`${PYTHON_SERVER}/load?extension_name=${EXTENSION_NAME}&file_name=${FILE_NAME}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Data loaded from Python server:', result);
    return result;
  } catch (error) {
    console.error('Failed to load data from Python server:', error);
    return { success: false, error: error.message };
  }
}

// Handle manual save/load requests from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveToPython') {
    sendDataToPython(message.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
  
  if (message.action === 'loadFromPython') {
    loadDataFromPython()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

// Health check on startup
chrome.runtime.onStartup.addListener(() => {
  fetch(`${PYTHON_SERVER}/health`)
    .then(response => response.json())
    .then(data => console.log('Python server status:', data))
    .catch(error => console.log('Python server not available:', error.message));
});

// Initial health check
fetch(`${PYTHON_SERVER}/health`)
  .then(response => response.json())
  .then(data => console.log('Python server status:', data))
  .catch(error => console.log('Python server not available:', error.message));
```

**⚠️ IMPORTANT:** Change these values:
- `EXTENSION_NAME` - Folder name where data will be saved (e.g., 'todo_app', 'notes_ext')
- `FILE_NAME` - Name of the JSON file (e.g., 'todos.json', 'notes.json')

### Step 2: Update manifest.json

Add these two sections to your `manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Your Extension Name",
  "version": "1.0",
  
  "host_permissions": [
    "http://localhost:8765/*"
  ],
  
  "background": {
    "service_worker": "background.js"
  }
}
```

If you already have `host_permissions`, just add `"http://localhost:8765/*"` to the array.

### Step 3: Add Manual Save/Load Buttons (Optional)

#### A. Add buttons to your popup HTML:

```html
<button id="saveToPython" style="background: #9C27B0; color: white; padding: 10px;">
    Save to Python Server
</button>
<button id="loadFromPython" style="background: #673AB7; color: white; padding: 10px;">
    Load from Python Server
</button>
```

#### B. Add this code to your popup JavaScript:

```javascript
// Save to Python server button
const saveToPythonBtn = document.getElementById('saveToPython');
const loadFromPythonBtn = document.getElementById('loadFromPython');

if (saveToPythonBtn) {
    saveToPythonBtn.addEventListener('click', function () {
        chrome.storage.local.get(null, function (items) {
            // Send message to background script to save
            chrome.runtime.sendMessage({
                action: 'saveToPython',
                data: items
            }, function (response) {
                // Check if response exists and doesn't have success: false
                if (response && response.success !== false) {
                    alert('Data saved to Python server!');
                } else {
                    alert('Failed to save to Python server. Make sure the server is running.');
                }
            });
        });
    });
}

// Load from Python server button
if (loadFromPythonBtn) {
    loadFromPythonBtn.addEventListener('click', function () {
        chrome.runtime.sendMessage({
            action: 'loadFromPython'
        }, function (response) {
            if (response && response.success && response.data) {
                chrome.storage.local.set(response.data, () => {
                    alert('Data loaded from Python server! Refresh pages to see changes.');
                    // Notify all tabs to refresh
                    chrome.tabs.query({}, (tabs) => {
                        tabs.forEach(tab => {
                            chrome.tabs.sendMessage(tab.id, { action: "refresh_highlights" }).catch(() => { });
                        });
                    });
                });
            } else {
                alert('Failed to load from Python server. Make sure the server is running.');
            }
        });
    });
}
```

**⚠️ CRITICAL:** Use `response.success !== false` NOT `response.success === true`

The Python server returns `{"status": "success"}` not `{"success": true}`, so checking for `!== false` works correctly.

## Usage

### 1. Start Python Server
```bash
python extension_manager.py
```
Server runs on `http://localhost:8765`

### 2. Reload Your Extension
1. Go to `chrome://extensions/`
2. Enable Developer Mode
3. Click reload icon on your extension

### 3. Test It!
- Make changes in your extension (add data, modify settings, etc.)
- Data auto-saves to: `extension_data/[EXTENSION_NAME]/[FILE_NAME]`
- Or click the manual save button
- Click the load button to restore data from the server

## Features

✅ **Auto-save** - Data saves automatically on every storage change
✅ **Manual save** - Optional button for on-demand saves
✅ **Manual load** - Optional button to restore data from Python server
✅ **Works offline** - Extension works even if server is down
✅ **Health checks** - Verifies server connection on startup
✅ **No data loss** - Extension continues working normally if server is unavailable

## File Structure

```
extension_data/
├── extension1/
│   └── data.json
├── todo_app/
│   └── todos.json
└── notes_ext/
    └── notes.json
```

Each extension saves to its own folder!

## Configuration Examples

### Example 1: Todo Extension
```javascript
const EXTENSION_NAME = 'todo_app';
const FILE_NAME = 'todos.json';
```
Saves to: `extension_data/todo_app/todos.json`

### Example 2: Notes Extension
```javascript
const EXTENSION_NAME = 'notes_ext';
const FILE_NAME = 'my_notes.json';
```
Saves to: `extension_data/notes_ext/my_notes.json`

### Example 3: Bookmark Manager
```javascript
const EXTENSION_NAME = 'bookmark_manager';
const FILE_NAME = 'bookmarks.json';
```
Saves to: `extension_data/bookmark_manager/bookmarks.json`

## Troubleshooting

### "Failed to save" alert appears even when it works

**Problem:** Using `if (response.success)` instead of `if (response.success !== false)`

**Solution:** The Python server returns `{"status": "success"}` not `{"success": true}`. Use this check:
```javascript
if (response && response.success !== false) {
    // Success!
}
```

### No auto-save happening

**Causes:**
- Python server not running
- Extension not reloaded after adding background.js
- Wrong `host_permissions` in manifest.json

**Solutions:**
1. Start Python server: `python extension_manager.py`
2. Reload extension in `chrome://extensions/`
3. Check console for errors (F12 → Console)
4. Verify `background.js` is in extension folder

### CORS errors

**Solution:** Server already handles CORS. Make sure you're using:
- ✅ `http://localhost:8765` 
- ❌ NOT `http://127.0.0.1:8765`

### Extension not loading

**Causes:**
- Syntax error in background.js
- Missing comma in manifest.json

**Solutions:**
1. Check `chrome://extensions/` for error messages
2. Validate manifest.json syntax
3. Check browser console for JavaScript errors

## Advanced: Custom Port

If you need to use a different port:

1. Edit `extension_manager.py`:
```python
PORT = 9000  # Your custom port
```

2. Edit `background.js`:
```javascript
const PYTHON_SERVER = 'http://localhost:9000';
```

3. Update `manifest.json`:
```json
"host_permissions": [
  "http://localhost:9000/*"
]
```

## Running Python Server on Startup

### Windows
Create `start_server.bat`:
```batch
@echo off
python C:\path\to\extension_manager.py
pause
```
Add to Windows Startup folder.

### Linux/Mac
Add to crontab:
```bash
crontab -e
```
Add line:
```bash
@reboot python /path/to/extension_manager.py
```

Or create a systemd service for better control.

## Summary Checklist

For each extension you want to integrate:

- [ ] Create `background.js` with correct `EXTENSION_NAME` and `FILE_NAME`
- [ ] Add `host_permissions` to `manifest.json`
- [ ] Add `background` service worker to `manifest.json`
- [ ] (Optional) Add save button to popup HTML
- [ ] (Optional) Add load button to popup HTML
- [ ] (Optional) Add save/load button handlers to popup JS with `success !== false` check
- [ ] Start Python server
- [ ] Reload extension
- [ ] Test by making changes in extension
- [ ] Verify file created in `extension_data/[EXTENSION_NAME]/`
- [ ] Test load button to restore data from server

## Need Help?

Common issues:
1. **Alert shows "Failed" but data saves** → Fix response check to `success !== false`
2. **No auto-save** → Reload extension after starting server
3. **CORS error** → Use `localhost` not `127.0.0.1`
4. **Extension won't load** → Check for syntax errors in background.js
