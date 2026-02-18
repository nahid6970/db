import sys
import os
import requests
from PyQt6.QtWidgets import QApplication, QMessageBox, QProgressDialog
from PyQt6.QtCore import QThread, pyqtSignal, Qt, QTimer

# CYBERPUNK THEME PALETTE
CP_BG = "#050505"
CP_PANEL = "#111111"
CP_YELLOW = "#FCEE0A"
CP_CYAN = "#00F0FF"
CP_RED = "#FF003C"
CP_GREEN = "#00ff21"
CP_DIM = "#3a3a3a"
CP_TEXT = "#E0E0E0"

CONVEX_URL = "https://good-basilisk-52.convex.cloud"

class UploadThread(QThread):
    finished = pyqtSignal(bool, str)
    
    def __init__(self, file_path):
        super().__init__()
        self.file_path = file_path
    
    def run(self):
        try:
            # Get upload URL
            response = requests.post(f"{CONVEX_URL}/api/mutation", json={
                "path": "files:generateUploadUrl",
                "args": {}
            })
            upload_url = response.json()["value"]
            
            # Upload file
            with open(self.file_path, 'rb') as f:
                upload_response = requests.post(upload_url, files={'file': f})
            storage_id = upload_response.json()["storageId"]
            
            # Add to database
            file_name = os.path.basename(self.file_path)
            file_size = os.path.getsize(self.file_path)
            file_type = os.path.splitext(file_name)[1][1:] or "file"
            
            requests.post(f"{CONVEX_URL}/api/mutation", json={
                "path": "files:add",
                "args": {
                    "storageId": storage_id,
                    "filename": file_name,
                    "fileType": file_type,
                    "fileSize": file_size
                }
            })
            
            self.finished.emit(True, file_name)
        except Exception as e:
            self.finished.emit(False, str(e))

def upload_file(file_path):
    app = QApplication(sys.argv)
    
    # Apply Cyberpunk Theme
    app.setStyleSheet(f"""
        QWidget {{ 
            color: {CP_TEXT}; 
            font-family: 'Consolas'; 
            font-size: 10pt; 
            background-color: {CP_BG};
        }}
        QProgressDialog {{
            background-color: {CP_PANEL};
            border: 1px solid {CP_CYAN};
        }}
        QLabel {{
            color: {CP_CYAN};
        }}
        QMessageBox {{
            background-color: {CP_PANEL};
        }}
        QPushButton {{
            background-color: {CP_DIM}; 
            border: 1px solid {CP_DIM}; 
            color: white; 
            padding: 6px 12px; 
            font-weight: bold;
        }}
        QPushButton:hover {{
            background-color: #2a2a2a; 
            border: 1px solid {CP_YELLOW}; 
            color: {CP_YELLOW};
        }}
    """)
    
    # Show progress dialog
    progress = QProgressDialog(f"Uploading {os.path.basename(file_path)}...", None, 0, 0)
    progress.setWindowTitle("Uploading")
    progress.setWindowModality(Qt.WindowModality.ApplicationModal)
    progress.setCancelButton(None)
    progress.setMinimumDuration(0)
    progress.setMinimumWidth(400)
    progress.setMinimumHeight(120)
    progress.show()
    
    # Start upload
    thread = UploadThread(file_path)
    
    def on_finished(success, message):
        if success:
            progress.setLabelText(f"✓ {message} uploaded!")
            QTimer.singleShot(1500, app.quit)
        else:
            progress.setLabelText(f"✗ Upload failed: {message}")
            QTimer.singleShot(3000, app.quit)
    
    thread.finished.connect(on_finished)
    thread.start()
    
    # Keep window open for 1 second after completion
    sys.exit(app.exec())

if __name__ == "__main__":
    if len(sys.argv) > 1:
        upload_file(sys.argv[1])
    else:
        app = QApplication(sys.argv)
        QMessageBox.warning(None, "Error", "No file specified!")
        sys.exit(1)
