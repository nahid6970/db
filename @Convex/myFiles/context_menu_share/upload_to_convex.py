import sys
import os
import requests
from PyQt6.QtWidgets import (QApplication, QWidget, QVBoxLayout, QLabel, 
                             QPushButton, QScrollArea, QFrame, QHBoxLayout,
                             QFileDialog)
from PyQt6.QtCore import QThread, pyqtSignal, Qt, QTimer
from PyQt6.QtNetwork import QLocalServer, QLocalSocket

# CYBERPUNK THEME PALETTE (Match index.html vibes)
CP_BG = "#050505"
CP_PANEL = "#111111"
CP_YELLOW = "#FCEE0A"
CP_CYAN = "#00F0FF"
CP_RED = "#FF003C"
CP_GREEN = "#00ff21"
CP_DIM = "#3a3a3a"
CP_TEXT = "#E0E0E0"

CONVEX_URL = "https://good-basilisk-52.convex.cloud"
SERVER_NAME = "convex_upload_manager_v2"

class ProgressFile(object):
    def __init__(self, file_path, callback):
        self.file_path = file_path
        self.callback = callback
        self.total_size = os.path.getsize(file_path)
        self.bytes_read = 0
        self.f = open(file_path, 'rb')

    def __len__(self):
        return self.total_size

    def read(self, size=-1):
        chunk = self.f.read(size)
        if chunk:
            self.bytes_read += len(chunk)
            self.callback(self.bytes_read, self.total_size)
        return chunk

    def close(self):
        self.f.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

class UploadThread(QThread):
    # success, filename, message
    finished = pyqtSignal(bool, str, str)
    # percent
    progress = pyqtSignal(int)
    
    def __init__(self, file_path):
        super().__init__()
        self.file_path = file_path
    
    def run(self):
        file_name = os.path.basename(self.file_path)
        try:
            # Get upload URL
            response = requests.post(f"{CONVEX_URL}/api/mutation", json={
                "path": "files:generateUploadUrl",
                "args": {}
            })
            upload_url = response.json()["value"]
            
            # Upload file
            def update_cb(current, total):
                percent = int((current / total) * 100)
                self.progress.emit(percent)

            with ProgressFile(self.file_path, update_cb) as f:
                # Raw binary POST to Convex storage URL
                upload_response = requests.post(upload_url, data=f, headers={
                    "Content-Type": "application/octet-stream"
                })
            
            storage_id = upload_response.json()["storageId"]
            
            # Add to database
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
            
            self.finished.emit(True, file_name, "COMPLETED")
        except Exception as e:
            self.finished.emit(False, file_name, str(e))

class FileItem(QFrame):
    def __init__(self, file_path):
        super().__init__()
        self.file_path = file_path
        self.file_name = os.path.basename(file_path)
        self.is_done = False
        self.init_ui()
        
    def init_ui(self):
        self.setFrameShape(QFrame.Shape.NoFrame)
        self.setStyleSheet(f"border-bottom: 1px solid {CP_DIM}; background-color: {CP_PANEL}; margin: 2px;")
        self.setFixedHeight(60)
        
        layout = QHBoxLayout(self)
        layout.setContentsMargins(15, 5, 15, 5)
        
        # File Icon (box)
        self.icon_box = QLabel(os.path.splitext(self.file_name)[1][1:4].upper() or "FILE")
        self.icon_box.setFixedSize(40, 40)
        self.icon_box.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.icon_box.setStyleSheet(f"""
            background-color: {CP_CYAN}; 
            color: {CP_BG}; 
            font-weight: bold; 
            font-size: 8pt; 
            border-radius: 4px;
        """)
        
        info_layout = QVBoxLayout()
        self.name_label = QLabel(self.file_name)
        self.name_label.setStyleSheet(f"color: {CP_TEXT}; font-weight: bold; border: none;")
        
        self.status_label = QLabel("INITIALIZING...")
        self.status_label.setStyleSheet(f"color: {CP_CYAN}; font-size: 8pt; border: none;")
        
        info_layout.addWidget(self.name_label)
        info_layout.addWidget(self.status_label)
        
        layout.addWidget(self.icon_box)
        layout.addLayout(info_layout)
        layout.addStretch()

    def update_progress(self, percent):
        if not self.is_done:
            self.status_label.setText(f"UPLOADING... {percent}%")

    def update_status(self, success, message):
        self.is_done = True
        if success:
            self.status_label.setText(message)
            self.status_label.setStyleSheet(f"color: {CP_GREEN}; font-size: 8pt; border: none;")
            self.icon_box.setStyleSheet(f"background-color: {CP_GREEN}; color: {CP_BG}; font-weight: bold; font-size: 8pt; border-radius: 4px;")
        else:
            self.status_label.setText(f"ERROR: {message}")
            self.status_label.setStyleSheet(f"color: {CP_RED}; font-size: 8pt; border: none;")
            self.icon_box.setStyleSheet(f"background-color: {CP_RED}; color: {CP_BG}; font-weight: bold; font-size: 8pt; border-radius: 4px;")

