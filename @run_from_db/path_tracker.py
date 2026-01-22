import sys
import os
import json
import re
import hashlib
from datetime import datetime
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
                             QLabel, QPushButton, QLineEdit, QGroupBox, QFormLayout, 
                             QTextEdit, QListWidget, QFileDialog, QCheckBox, QComboBox, 
                             QProgressBar, QMessageBox, QFrame, QSplitter)
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QObject
from PyQt6.QtGui import QIcon, QFont, QTextCursor

# ————— CYBERPUNK THEME PALETTE —————
CP_BG = "#050505"           # Main Window Background
CP_PANEL = "#111111"        # Panel/Input Background
CP_YELLOW = "#FCEE0A"       # Accent: Yellow
CP_CYAN = "#00F0FF"         # Accent: Cyan
CP_RED = "#FF003C"          # Accent: Red
CP_GREEN = "#00ff21"        # Accent: Green
CP_ORANGE = "#ff934b"       # Accent: Orange
CP_DIM = "#3a3a3a"          # Dimmed/Borders/Inactive
CP_TEXT = "#E0E0E0"         # Primary Text
CP_SUBTEXT = "#808080"      # Secondary Text

# ————— DEFAULT CONFIG —————
DEFAULT_EXTENSIONS = ".py, .ahk, .ps1, .bat, .txt, .json, .xml, .yaml, .yml, .md, .html, .css, .js, .ts, .sql, .ini, .cfg, .conf, .log"
DEFAULT_SKIP = ".git, __pycache__, .vscode, node_modules"
SAVE_FILE = r"C:\Users\nahid\script_output\paths_before.json"
LOG_FILE_PATH = r"C:\Users\nahid\script_output\path_replacements.log"

# Binary file extensions to skip during reference replacement
BINARY_EXTENSIONS = (
    '.exe', '.dll', '.bin', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.ico',
    '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.mp3', '.wav', '.flac', '.ogg',
    '.iso', '.img', '.dmg', '.vhd', '.vmdk',
    '.db', '.sqlite', '.mdb', '.accdb',
    '.so', '.dylib', '.lib', '.a', '.o', '.obj',
    '.class', '.jar', '.war', '.ear',
    '.pyc', '.pyo', '.pyd'
)

# ————— LOGIC HELPERS —————

def hash_file(path):
    h = hashlib.sha256()
    try:
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return None

def is_binary_file(path):
    return any(path.lower().endswith(ext) for ext in BINARY_EXTENSIONS)

# ————— WORKER THREAD —————

class WorkerSignals(QObject):
    log = pyqtSignal(str)
    finished = pyqtSignal()
    error = pyqtSignal(str)

