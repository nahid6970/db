# Migration Plan: Convex Backend to Python (Flask) & MySQL

This document outlines the architecture and implementation steps to migrate the Gallery Application from a Convex backend to a self-hosted Python (Flask/FastAPI) backend with a MySQL database and local file storage.

---

## 1. Architecture Overview

Currently, the application is serverless:
*   **Frontend:** HTML5 Canvas, `pdf.js`, `pdf-lib`, `jsPDF`.
*   **Database & Storage:** Convex Database and Convex Storage.

After migrating to Python + MySQL:
```
┌────────────────────────────────┐
│         Client Browser         │
│  (HTML5, pdf.js, pdf-lib)      │
└───────────────┬────────────────┘
                │ HTTP Requests
                ▼
┌────────────────────────────────┐
│      Python Flask Server       │
│  (Serves endpoints & files)    │
└───────────────┬──────────────┬─┘
                │ SQL          │ Local File writes
                ▼              ▼
┌────────────────┐      ┌────────────────┐
│ MySQL Database │      │  Local Disk    │
│ (Metadata DB)  │      │ (/uploads/...) │
└────────────────┘      └────────────────┘
```

---

## 2. MySQL Database Schema

You will need a MySQL database (e.g. named `gallery_db`) with a table replacing the Convex `images` schema.

```sql
CREATE DATABASE IF NOT EXISTS gallery_db;
USE gallery_db;

-- Folders Table
CREATE TABLE IF NOT EXISTS folders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    password VARCHAR(255) DEFAULT NULL,
    color VARCHAR(7) DEFAULT NULL, -- Hex code (e.g., #ff0000)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Images/PDFs Table
CREATE TABLE IF NOT EXISTS images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    url VARCHAR(512) NOT NULL,            -- e.g., "/uploads/document.pdf"
    filename VARCHAR(255) NOT NULL,
    file_size INT DEFAULT NULL,           -- size in bytes
    folder_id INT DEFAULT NULL,           -- FK referencing folders(id)
    timestamp BIGINT NOT NULL,            -- Unix millisecond timestamp
    pinned BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
);
```

---

## 3. Python Flask Backend (`app.py`)

Below is a complete Flask server implementation to host the gallery, serve uploaded files, and expose REST APIs for saving files (including edited PDFs and images).

```python
import os
import time
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import mysql.connector

app = Flask(__name__, static_folder=".")
CORS(app) # Enable CORS if frontend and backend run on different ports

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Database Connection Helper
def get_db_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="your_mysql_password",
        database="gallery_db"
    )

# Serve Frontend (index.html)
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

# Serve Uploaded Files
@app.route('/uploads/<filename>')
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

# Fetch All Images & Folders
@app.route('/api/gallery', methods=['GET'])
def get_gallery():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("SELECT * FROM folders")
    folders = cursor.fetchall()
    
    cursor.execute("SELECT * FROM images ORDER BY pinned DESC, timestamp DESC")
    images = cursor.fetchall()
    
    cursor.close()
    conn.close()
    
    return jsonify({
        "folders": folders,
        "images": images
    })

# API to Handle Standard & Edited Uploads (Replaces Convex Save Mutations)
@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    folder_id = request.form.get('folderId')
    original_id = request.form.get('originalId') # Provided if editing an existing file
    
    # 1. Generate unique filename to prevent collisions
    ext = os.path.splitext(file.filename)[1]
    safe_filename = f"{int(time.time() * 1000)}{ext}"
    file_path = os.path.join(UPLOAD_FOLDER, safe_filename)
    
    # 2. Save physical file to disk
    file.save(file_path)
    file_size = os.path.getsize(file_path)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 3. If replacing an edited file, clean up old record and disk file
    if original_id:
        cursor.execute("SELECT url FROM images WHERE id = %s", (original_id,))
        old_record = cursor.fetchone()
        if old_record:
            old_url = old_record[0]
            old_filename = old_url.split('/')[-1]
            old_filepath = os.path.join(UPLOAD_FOLDER, old_filename)
            if os.path.exists(old_filepath):
                try:
                    os.remove(old_filepath)
                except Exception as e:
                    print(f"Failed to delete old file: {e}")
                    
        # Delete old record
        cursor.execute("DELETE FROM images WHERE id = %s", (original_id,))
        
    # 4. Insert new record
    cursor.execute(
        "INSERT INTO images (url, filename, file_size, folder_id, timestamp) VALUES (%s, %s, %s, %s, %s)",
        (f"/uploads/{safe_filename}", file.filename, file_size, folder_id or None, int(time.time() * 1000))
    )
    new_id = cursor.lastrowid
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({
        "success": True, 
        "id": new_id, 
        "url": f"/uploads/{safe_filename}"
    })

# API to Delete a File
@app.route('/api/images/<int:image_id>', methods=['DELETE'])
def delete_image(image_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT url FROM images WHERE id = %s", (image_id,))
    record = cursor.fetchone()
    if not record:
        cursor.close()
        conn.close()
        return jsonify({"error": "File not found"}), 404
        
    url = record[0]
    filename = url.split('/')[-1]
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    
    # Delete from Disk
    if os.path.exists(filepath):
        os.remove(filepath)
        
    # Delete from DB
    cursor.execute("DELETE FROM images WHERE id = %s", (image_id,))
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({"success": True})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```