class UploadManager(QWidget):
    def __init__(self, server):
        super().__init__()
        self.server = server
        self.setWindowTitle("NEON // UPLOADER")
        self.resize(500, 500)
        self.threads = []
        self.items = []
        self.init_ui()
        
        if self.server:
            self.server.newConnection.connect(self.handle_new_connection)
        
    def init_ui(self):
        self.setStyleSheet(f"""
            QWidget {{ 
                background-color: {CP_BG}; 
                color: {CP_TEXT}; 
                font-family: 'Consolas', monospace;
            }}
            QScrollArea {{ 
                border: 1px solid {CP_DIM}; 
                background-color: {CP_BG};
            }}
            QScrollBar:vertical {{
                border: none;
                background: {CP_BG};
                width: 10px;
                margin: 0px 0px 0px 0px;
            }}
            QScrollBar::handle:vertical {{
                background: {CP_YELLOW};
                min-height: 20px;
                border-radius: 5px;
            }}
            QScrollBar::handle:vertical:hover {{
                background: {CP_CYAN};
            }}
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
                height: 0px;
            }}
            QScrollBar:horizontal {{
                border: none;
                background: {CP_BG};
                height: 10px;
                margin: 0px 0px 0px 0px;
            }}
            QScrollBar::handle:horizontal {{
                background: {CP_YELLOW};
                min-width: 20px;
                border-radius: 5px;
            }}
            QScrollBar::handle:horizontal:hover {{
                background: {CP_CYAN};
            }}
            QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {{
                width: 0px;
            }}
            QPushButton {{ 
                background-color: {CP_PANEL}; 
                border: 1px solid {CP_CYAN}; 
                color: {CP_CYAN}; 
                padding: 10px; 
                font-weight: bold;
            }}
            QPushButton:hover {{ 
                background-color: {CP_CYAN}; 
                color: {CP_BG}; 
            }}
            QPushButton#clear_btn {{
                border-color: {CP_DIM};
                color: {CP_DIM};
            }}
            QPushButton#clear_btn:hover {{
                border-color: {CP_YELLOW};
                color: {CP_YELLOW};
            }}
        """)
        
        layout = QVBoxLayout(self)
        
        header = QHBoxLayout()
        title = QLabel("SYSTEM_UPLOADER // CONVEX")
        title.setStyleSheet(f"color: {CP_YELLOW}; font-size: 14pt; font-weight: bold;")
        header.addWidget(title)
        
        self.add_btn = QPushButton("+ ADD_FILES")
        self.add_btn.setFixedWidth(120)
        self.add_btn.clicked.connect(self.manual_add)
        header.addWidget(self.add_btn)
        
        layout.addLayout(header)
        
        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.scroll_content = QWidget()
        self.scroll_layout = QVBoxLayout(self.scroll_content)
        self.scroll_layout.setAlignment(Qt.AlignmentFlag.AlignTop)
        self.scroll_layout.setSpacing(0)
        self.scroll_layout.setContentsMargins(0, 0, 0, 0)
        self.scroll.setWidget(self.scroll_content)
        layout.addWidget(self.scroll)
        
        btn_layout = QHBoxLayout()
        
        self.clear_btn = QPushButton("CLEAR FINISHED")
        self.clear_btn.setObjectName("clear_btn")
        self.clear_btn.clicked.connect(self.clear_finished)
        btn_layout.addWidget(self.clear_btn)
        
        self.close_btn = QPushButton("CLOSE SESSION")
        self.close_btn.clicked.connect(self.close)
        btn_layout.addWidget(self.close_btn)
        
        layout.addLayout(btn_layout)

    def handle_new_connection(self):
        socket = self.server.nextPendingConnection()
        if socket.waitForReadyRead(2000):
            data = socket.readAll().data().decode('utf-8')
            # Handle potential multiple paths separated by newline
            for path in data.split('\n'):
                if path.strip():
                    self.add_file(path.strip())
            self.activateWindow()
            self.raise_()
        socket.close()

    def add_file(self, file_path):
        if not os.path.exists(file_path):
            return
            
        item = FileItem(file_path)
        self.items.append(item)
        self.scroll_layout.addWidget(item)
        
        thread = UploadThread(file_path)
        thread.finished.connect(item.update_status)
        thread.progress.connect(item.update_progress)
        self.threads.append(thread)
        
        item.status_label.setText("UPLOADING...")
        thread.start()

    def manual_add(self):
        files, _ = QFileDialog.getOpenFileNames(self, "SELECT FILES TO UPLOAD")
        for f in files:
            self.add_file(f)

    def clear_finished(self):
        for item in self.items[:]:
            if item.is_done:
                self.scroll_layout.removeWidget(item)
                item.setParent(None)
                self.items.remove(item)