class LogicWorker(QThread):
    def __init__(self, mode, config, folders):
        super().__init__()
        self.mode = mode  # 'scan' or 'update'
        self.config = config
        self.folders = folders
        self.signals = WorkerSignals()
        self.is_running = True

    def run(self):
        try:
            if self.mode == 'scan':
                self.save_snapshot()
            elif self.mode == 'update':
                self.update_references()
        except Exception as e:
            self.signals.error.emit(str(e))
        finally:
            self.signals.finished.emit()

    def log(self, msg):
        self.signals.log.emit(msg)

    def get_all_files_with_hashes(self, base_paths):
        d = {}
        total_file_count = 0
        extension_counts = {}
        
        scan_all = self.config.get('scan_all', False)
        extensions = self.config.get('extensions', [])
        skip_dirs = self.config.get('skip_dirs', [])

        for i, base_path in enumerate(base_paths, 1):
            if not self.is_running: break
            folder_file_count = 0
            self.log(f"[{i}/{len(base_paths)}] Scanning: {base_path}")
            
            for root, dirs, files in os.walk(base_path):
                dirs[:] = [d for d in dirs if d not in skip_dirs]
                for fn in files:
                    folder_file_count += 1
                    total_file_count += 1
                    
                    ext = os.path.splitext(fn)[1].lower()
                    if not ext: ext = "no_extension"
                    extension_counts[ext] = extension_counts.get(ext, 0) + 1
                    
                    if not scan_all and not fn.endswith(tuple(extensions)):
                        continue
                        
                    full = os.path.normpath(os.path.join(root, fn))
                    h = hash_file(full)
                    if h:
                        d.setdefault(h, []).append(full)
            
            self.log(f"[{i}/{len(base_paths)}] ✅ {os.path.basename(base_path)}: {folder_file_count} files")

        self.log("\n📊 File type summary:")
        sorted_extensions = sorted(extension_counts.items(), key=lambda x: x[1], reverse=True)
        for ext, count in sorted_extensions:
            label = "no_extension" if ext == "no_extension" else ext[1:]
            self.log(f"   {label} = {count}")
        self.log(f"\n📁 Total files scanned: {total_file_count}")
        return d

    def save_snapshot(self):
        self.log("Starting snapshot creation...")
        os.makedirs(os.path.dirname(SAVE_FILE), exist_ok=True)
        
        snap = self.get_all_files_with_hashes(self.folders)
        
        snapshot_data = {
            "folders_scanned": self.folders,
            "timestamp": datetime.now().isoformat(),
            "file_hashes": snap
        }
        
        with open(SAVE_FILE, 'w', encoding='utf-8') as f:
            json.dump(snapshot_data, f, indent=2)
            
        total = sum(len(v) for v in snap.values())
        self.log(f"✅ Snapshot saved: {total} files logged at {SAVE_FILE}")

    def load_snapshot(self):
        if not os.path.exists(SAVE_FILE):
            self.log("❌ No snapshot found. Please run scan first.")
            return None, []
        
        data = json.load(open(SAVE_FILE, 'r', encoding='utf-8'))
        if "file_hashes" in data:
            return data["file_hashes"], data.get("folders_scanned", [])
        return data, []

    def replace_in_file(self, path, old_p, new_p, log_entries):
        if is_binary_file(path): return

        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                txt = f.read()
        except:
            return

        orig = txt
        replacements = []
        variants = {
            old_p,
            old_p.replace("\\", "/"),
            old_p.replace("/", "\\"),
            old_p.replace("\\", "\\\\"),
        }

        for var in variants:
            if var in txt:
                if "\\\\" in var: rp = new_p.replace("\\", "\\\\")
                elif "/" in var: rp = new_p.replace("\\", "/")
                else: rp = new_p
                
                pat = re.escape(var)
                txt = re.sub(pat, lambda m, rp=rp: rp, txt)
                replacements.append(f"    {var} → {rp}")

        if replacements and txt != orig:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(txt)
            self.log(f"🔁 Updated: {path}")
            log_entries.append(path)
            log_entries.extend(replacements)

    def update_references(self):
        self.log("Loading old snapshot...")
        old_snap, old_folders = self.load_snapshot()
        if old_snap is None: return

        self.log("Creating new snapshot of current state...")
        new_snap = self.get_all_files_with_hashes(self.folders)

        mappings = []
        for h, old_list in old_snap.items():
            new_list = new_snap.get(h, [])
            removed = sorted(set(old_list) - set(new_list))
            added = sorted(set(new_list) - set(old_list))
            for old_path, new_path in zip(removed, added):
                mappings.append((old_path, new_path))

        if not mappings:
            self.log("📦 No renamed/moved files found.")
            return

        self.log(f"🔍 Detected {len(mappings)} renamed/moved files:")
        for old_path, new_path in mappings:
            self.log(f"    {old_path} → {new_path}")

        all_files = []
        skip_dirs = self.config.get('skip_dirs', [])
        extensions = self.config.get('extensions', [])
        scan_all = self.config.get('scan_all', False)

        for base_path in self.folders:
            for root, dirs, files in os.walk(base_path):
                dirs[:] = [d for d in dirs if d not in skip_dirs]
                for fn in files:
                    if scan_all or fn.endswith(tuple(extensions)):
                        all_files.append(os.path.normpath(os.path.join(root, fn)))

        text_files = [f for f in all_files if not is_binary_file(f)]
        skipped_count = len(all_files) - len(text_files)
        
        if skipped_count > 0:
            self.log(f"⚡ Skipping {skipped_count} binary files for performance")
        
        self.log(f"📝 Scanning {len(text_files)} text files for references...")
        
        log_entries = []
        for i, file_path in enumerate(text_files):
            if not self.is_running: break
            if i % 100 == 0:
                self.log(f"   Processing {i}/{len(text_files)}...")
            for old_p, new_p in mappings:
                self.replace_in_file(file_path, old_p, new_p, log_entries)

        if log_entries:
            with open(LOG_FILE_PATH, 'a', encoding='utf-8') as L:
                L.write(f"\n--- {datetime.now()} ---\n")
                L.write("\n".join(log_entries) + "\n")
            self.log(f"📝 Detailed log saved to: {LOG_FILE_PATH}")

        self.log("✅ Reference update completed!")

