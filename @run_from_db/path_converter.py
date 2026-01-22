import sys
import os
import re
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QLabel, QLineEdit, QPushButton, 
                             QComboBox, QCheckBox, QFileDialog, QMessageBox, 
                             QFrame, QTextEdit, QGroupBox, QFormLayout, QRadioButton,
                             QButtonGroup, QListWidget, QSplitter,
                             QListWidgetItem)
from PyQt6.QtCore import Qt, pyqtSignal, QTimer
from PyQt6.QtGui import QFont, QClipboard

# CYBERPUNK THEME PALETTE
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

class PathConverter(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("PATH_CONVERTER // CYBER_QT")
        self.setGeometry(100, 100, 700, 400)
        # Don't set fixed size constraints initially - we'll handle this in adjust_window_width
        
        # Apply cyberpunk theme
        self.setStyleSheet(f"""
            QMainWindow {{ background-color: {CP_BG}; }}
            QWidget {{ 
                color: {CP_TEXT}; 
                font-family: 'Consolas'; 
                font-size: 10pt; 
                background-color: {CP_BG};
            }}
            
            QLineEdit, QTextEdit {{
                background-color: {CP_PANEL}; 
                color: {CP_CYAN}; 
                border: 1px solid {CP_DIM}; 
                padding: 6px;
                selection-background-color: {CP_CYAN}; 
                selection-color: {CP_BG};
            }}
            QLineEdit:focus, QTextEdit:focus {{ 
                border: 1px solid {CP_CYAN}; 
            }}
            
            QPushButton {{
                background-color: {CP_DIM}; 
                border: 1px solid {CP_DIM}; 
                color: white; 
                padding: 8px 16px; 
                font-weight: bold;
                min-width: 80px;
            }}
            QPushButton:hover {{
                background-color: #2a2a2a; 
                border: 1px solid {CP_YELLOW}; 
                color: {CP_YELLOW};
            }}
            QPushButton:pressed {{
                background-color: {CP_YELLOW};
                color: {CP_BG};
            }}
            
            QPushButton#AccentButton {{
                background-color: {CP_PANEL}; 
                border: 2px solid {CP_GREEN}; 
                color: {CP_GREEN}; 
                padding: 10px 20px; 
                font-size: 11pt;
                font-weight: bold;
            }}
            QPushButton#AccentButton:hover {{
                background-color: {CP_GREEN}; 
                color: {CP_BG};
            }}
            
            QPushButton#CopyButton {{
                background-color: {CP_PANEL}; 
                border: 1px solid {CP_ORANGE}; 
                color: {CP_ORANGE}; 
                padding: 6px 12px; 
                font-weight: bold;
            }}
            QPushButton#CopyButton:hover {{
                background-color: {CP_ORANGE}; 
                color: {CP_BG};
            }}
            
            QGroupBox {{
                border: 1px solid {CP_DIM}; 
                margin-top: 12px; 
                padding-top: 15px; 
                font-weight: bold; 
                color: {CP_YELLOW};
            }}
            QGroupBox::title {{ 
                subcontrol-origin: margin; 
                subcontrol-position: top left; 
                padding: 0 8px; 
            }}
            
            QRadioButton {{
                color: {CP_TEXT};
                spacing: 8px;
            }}
            QRadioButton::indicator {{
                width: 14px;
                height: 14px;
                border: 1px solid {CP_DIM};
                background: {CP_PANEL};
                border-radius: 7px;
            }}
            QRadioButton::indicator:checked {{
                background: {CP_CYAN};
                border-color: {CP_CYAN};
            }}
            
            QCheckBox {{
                color: {CP_TEXT};
                spacing: 8px;
            }}
            QCheckBox::indicator {{
                width: 14px;
                height: 14px;
                border: 1px solid {CP_DIM};
                background: {CP_PANEL};
            }}
            QCheckBox::indicator:checked {{
                background: {CP_YELLOW};
                border-color: {CP_YELLOW};
            }}
            
            QLabel#HeaderLabel {{
                color: {CP_GREEN};
                font-size: 18pt;
                font-weight: bold;
            }}
            QLabel#SectionLabel {{
                color: {CP_CYAN};
                font-weight: bold;
            }}
            QLabel#StatusLabel {{
                color: {CP_ORANGE};
                font-size: 9pt;
            }}
            
            QFrame#Separator {{
                background-color: {CP_DIM};
                max-height: 1px;
            }}
        """)
        
        self.setup_ui()
        
    def setup_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        main_layout = QVBoxLayout(central)
        main_layout.setContentsMargins(20, 20, 20, 20)
        main_layout.setSpacing(15)

        # Header
        header = QLabel("PATH_CONVERTER")
        header.setObjectName("HeaderLabel")
        header.setAlignment(Qt.AlignmentFlag.AlignCenter)
        main_layout.addWidget(header)
        
        # Format selector at top
        format_group = QGroupBox("OUTPUT_FORMAT")
        format_layout = QHBoxLayout(format_group)
        
        format_label = QLabel("SELECT_FORMAT:")
        format_label.setObjectName("SectionLabel")
        format_layout.addWidget(format_label)
        
        self.separator_combo = QComboBox()
        self.separator_combo.addItem("/ (Forward)", "forward")
        self.separator_combo.addItem("// (Double Forward)", "double_forward") 
        self.separator_combo.addItem("\\ (Backslash)", "backslash")
        self.separator_combo.addItem("\\\\ (Double Back)", "double_backslash")
        self.separator_combo.addItem("WSL", "wsl")
        self.separator_combo.addItem("Android", "android")
        self.separator_combo.addItem("Escaped", "escaped")
        self.separator_combo.addItem("Raw String", "raw")
        self.separator_combo.addItem("URI", "uri")
        self.separator_combo.currentTextChanged.connect(self.on_format_changed)
        format_layout.addWidget(self.separator_combo)
        format_layout.addStretch()
        
        main_layout.addWidget(format_group)
        
        # Conversion rows
        conversion_group = QGroupBox("PATH_CONVERSION")
        conversion_layout = QVBoxLayout(conversion_group)
        
        # Row 1: Input1 → Output1 → Copy1
        row1_layout = QHBoxLayout()
        
        self.input_field1 = QLineEdit()
        self.input_field1.setPlaceholderText("Paste path 1 here...")
        self.input_field1.textChanged.connect(self.on_input1_changed)
        row1_layout.addWidget(self.input_field1, 2)
        
        arrow1 = QLabel("→")
        arrow1.setObjectName("SectionLabel")
        arrow1.setAlignment(Qt.AlignmentFlag.AlignCenter)
        row1_layout.addWidget(arrow1)
        
        self.output_field1 = QLineEdit()
        self.output_field1.setReadOnly(True)
        self.output_field1.setPlaceholderText("Converted path 1...")
        self.output_field1.setStyleSheet(f"""
            QLineEdit {{
                background-color: {CP_PANEL}; 
                color: {CP_GREEN}; 
                border: 1px solid {CP_GREEN}; 
                padding: 6px;
                font-weight: bold;
            }}
        """)
        row1_layout.addWidget(self.output_field1, 2)
        
        self.copy_btn1 = QPushButton("COPY")
        self.copy_btn1.setObjectName("CopyButton")
        self.copy_btn1.clicked.connect(lambda: self.copy_output(1))
        row1_layout.addWidget(self.copy_btn1)
        
        conversion_layout.addLayout(row1_layout)
        
        # Row 2: Input2 → Output2 → Copy2
        row2_layout = QHBoxLayout()
        
        self.input_field2 = QLineEdit()
        self.input_field2.setPlaceholderText("Paste path 2 here...")
        self.input_field2.textChanged.connect(self.on_input2_changed)
        row2_layout.addWidget(self.input_field2, 2)
        
        arrow2 = QLabel("→")
        arrow2.setObjectName("SectionLabel")
        arrow2.setAlignment(Qt.AlignmentFlag.AlignCenter)
        row2_layout.addWidget(arrow2)
        
        self.output_field2 = QLineEdit()
        self.output_field2.setReadOnly(True)
        self.output_field2.setPlaceholderText("Converted path 2...")
        self.output_field2.setStyleSheet(f"""
            QLineEdit {{
                background-color: {CP_PANEL}; 
                color: {CP_GREEN}; 
                border: 1px solid {CP_GREEN}; 
                padding: 6px;
                font-weight: bold;
            }}
        """)
        row2_layout.addWidget(self.output_field2, 2)
        
        self.copy_btn2 = QPushButton("COPY")
        self.copy_btn2.setObjectName("CopyButton")
        self.copy_btn2.clicked.connect(lambda: self.copy_output(2))
        row2_layout.addWidget(self.copy_btn2)
        
        conversion_layout.addLayout(row2_layout)
        
        main_layout.addWidget(conversion_group)

        # Status
        self.status_label = QLabel("SYSTEM_READY >> Select format and paste paths")
        self.status_label.setObjectName("StatusLabel")
        main_layout.addWidget(self.status_label)
        
    def on_format_changed(self):
        """Convert paths when format selection changes"""
        self.convert_path(1)
        self.convert_path(2)
        
    def on_input1_changed(self):
        """Convert path 1 when input changes"""
        self.convert_path(1)
        self.adjust_window_width()
    
    def on_input2_changed(self):
        """Convert path 2 when input changes"""
        self.convert_path(2)
        self.adjust_window_width()
    
    def adjust_window_width(self):
        """Dynamically adjust window width based on input content"""
        # Get the longest text from both input fields
        text1 = self.input_field1.text()
        text2 = self.input_field2.text()
        
        # Find the longer text
        longest_text = text1 if len(text1) > len(text2) else text2
        
        print(f"DEBUG: Adjusting width for text: '{longest_text}' (length: {len(longest_text)})")
        
        if not longest_text:
            # If both fields are empty, use minimum width
            target_width = 700
        else:
            # Simple calculation: 10 pixels per character + base width
            char_width = 10
            base_width = 500  # Base width for UI elements
            target_width = base_width + (len(longest_text) * char_width)
            
            # Clamp between minimum and maximum
            target_width = max(700, min(1200, target_width))
        
        # Get current size
        current_width = self.width()
        print(f"DEBUG: Current width: {current_width}, Target width: {target_width}")
        
        # Force resize if different
        if current_width != target_width:
            print(f"DEBUG: Resizing from {current_width} to {target_width}")
            
            # Use QTimer to delay the resize slightly
            from PyQt6.QtCore import QTimer
            QTimer.singleShot(10, lambda: self.do_resize(target_width))
    
    def do_resize(self, target_width):
        """Actually perform the resize"""
        print(f"DEBUG: Actually resizing to {target_width}")
        self.resize(target_width, 400)
        
        # Center the window
        app = QApplication.instance()
        if app:
            screen = app.primaryScreen().geometry()
            x = (screen.width() - target_width) // 2
            y = (screen.height() - 400) // 2
            self.move(x, y)
            print(f"DEBUG: Moved window to ({x}, {y})")
    
    def copy_output(self, field_number):
        """Copy output from specified field to clipboard"""
        if field_number == 1:
            output_text = self.output_field1.text()
        else:
            output_text = self.output_field2.text()
            
        if output_text:
            clipboard = QApplication.clipboard()
            clipboard.setText(output_text)
            format_name = self.separator_combo.currentText().split(' ')[0]
            self.status_label.setText(f"COPIED >> Path {field_number} ({format_name}) copied to clipboard")
        else:
            self.status_label.setText(f"NO_OUTPUT >> Path {field_number} is empty")
    
    def convert_path(self, field_number):
        """Convert path for specified field"""
        if field_number == 1:
            input_path = self.input_field1.text().strip()
            output_field = self.output_field1
        else:
            input_path = self.input_field2.text().strip()
            output_field = self.output_field2
            
        if not input_path:
            output_field.clear()
            return
        
        try:
            # Get selected format
            format_key = self.separator_combo.currentData()
            
            # Normalize the input path
            normalized = self.normalize_path(input_path)
            
            # Convert to selected format
            if format_key == "forward":
                converted = self.to_forward_slash_format(normalized)
            elif format_key == "double_forward":
                converted = self.to_double_forward_format(normalized)
            elif format_key == "backslash":
                converted = self.to_backslash_format(normalized)
            elif format_key == "double_backslash":
                converted = self.to_double_backslash_format(normalized)
            elif format_key == "wsl":
                converted = self.to_wsl_format(normalized)
            elif format_key == "android":
                converted = self.to_android_format(normalized)
            elif format_key == "escaped":
                converted = self.to_escaped_format(normalized)
            elif format_key == "raw":
                converted = self.to_raw_string_format(normalized)
            elif format_key == "uri":
                converted = self.to_uri_format(normalized)
            else:
                converted = normalized
            
            output_field.setText(converted)
            
        except Exception as e:
            self.status_label.setText(f"CONVERSION_ERROR >> Path {field_number}: {str(e)}")
            output_field.clear()
    
    def normalize_path(self, path):
        """Normalize path separators and clean up the path"""
        # Remove quotes if present
        path = path.strip('\'"')
        
        # Handle raw strings
        if path.startswith(('r"', "r'")):
            path = path[2:-1]
        
        # Handle file URIs
        if path.startswith('file:///'):
            path = path[8:]  # Remove file:///
            if len(path) > 1 and path[1] == ':':  # Windows drive
                path = path.replace('/', '\\')
        elif path.startswith('file://'):
            path = path[7:]  # Remove file://
        
        # Normalize separators
        path = path.replace('\\\\', '\\').replace('//', '/')
        
        return path
    
    def to_forward_slash_format(self, path):
        """Convert to forward slash format (C:/path/to/file)"""
        forward_path = path.replace('\\', '/')
        
        # Handle WSL paths
        if forward_path.startswith('/mnt/'):
            parts = forward_path.split('/')
            if len(parts) >= 3:
                drive = parts[2].upper()
                remaining = '/'.join(parts[3:])
                forward_path = f"{drive}:/{remaining}"
        
        # Keep Windows drive letters but use forward slashes
        if len(forward_path) > 1 and forward_path[1] == ':':
            return forward_path
        
        # Handle Linux paths - assume they need a drive letter
        if forward_path.startswith('/') and not (len(forward_path) > 1 and forward_path[1] == ':'):
            forward_path = f"C:{forward_path}"
        
        return forward_path
    
    def to_double_forward_format(self, path):
        """Convert to double forward slash format (C://path//to//file)"""
        single_forward = self.to_forward_slash_format(path)
        return single_forward.replace('/', '//')
    
    def to_backslash_format(self, path):
        """Convert to backslash format (C:\\path\\to\\file)"""
        backslash_path = path.replace('/', '\\')
        
        # Handle WSL paths
        if backslash_path.startswith('\\mnt\\'):
            parts = backslash_path.split('\\')
            if len(parts) >= 3:
                drive = parts[2].upper()
                remaining = '\\'.join(parts[3:])
                backslash_path = f"{drive}:\\{remaining}"
        
        # Handle Linux/Android paths
        elif backslash_path.startswith('\\') and not (len(backslash_path) > 1 and backslash_path[1] == ':'):
            backslash_path = f"C:{backslash_path}"
        
        return backslash_path
    
    def to_double_backslash_format(self, path):
        """Convert to double backslash format (C:\\\\path\\\\to\\\\file)"""
        single_backslash = self.to_backslash_format(path)
        return single_backslash.replace('\\', '\\\\')
    
    def to_linux_format(self, path):
        """Convert to Linux format with forward slashes"""
        linux_path = path.replace('\\', '/')
        
        # Handle Windows drive letters
        if len(linux_path) > 1 and linux_path[1] == ':':
            # Convert C:/... to /c/...
            drive = linux_path[0].lower()
            remaining = linux_path[3:] if len(linux_path) > 3 else ""
            linux_path = f"/{drive}/{remaining}"
        
        # Ensure it starts with /
        if not linux_path.startswith('/'):
            linux_path = '/' + linux_path
        
        return linux_path
    
    def to_android_format(self, path):
        """Convert to Android format"""
        android_path = self.to_linux_format(path)
        
        # If it looks like an external storage path, use Android convention
        if not android_path.startswith('/storage/') and not android_path.startswith('/sdcard/'):
            # Remove drive letter paths and use Android external storage
            if android_path.startswith('/c/') or android_path.startswith('/d/'):
                remaining = '/'.join(android_path.split('/')[2:])
                android_path = f"/storage/emulated/0/{remaining}"
            elif not android_path.startswith('/'):
                android_path = f"/storage/emulated/0/{android_path}"
        
        return android_path
    
    def to_escaped_format(self, path):
        """Convert to escaped format for strings"""
        backslash_path = self.to_backslash_format(path)
        return backslash_path.replace('\\', '\\\\\\\\')  # Quadruple escape for string literals
    
    def to_raw_string_format(self, path):
        """Convert to Python raw string format"""
        backslash_path = self.to_backslash_format(path)
        return f"r'{backslash_path}'"
    
    def to_forward_slash_format(self, path):
        """Convert to forward slash format (Windows with forward slashes)"""
        forward_path = path.replace('\\', '/')
        
        # Keep Windows drive letters but use forward slashes
        if len(forward_path) > 1 and forward_path[1] == ':':
            return forward_path
        
        # Handle other formats
        return self.to_windows_format(path).replace('\\', '/')
    
    def to_wsl_format(self, path):
        """Convert to WSL format"""
        wsl_path = path.replace('\\', '/')
        
        # Handle Windows drive letters
        if len(wsl_path) > 1 and wsl_path[1] == ':':
            drive = wsl_path[0].lower()
            remaining = wsl_path[3:] if len(wsl_path) > 3 else ""
            wsl_path = f"/mnt/{drive}/{remaining}"
        
        # Ensure it starts with /
        if not wsl_path.startswith('/'):
            wsl_path = '/' + wsl_path
        
        return wsl_path
    
    def to_uri_format(self, path):
        """Convert to file URI format"""
        forward_path = self.to_forward_slash_format(path)
        
        # Ensure it starts with a drive letter for Windows
        if not (len(forward_path) > 1 and forward_path[1] == ':'):
            forward_path = f"C:/{forward_path.lstrip('/')}"
        
        return f"file:///{forward_path}"
    
    def copy_to_clipboard(self, format_key):
        if format_key in self.format_outputs:
            text = self.format_outputs[format_key].text()
            if text:
                clipboard = QApplication.clipboard()
                clipboard.setText(text)
                self.status_label.setText(f"COPIED >> {format_key.upper()} format copied to clipboard")
            else:
                self.status_label.setText("NO_OUTPUT >> Nothing to copy")

def main():
    app = QApplication(sys.argv)
    
    # Set application properties
    app.setApplicationName("Path Converter")
    app.setApplicationVersion("1.0")
    
    window = PathConverter()
    window.show()
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main()