def get_windows_args():
    """Use Win32 API to get clean Unicode arguments."""
    import ctypes
    from ctypes import wintypes
    
    # Correctly set restype BEFORE calling
    GetCommandLineW = ctypes.windll.kernel32.GetCommandLineW
    GetCommandLineW.restype = wintypes.LPCWSTR
    lpCmdLine = GetCommandLineW()
    
    if not lpCmdLine:
        return sys.argv[1:]
        
    argc = ctypes.c_int(0)
    CommandLineToArgvW = ctypes.windll.shell32.CommandLineToArgvW
    CommandLineToArgvW.argtypes = [wintypes.LPCWSTR, ctypes.POINTER(ctypes.c_int)]
    CommandLineToArgvW.restype = ctypes.POINTER(wintypes.LPWSTR)
    
    argv_ptr = CommandLineToArgvW(lpCmdLine, ctypes.byref(argc))
    
    if not argv_ptr:
        return sys.argv[1:]
        
    args = []
    for i in range(argc.value):
        args.append(argv_ptr[i])
    
    ctypes.windll.kernel32.LocalFree(argv_ptr)
    return args[1:] # Skip the executable/script itself

def main():
    # Logging for debugging
    temp_dir = os.environ.get('TEMP', '')
    log_path = os.path.join(temp_dir, 'convex_uploader.log')
    
    try:
        # Get robust Unicode arguments
        raw_args = get_windows_args()
        
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(f"\n--- SESSION START (Robust Args): {raw_args} ---\n")
            
        app = QApplication(sys.argv)
        
        # Filter out empty args and handle quotes/absolute paths
        # RECONSTRUCT PATHS if they were split by spaces
        file_args = []
        possible_parts = []
        
        for arg in raw_args:
            arg = arg.strip().strip('"')
            if not arg or arg.endswith('.py') or arg.endswith('.exe'):
                continue
                
            # Is it a full path?
            if os.path.exists(arg):
                file_args.append(os.path.abspath(arg))
                continue
                
            # If not, maybe it's part of a path
            possible_parts.append(arg)
            joined = " ".join(possible_parts)
            if os.path.exists(joined):
                file_args.append(os.path.abspath(joined))
                possible_parts = []
            elif os.path.exists(os.path.abspath(joined)): # check relative
                 file_args.append(os.path.abspath(joined))
                 possible_parts = []
        
        # If anything remains in possible_parts, it's either an invalid path or missing parts
        if possible_parts:
             with open(log_path, 'a', encoding='utf-8') as f:
                f.write(f"Warning: Fragments remaining: {possible_parts}\n")

        # Singleton check with retries
        socket = QLocalSocket()
        is_client = False
        
        # Try multiple times to connect in case of simultaneous start
        for _ in range(3):
            socket.connectToServer(SERVER_NAME)
            if socket.waitForConnected(300):
                is_client = True
                break
            QTimer.singleShot(100, lambda: None)

        if is_client:
            if file_args:
                paths = "\n".join(file_args)
                socket.write(paths.encode('utf-8'))
                socket.waitForBytesWritten(1000)
            socket.disconnectFromServer()
            return

        # Attempt to become server
        server = QLocalServer()
        QLocalServer.removeServer(SERVER_NAME)
        if not server.listen(SERVER_NAME):
            socket.connectToServer(SERVER_NAME)
            if socket.waitForConnected(500):
                if file_args:
                    paths = "\n".join(file_args)
                    socket.write(paths.encode('utf-8'))
                    socket.waitForBytesWritten(1000)
                return
            
        manager = UploadManager(server)
        manager.show()
        
        if file_args:
            for path in file_args:
                manager.add_file(path)
            
        sys.exit(app.exec())
    except Exception as e:
        import traceback
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(f"FATAL ERROR: {str(e)}\n")
            f.write(traceback.format_exc())
        # Show error in a message box if GUI fails
        try:
            from PyQt6.QtWidgets import QMessageBox
            if 'app' in locals():
                QMessageBox.critical(None, "Uploader Error", f"Fatal Error: {str(e)}\n\nCheck log: {log_path}")
        except:
            pass
        raise e

if __name__ == "__main__":
    main()