# ————— GUI —————

class PathTrackerGUI(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("PATH_TRACKER // CYBER_QT")
        self.resize(1000, 750)
        
        self.apply_theme()
        self.init_ui()
        
        # Load user defaults?
        # self.quick_folders is hardcoded nicely in original, we can keep it
        self.quick_folders = [
            "C:/Users/nahid/ms/ms1/", 
            "C:/@delta/db/", 
            "C:/@delta/msBackups/"
        ]
        self.quick_combo.addItems(self.quick_folders)
        
    def apply_theme(self):
        self.setStyleSheet(f"""
            QMainWindow {{ background-color: {CP_BG}; }}
            QWidget {{ color: {CP_TEXT}; font-family: 'Consolas'; font-size: 10pt; }}
            
            /* Input Fields */
            QLineEdit, QSpinBox, QComboBox, QPlainTextEdit, QTextEdit, QListWidget {{
                background-color: {CP_PANEL}; 
                color: {CP_CYAN}; 
                border: 1px solid {CP_DIM}; 
                padding: 4px;
                selection-background-color: {CP_CYAN};
                selection-color: #000000;
            }}
            QLineEdit:focus, QPlainTextEdit:focus, QListWidget:focus {{ 
                border: 1px solid {CP_CYAN}; 
            }}
            
            /* Buttons - Standard */
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
            QPushButton:pressed {{
                background-color: {CP_YELLOW};
                color: black;
            }}
            
            /* Group Box */
            QGroupBox {{
                border: 1px solid {CP_DIM}; 
                margin-top: 10px; 
                padding-top: 10px; 
                font-weight: bold; 
                color: {CP_YELLOW};
            }}
            QGroupBox::title {{ 
                subcontrol-origin: margin; 
                subcontrol-position: top left; 
                padding: 0 5px; 
            }}
            
            /* Checkbox */
            QCheckBox {{ spacing: 8px; color: {CP_TEXT}; }}
            QCheckBox::indicator {{
                width: 14px; height: 14px;
                border: 1px solid {CP_DIM}; background: {CP_PANEL};
            }}
            QCheckBox::indicator:checked {{
                background: {CP_YELLOW}; border-color: {CP_YELLOW};
            }}
            
            /* Scrollbar */
            QScrollBar:vertical {{
                border: none; background: {CP_BG}; width: 10px; margin: 0px 0px 0px 0px;
            }}
            QScrollBar::handle:vertical {{
                background: {CP_DIM}; min-height: 20px;
            }}
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
                height: 0px;
            }}
        """)
        
    def init_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout(central)
        layout.setSpacing(15)
        layout.setContentsMargins(20, 20, 20, 20)
        
        # TITLE
        title_lbl = QLabel("PATH_TRACKER // SYSTEM")
        title_lbl.setStyleSheet(f"font-size: 20pt; font-weight: bold; color: {CP_CYAN};")
        layout.addWidget(title_lbl)
        
        # TOP SECTION: TARGETS
        top_split = QHBoxLayout()
        
        # Left: Folder List
        grp_targets = QGroupBox("TARGET_FOLDERS")
        vbox_targets = QVBoxLayout()
        
        self.folder_list = QListWidget()
        self.folder_list.setSelectionMode(QListWidget.SelectionMode.ExtendedSelection)
        vbox_targets.addWidget(self.folder_list)
        
        # Target Buttons
        hbox_btns = QHBoxLayout()
        
        self.btn_add = QPushButton("ADD DIR")
        self.btn_add.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_add.clicked.connect(self.add_folder)
        
        self.btn_del = QPushButton("REMOVE")
        self.btn_del.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_del.clicked.connect(self.remove_folder)
        
        self.btn_clear = QPushButton("CLEAR ALL")
        self.btn_clear.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_clear.clicked.connect(self.clear_folders)
        
        hbox_btns.addWidget(self.btn_add)
        hbox_btns.addWidget(self.btn_del)
        hbox_btns.addWidget(self.btn_clear)
        vbox_targets.addLayout(hbox_btns)
        
        # Quick Select
        hbox_quick = QHBoxLayout()
        hbox_quick.addWidget(QLabel("QUICK_ADD:"))
        self.quick_combo = QComboBox()
        self.quick_combo.setPlaceholderText("Select preset...")
        self.quick_combo.currentTextChanged.connect(self.quick_add)
        hbox_quick.addWidget(self.quick_combo, 1)
        vbox_targets.addLayout(hbox_quick)
        
        grp_targets.setLayout(vbox_targets)
        top_split.addWidget(grp_targets, 2)
        
        # Right: Config
        grp_config = QGroupBox("SYSTEM_CONFIG")
        form_config = QFormLayout()
        
        self.chk_scan_all = QCheckBox("SCAN_ALL_FILES")
        self.chk_scan_all.setChecked(True) # Default from original
        form_config.addRow(self.chk_scan_all)
        
        self.input_ext = QLineEdit(DEFAULT_EXTENSIONS)
        form_config.addRow("EXTENSIONS:", self.input_ext)
        
        self.input_skip = QLineEdit(DEFAULT_SKIP)
        form_config.addRow("SKIP_DIRS:", self.input_skip)
        
        lbl_binary = QLabel("BINARY_SKIP: .exe, .dll, .png, .zip, .pdf... [AUTO]")
        lbl_binary.setStyleSheet(f"color: {CP_SUBTEXT}; font-size: 8pt;")
        form_config.addRow(lbl_binary)
        
        grp_config.setLayout(form_config)
        top_split.addWidget(grp_config, 1)
        
        layout.addLayout(top_split)
        
        # MIDDLE: ACTION BUTTONS
        hbox_actions = QHBoxLayout()
        
        self.btn_scan = QPushButton("[ SCAN_SEQUENCE ]")
        self.btn_scan.setMinimumHeight(45)
        self.btn_scan.setStyleSheet(f"""
            QPushButton {{ 
                background-color: {CP_PANEL}; 
                border: 1px solid {CP_GREEN}; 
                color: {CP_GREEN}; 
                font-size: 11pt;
            }}
            QPushButton:hover {{ 
                background-color: {CP_GREEN}; 
                color: {CP_BG}; 
            }}
        """)
        self.btn_scan.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_scan.clicked.connect(self.start_scan)
        
        self.btn_update = QPushButton("[ UPDATE_REFS ]")
        self.btn_update.setMinimumHeight(45)
        self.btn_update.setStyleSheet(f"""
            QPushButton {{ 
                background-color: {CP_PANEL}; 
                border: 1px solid {CP_ORANGE}; 
                color: {CP_ORANGE}; 
                font-size: 11pt;
            }}
            QPushButton:hover {{ 
                background-color: {CP_ORANGE}; 
                color: {CP_BG}; 
            }}
        """)
        self.btn_update.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_update.clicked.connect(self.start_update)
        
        hbox_actions.addWidget(self.btn_scan)
        hbox_actions.addWidget(self.btn_update)
        layout.addLayout(hbox_actions)
        
        # BOTTOM: LOGS
        grp_logs = QGroupBox("SYSTEM_OUTPUT")
        vbox_logs = QVBoxLayout()
        self.log_view = QTextEdit()
        self.log_view.setReadOnly(True)
        vbox_logs.addWidget(self.log_view)
        grp_logs.setLayout(vbox_logs)
        layout.addWidget(grp_logs, 2)
        
        # Status Bar
        self.status_bar = QLabel("SYSTEM_READY")
        self.status_bar.setStyleSheet(f"color: {CP_GREEN}; padding: 2px;")
        layout.addWidget(self.status_bar)
        
        # Worker container
        self.worker = None

    # — UI ACTIONS —
    
    def add_folder(self):
        d = QFileDialog.getExistingDirectory(self, "Select Directory to Track")
        if d:
            self.add_path_to_list(d)
            
    def quick_add(self, text):
        if text:
            self.add_path_to_list(text)
            
    def add_path_to_list(self, path):
        # Avoid duplicates
        items = [self.folder_list.item(i).text() for i in range(self.folder_list.count())]
        if path not in items:
            self.folder_list.addItem(path)
            self.log_message(f"📁 SELECTED: {path}", color=CP_CYAN)
            
    def remove_folder(self):
        for item in self.folder_list.selectedItems():
            self.folder_list.takeItem(self.folder_list.row(item))
            
    def clear_folders(self):
        self.folder_list.clear()
        self.log_message("🗑️ TARGETS CLEARED", color=CP_RED)

    def get_config(self):
        return {
            'scan_all': self.chk_scan_all.isChecked(),
            'extensions': [x.strip() for x in self.input_ext.text().split(',') if x.strip()],
            'skip_dirs': [x.strip() for x in self.input_skip.text().split(',') if x.strip()]
        }
    
    def get_folders(self):
        return [self.folder_list.item(i).text() for i in range(self.folder_list.count())]

    # — LOGIC TRIGGERS —

    def start_scan(self):
        folders = self.get_folders()
        if not folders:
            QMessageBox.warning(self, "NO TARGETS", "Please select at least one folder.")
            return
            
        self.toggle_ui(False)
        self.log_message(">> INITIALIZING SCAN SEQUENCE...", color=CP_GREEN)
        
        self.worker = LogicWorker('scan', self.get_config(), folders)
        self.worker.signals.log.connect(lambda msg: self.log_message(msg))
        self.worker.signals.finished.connect(self.on_worker_finished)
        self.worker.signals.error.connect(self.on_worker_error)
        self.worker.start()

    def start_update(self):
        folders = self.get_folders()
        if not folders:
            QMessageBox.warning(self, "NO TARGETS", "Please select at least one folder.")
            return

        self.toggle_ui(False)
        self.log_message(">> INITIALIZING UPDATE SEQUENCE...", color=CP_ORANGE)
        
        self.worker = LogicWorker('update', self.get_config(), folders)
        self.worker.signals.log.connect(lambda msg: self.log_message(msg))
        self.worker.signals.finished.connect(self.on_worker_finished)
        self.worker.signals.error.connect(self.on_worker_error)
        self.worker.start()

    def on_worker_finished(self):
        self.toggle_ui(True)
        self.log_message(">> SEQUENCE COMPLETE", color=CP_GREEN)
        self.status_bar.setText("SYSTEM_READY")

    def on_worker_error(self, err):
        self.toggle_ui(True)
        self.log_message(f"❌ ERROR: {err}", color=CP_RED)
        self.status_bar.setText("SYSTEM_ERROR")

    def toggle_ui(self, enabled):
        self.btn_scan.setEnabled(enabled)
        self.btn_update.setEnabled(enabled)
        self.btn_add.setEnabled(enabled)
        self.btn_del.setEnabled(enabled)
        self.btn_clear.setEnabled(enabled)

    def log_message(self, msg, color=None):
        timestamp = datetime.now().strftime("%H:%M:%S")
        
        # Simple auto-color logic if not specified
        if not color:
            if "✅" in msg: color = CP_GREEN
            elif "❌" in msg: color = CP_RED
            elif "📊" in msg: color = CP_YELLOW
            elif "🔁" in msg: color = CP_CYAN
            else: color = CP_TEXT
            
        html = f'<span style="color:{CP_SUBTEXT}">[{timestamp}]</span> <span style="color:{color}">{msg}</span>'
        self.log_view.append(html)
        
        # Update status bar with last message
        clean_msg = re.sub(r'<[^>]+>', '', msg) # Remove HTML tags for status bar
        self.status_bar.setText(f"BUSY >> {clean_msg}"[:100])

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = PathTrackerGUI()
    window.show()
    sys.exit(app.exec())