---

## 4. Frontend Adjustments (`index.html`)

### A. Initializing Data
Instead of loading data through the Convex WebSocket subscription, query the Python REST API on page load:
```javascript
async function loadGalleryData() {
  const res = await fetch('/api/gallery');
  const data = await res.json();
  
  // Replace the reactive window variables
  window.folders = data.folders;
  window._lastImages = data.images;
  
  renderFolderBar();
  renderImages();
}
```

### B. Standard File Upload (`performUpload`)
Replace the standard upload block with an HTTP `POST` to Flask:
```javascript
window.performUpload = async function(file) {
  const status = document.getElementById('status');
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (currentFolderId && currentFolderId !== 'none' && currentFolderId !== 'shared') {
      formData.append('folderId', currentFolderId);
    }
    
    status.textContent = `Uploading ${file.name}...`;
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    const result = await res.json();
    if (result.success) {
      status.textContent = 'Upload successful!';
      await loadGalleryData(); // Refresh UI
      return true;
    }
    return false;
  } catch (error) {
    status.textContent = 'Upload failed.';
    return false;
  }
};
```

### C. Canvas Save Editor (`savePaint`)
Update the `savePaint` function inside the editor script to send the transparent drawing overlays/flattened images directly to Python, cleaning up the original file ID:
```javascript
// ... [In savePaint, after compiling the PDF or JPEG blob] ...
const formData = new FormData();
formData.append('file', blob, _paintFilename);
formData.append('originalId', _paintId);
if (_paintFolderId) {
  formData.append('folderId', _paintFolderId);
}

try {
  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });
  const result = await res.json();
  if (result.success) {
    closePaintEditor();
    await loadGalleryData(); // Refresh UI
  } else {
    alert('Save failed.');
  }
} catch (err) {
  alert('Save failed: ' + err.message);
}
```

---

## 5. Why the Canvas Editor Remains Fully Intact

1.  **Canvas Drawing:** Brush strokes, shapes, overlays, and Undo/Redo actions exist purely within browser memory via standard HTML5 `<canvas>` Context2D calls.
2.  **PDF.js Rendering:** `pdfjsLib.getDocument()` takes the file URL (e.g. `/uploads/xxxx.pdf`) and draws it onto a canvas. Flask serving the static files makes this seamless.
3.  **pdf-lib Rebuilding:** `PDFDocument.load()` receives the original PDF bytes fetched from `/uploads/xxxx.pdf`, and modifies them locally inside your browser, outputting standard bytes.
4.  **No Server-Side PDF Processing Needed:** The Python server doesn't need PyPDF, pdf-lib, or any PDF software. It only handles simple HTTP byte streams and saves the resultant file directly to your disk.
