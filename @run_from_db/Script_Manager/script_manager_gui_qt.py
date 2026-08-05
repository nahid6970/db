#!/usr/bin/env python3
import sys
import os
import json
import subprocess
import shutil
from functools import partial
import re
import urllib.request
import difflib
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QLabel, QPushButton, QScrollArea, 
                             QFrame, QMessageBox, QGridLayout, QSizePolicy,
                             QProgressBar, QDialog, QLineEdit, QComboBox, 
                             QCheckBox, QColorDialog, QMenu, QTextEdit, QFormLayout,
                             QGroupBox, QSpinBox, QFileDialog, QFontComboBox, QPlainTextEdit,
                             QRadioButton, QButtonGroup, QSplitter, QStyleOptionButton, QStyle,
                             QListWidget, QListWidgetItem)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal, QPoint, QMimeData, QByteArray, QSize, QRect
from PyQt6.QtGui import (QFont, QCursor, QColor, QDesktopServices, QAction, QIcon, QPainter, 
                         QBrush, QPixmap, QDrag, QTextDocument, QFontDatabase, QSyntaxHighlighter, QTextCharFormat, QFontMetrics, QTextOption)
from PyQt6.QtSvg import QSvgRenderer
from PyQt6.QtCore import QUrl
import ctypes

# -----------------------------------------------------------------------------
# CROSS-PLATFORM PATH NORMALIZATION HELPER
# -----------------------------------------------------------------------------
def normalize_path(path_str):
    if not isinstance(path_str, str) or not path_str:
        return path_str
    
    if os.name != 'nt':
        # Replace backslashes with forward slashes
        p = path_str.replace('\\', '/')
        
        # Translate Windows user directories (like C:/Users/nahid/...) to Linux home directory
        home = os.path.expanduser('~').replace('\\', '/')
        p_new = re.sub(r'^[a-zA-Z]:/[Uu]sers/[^/]+', home, p)
        if p_new == p:
            # Match C:/ or D:/ etc. at the start of the path and map to home
            p_new = re.sub(r'^[a-zA-Z]:/', home + '/', p)
        
        # Collapse multiple slashes
        p_new = re.sub(r'//+', '/', p_new)
        return p_new
    
    return path_str

# -----------------------------------------------------------------------------
# WINDOWS TASKBAR FIX: Register App ID early (before any UI creation)
# -----------------------------------------------------------------------------
if os.name == 'nt':
    try:
        myappid = 'cyberpunk.script.manager.v3'
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)
    except Exception:
        pass

# -----------------------------------------------------------------------------
# CYBERPUNK THEME PALETTE
# -----------------------------------------------------------------------------
CP_BG = "#050505"           # Main Background
CP_PANEL = "#111111"        # Panel Background
CP_YELLOW = "#FCEE0A"       # Cyber Yellow
CP_CYAN = "#00F0FF"         # Neon Cyan
CP_RED = "#FF003C"          # Neon Red
CP_DIM = "#3a3a3a"          # Dimmed/Inactive
CP_TEXT = "#E0E0E0"         # Main Text
CP_SUBTEXT = "#808080"      # Sub Text
CP_GREEN = "#00ff21"        # Success Green
CP_ORANGE = "#ff934b"       # Warning Orange

CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "script_launcher_config.json")

# Preset modules for Ctrl+Click actions (easy to expand in the future)
CTRL_COMMAND_MODULES = [
    {"name": "Explorer (Open Folder)", "cmd": 'explorer "{dir}"'},
]


# -----------------------------------------------------------------------------
# WIDGETS
# -----------------------------------------------------------------------------

class SvgInputDialog(QDialog):
    def __init__(self, current_svg="", hover_map=None, parent=None):
        super().__init__(parent)
        self.setWindowTitle("PASTE SVG CODE")
        self.resize(600, 580)
        self.svg_code = current_svg
        self.hover_map = hover_map or {}
        self.setStyleSheet(f"""
            QDialog {{ background-color: {CP_BG}; border: 2px solid {CP_CYAN}; }}
            QPlainTextEdit {{ background-color: {CP_PANEL}; color: {CP_TEXT}; font-family: 'Consolas'; border: 1px solid {CP_DIM}; }}
            QPushButton {{ background-color: {CP_DIM}; color: white; padding: 8px; border: 1px solid {CP_DIM}; }}
            QPushButton:hover {{ border: 1px solid {CP_CYAN}; }}
            QLabel {{ color: {CP_YELLOW}; font-family: 'Consolas'; font-weight: bold; font-size: 9pt; }}
            QScrollArea {{ border: 1px solid {CP_DIM}; background: {CP_PANEL}; }}
        """)
        
        layout = QVBoxLayout(self)
        
        layout.addWidget(QLabel("SVG CODE:"))
        self.txt_input = QPlainTextEdit()
        self.txt_input.setPlaceholderText("<svg>...</svg>")
        self.txt_input.setPlainText(self.svg_code)
        layout.addWidget(self.txt_input, stretch=2)
        
        layout.addWidget(QLabel("BASE COLORS (CLICK TO REPLACE IN CODE):"))
        self.color_scroll = QScrollArea()
        self.color_scroll.setWidgetResizable(True)
        self.color_scroll.setFixedHeight(60)
        self.color_widget = QWidget()
        self.color_layout = QHBoxLayout(self.color_widget)
        self.color_layout.setAlignment(Qt.AlignmentFlag.AlignLeft)
        self.color_layout.setContentsMargins(5, 5, 5, 5)
        self.color_scroll.setWidget(self.color_widget)
        layout.addWidget(self.color_scroll)

        layout.addWidget(QLabel("HOVER OVERRIDES (CLICK TO SET HOVER COLOR):"))
        self.hover_scroll = QScrollArea()
        self.hover_scroll.setWidgetResizable(True)
        self.hover_scroll.setFixedHeight(60)
        self.hover_widget = QWidget()
        self.hover_layout = QHBoxLayout(self.hover_widget)
        self.hover_layout.setAlignment(Qt.AlignmentFlag.AlignLeft)
        self.hover_layout.setContentsMargins(5, 5, 5, 5)
        self.hover_scroll.setWidget(self.hover_widget)
        layout.addWidget(self.hover_scroll)
        
        # Debounce timer for color extraction
        self.color_timer = QTimer()
        self.color_timer.setSingleShot(True)
        self.color_timer.timeout.connect(self.update_color_panel)
        self.txt_input.textChanged.connect(lambda: self.color_timer.start(500))
        
        btn_box = QHBoxLayout()
        btn_save = QPushButton("SAVE SVG")
        btn_save.setStyleSheet(f"background-color: {CP_GREEN}; color: black; font-weight: bold;")
        btn_save.clicked.connect(self.save_and_close)
        
        btn_clear = QPushButton("CLEAR")
        btn_clear.clicked.connect(self.clear_svg)
        
        btn_cancel = QPushButton("CANCEL")
        btn_cancel.clicked.connect(self.reject)
        
        btn_box.addWidget(btn_save)
        btn_box.addWidget(btn_clear)
        btn_box.addWidget(btn_cancel)
        layout.addLayout(btn_box)
        
        # Initial extraction
        self.update_color_panel()
        
    def update_color_panel(self):
        # Clear existing buttons
        for lay in [self.color_layout, self.hover_layout]:
            while lay.count():
                item = lay.takeAt(0)
                if item.widget():
                    item.widget().deleteLater()
        
        svg = self.txt_input.toPlainText()
        colors = sorted(list(set(re.findall(r'#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}', svg))), key=len, reverse=True)
        
        if not colors:
            for lay in [self.color_layout, self.hover_layout]:
                lbl = QLabel("None")
                lbl.setStyleSheet(f"color: {CP_DIM}; font-style: italic;")
                lay.addWidget(lbl)
        else:
            for c in colors:
                # Normal Row
                btn = QPushButton()
                btn.setFixedSize(30, 30)
                btn.setToolTip(f"Replace {c} in SVG")
                btn.setStyleSheet(f"background-color: {c}; border: 1px solid {CP_DIM}; border-radius: 4px;")
                btn.clicked.connect(partial(self.pick_replacement_color, c))
                self.color_layout.addWidget(btn)

                # Hover Row
                h_btn = QPushButton()
                h_btn.setFixedSize(30, 30)
                hover_c = self.hover_map.get(c, c)
                h_btn.setToolTip(f"Set hover color for {c} (Current: {hover_c})")
                h_btn.setStyleSheet(f"background-color: {hover_c}; border: 2px solid {CP_YELLOW if c in self.hover_map else CP_DIM}; border-radius: 4px;")
                h_btn.clicked.connect(partial(self.pick_hover_color, c))
                self.hover_layout.addWidget(h_btn)
        
        self.color_layout.addStretch()
        self.hover_layout.addStretch()

    def pick_hover_color(self, base_color):
        curr = self.hover_map.get(base_color, base_color)
        c = QColorDialog.getColor(QColor(curr), self, f"Select Hover Color for {base_color}")
        if c.isValid():
            self.hover_map[base_color] = c.name().upper()
            self.update_color_panel()
            
    def pick_replacement_color(self, old_color):
        c = QColorDialog.getColor(QColor(old_color), self, "Select New Color")
        if c.isValid():
            new_color = c.name().upper()
            
            # Update map if color is renamed
            if old_color in self.hover_map:
                self.hover_map[new_color] = self.hover_map.pop(old_color)
                
            svg = self.txt_input.toPlainText()
            pattern = re.compile(re.escape(old_color), re.IGNORECASE)
            new_svg = pattern.sub(new_color, svg)
            self.txt_input.setPlainText(new_svg)
            self.update_color_panel()

    def save_and_close(self):
        self.svg_code = self.txt_input.toPlainText()
        self.accept()
        
    def clear_svg(self):
        self.txt_input.clear()

class PasswordDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("SECURED ACCESS")
        self.setFixedSize(300, 160)
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.Dialog)
        self.setStyleSheet(f"""
            QDialog {{ background-color: {CP_BG}; border: 2px solid {CP_RED}; }}
            QLabel {{ color: {CP_YELLOW}; font-family: 'Consolas'; font-size: 10pt; font-weight: bold; }}
            QLineEdit {{ 
                background-color: {CP_PANEL}; color: {CP_CYAN}; border: 1px solid {CP_DIM}; 
                padding: 10px; font-family: 'Consolas'; font-size: 14pt;
            }}
            QPushButton {{ 
                background-color: {CP_DIM}; color: white; border: 1px solid {CP_DIM}; 
                padding: 10px; font-family: 'Consolas'; font-weight: bold;
            }}
            QPushButton:hover {{ border: 1px solid {CP_CYAN}; background-color: #222222; }}
        """)
        
        layout = QVBoxLayout(self)
        title_lbl = QLabel("CRITICAL ACCESS // ENTER CODE")
        title_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title_lbl)
        
        self.inp = QLineEdit()
        self.inp.setEchoMode(QLineEdit.EchoMode.Password)
        self.inp.setPlaceholderText("****")
        self.inp.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(self.inp)
        
        btns = QHBoxLayout()
        self.btn_ok = QPushButton("AUTHORIZE")
        self.btn_ok.clicked.connect(self.verify)
        self.inp.returnPressed.connect(self.verify)
        
        self.btn_cancel = QPushButton("CANCEL")
        self.btn_cancel.clicked.connect(self.reject)
        
        btns.addWidget(self.btn_ok)
        btns.addWidget(self.btn_cancel)
        layout.addLayout(btns)
        self.inp.setFocus()

    def verify(self):
        if self.inp.text() == "1823":
            self.accept()
        else:
            self.inp.setStyleSheet(f"background-color: {CP_PANEL}; color: {CP_RED}; border: 1px solid {CP_RED}; padding: 10px; font-family: 'Consolas'; font-size: 14pt;")
            QTimer.singleShot(500, lambda: self.inp.setStyleSheet(""))
            self.inp.clear()

class CyberButton(QPushButton):
    def __init__(self, text, parent=None, script_data=None, config=None):
        self.raw_text = text or ""
        # Convert <br> variants for base height calc
        clean_text = self.raw_text.replace("<br>", "\n").replace("<br/>", "\n").replace("<BR>", "\n")
        super().__init__(clean_text, parent)
        self.script = script_data or {}
        self.config = config or {}
        self.is_folder = (self.script.get("type") == "folder")
        
        # Style storage
        self.fg_normal = "#FFFFFF"
        self.fg_hover = "#FFFFFF"
        
        # Cursor
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        
        # Dimensions
        w = self.script.get("width", 0)
        h = self.script.get("height", 0)
        if w > 0: self.setFixedWidth(w)
        if h > 0: self.setFixedHeight(h)
        else: self.setMinimumHeight(45)


        # Enable Right Click
        self.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        
        # Enable Hover Events
        self.setAttribute(Qt.WidgetAttribute.WA_Hover)
        
        self.update_style()
        self.drag_start_pos = QPoint()
        self.suppress_context_menu = False  # Flag to suppress context menu on Ctrl+Right

    def mousePressEvent(self, event):
        # Check for Ctrl+Click shortcuts
        modifiers = QApplication.keyboardModifiers()
        
        if modifiers == Qt.KeyboardModifier.ControlModifier:
            if event.button() == Qt.MouseButton.LeftButton:
                cmd = self.script.get("ctrl_left_cmd", "").strip()
                if not cmd:
                    # Default: open folder directory of the script path!
                    script_path = normalize_path(self.script.get("path", ""))
                    if script_path:
                        expanded_path = os.path.expandvars(script_path)
                        clean_path = expanded_path.strip('"').strip("'")
                        try:
                            abs_path = os.path.abspath(clean_path)
                            if os.path.exists(abs_path):
                                if os.path.isdir(abs_path):
                                    cmd = f'explorer "{abs_path}"'
                                else:
                                    cmd = f'explorer "{os.path.dirname(abs_path)}"'
                            else:
                                # Try splitting to isolate base file/path if args exist
                                parts = clean_path.split(" ")
                                resolved = False
                                for i in range(len(parts), 0, -1):
                                    candidate = " ".join(parts[:i])
                                    if os.path.exists(candidate):
                                        abs_candidate = os.path.abspath(candidate)
                                        if os.path.isdir(abs_candidate):
                                            cmd = f'explorer "{abs_candidate}"'
                                        else:
                                            cmd = f'explorer "{os.path.dirname(abs_candidate)}"'
                                        resolved = True
                                        break
                                if not resolved:
                                    cmd = f'explorer "{os.path.dirname(os.path.abspath(__file__))}"'
                        except Exception:
                            cmd = f'explorer "{os.path.dirname(os.path.abspath(__file__))}"'
                    else:
                        cmd = f'explorer "{os.path.dirname(os.path.abspath(__file__))}"'
                
                if cmd:
                    if self.script.get("require_password"):
                        if PasswordDialog(self).exec() != QDialog.DialogCode.Accepted:
                            event.accept()
                            return
                    self.execute_ctrl_command(cmd)
                    event.accept()
                    return
            elif event.button() == Qt.MouseButton.RightButton:
                cmd = self.script.get("ctrl_right_cmd", "").strip()
                if cmd:
                    if self.script.get("require_password"):
                        if PasswordDialog(self).exec() != QDialog.DialogCode.Accepted:
                            self.suppress_context_menu = True # Still suppress menu even if cancelled
                            event.accept()
                            return
                    self.suppress_context_menu = True  # Suppress context menu
                    self.execute_ctrl_command(cmd)
                    event.accept()
                    return
                else:
                    # No command set, allow context menu
                    self.suppress_context_menu = False
        else:
            # Normal right-click without Ctrl, allow context menu
            self.suppress_context_menu = False
        
        # Normal behavior
        if event.button() == Qt.MouseButton.LeftButton:
            self.drag_start_pos = event.pos()
        super().mousePressEvent(event)

    def execute_ctrl_command(self, cmd):
        """Execute a Ctrl+Click command"""
        try:
            # Expand environment variables
            cmd = os.path.expandvars(cmd)
            
            # Resolve dynamic templates
            script_path = normalize_path(self.script.get("path", ""))
            script_dir = ""
            if script_path:
                expanded_path = os.path.expandvars(script_path)
                abs_path = os.path.abspath(expanded_path.strip('"').strip("'"))
                script_dir = os.path.dirname(abs_path)
                cmd = cmd.replace("{path}", abs_path).replace("{dir}", script_dir)
            else:
                cmd = cmd.replace("{path}", "").replace("{dir}", os.path.dirname(os.path.abspath(__file__)))
            
            # Parse command to detect special cases
            cmd_lower = cmd.lower().strip()
            
            # Handle 'explorer' commands specially
            if cmd_lower.startswith("explorer ") or cmd_lower == "explorer":
                path = cmd[9:].strip() if cmd_lower.startswith("explorer ") else ""
                
                # Clean enclosing quotes if any
                path_clean = path.strip('"').strip("'")
                path_clean = normalize_path(path_clean)
                if not path_clean:
                    path_clean = script_dir or os.path.dirname(os.path.abspath(__file__))
                
                if os.name == 'nt':
                    # If it's a file, use /select to highlight it in folder
                    if os.path.isfile(path_clean):
                        subprocess.Popen(f'explorer /select,"{path_clean}"')
                    # If it's a directory, open it normally
                    elif os.path.isdir(path_clean):
                        subprocess.Popen(f'explorer "{path_clean}"')
                    else:
                        subprocess.Popen(f'explorer "{path_clean}"' if " " in path_clean else f'explorer {path_clean}')
                else:
                    # Linux / Cross-platform alternative
                    if hasattr(os, 'startfile'):
                        try:
                            os.startfile(path_clean)
                        except Exception:
                            dir_to_open = os.path.dirname(path_clean) if os.path.isfile(path_clean) else path_clean
                            QDesktopServices.openUrl(QUrl.fromLocalFile(dir_to_open))
                    else:
                        dir_to_open = os.path.dirname(path_clean) if os.path.isfile(path_clean) else path_clean
                        if os.path.exists(dir_to_open):
                            QDesktopServices.openUrl(QUrl.fromLocalFile(dir_to_open))
                        else:
                            subprocess.Popen(["xdg-open", dir_to_open])
                return
            
            # Handle URLs (http, https, mailto, etc.)
            if any(cmd_lower.startswith(proto) for proto in ["http://", "https://", "mailto:", "ftp://"]):
                QDesktopServices.openUrl(QUrl(cmd))
                return
            
            # For other commands, use cmd.exe
            if os.name == 'nt':
                import ctypes
                # SW_SHOWNORMAL = 1
                res = ctypes.windll.shell32.ShellExecuteW(None, None, "cmd.exe", f'/c {cmd}', None, 1)
            else:
                subprocess.Popen(["/bin/bash", "-c", cmd])
            if res <= 32:
                QMessageBox.warning(self, "Command Error", f"Failed to execute command (Code {res}):\n{cmd}")
        except Exception as e:
            QMessageBox.critical(self, "Execution Error", f"Error executing command:\n{cmd}\n\nError: {str(e)}")

    def mouseMoveEvent(self, event):
        super().mouseMoveEvent(event) # Allow standard behavior
        if not (event.buttons() & Qt.MouseButton.LeftButton): return
        if (event.pos() - self.drag_start_pos).manhattanLength() < QApplication.startDragDistance(): return
        
        drag = QDrag(self)
        mime = QMimeData()
        mime.setText(self.script.get("name", ""))
        # We store the object pointer for internal transfer
        mime.setData("application/x-script-item", b"")
        drag.setMimeData(mime)
        
        # Pixmap for drag feedback
        pix = self.grab()
        drag.setPixmap(pix)
        drag.setHotSpot(event.pos())
        drag.exec(Qt.DropAction.MoveAction)

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        
        # Standard button background/border
        opt = QStyleOptionButton()
        self.initStyleOption(opt)
        is_hovered = bool(opt.state & QStyle.StateFlag.State_MouseOver)
        
        opt.text = "" # Don't draw standard text
        self.style().drawControl(QStyle.ControlElement.CE_PushButton, opt, painter, self)
        
        # Check for icon
        icon_path = self.script.get("icon_path", "")
        nf_char = self.script.get("nf_char", "")
        svg_content = self.script.get("svg_content", "")
        
        icon_pixmap = None
        icon_w = 0
        icon_h = 0
        
        try:
            # Priority 1: Image Path
            icon_path_norm = normalize_path(icon_path)
            if icon_path_norm and os.path.exists(icon_path_norm):
                icon_pixmap = QPixmap(icon_path_norm)
            
            # Priority 2: Raw SVG Content
            elif svg_content and svg_content.strip():
                # Determine size
                gen_w = self.script.get("icon_width", 0)
                gen_h = self.script.get("icon_height", 0)
                if gen_w <= 0: gen_w = 64
                if gen_h <= 0: gen_h = 64
                
                icon_pixmap = QPixmap(gen_w, gen_h)
                icon_pixmap.fill(Qt.GlobalColor.transparent)
                
                actual_svg = svg_content
                if is_hovered:
                    hmap = self.script.get("svg_hover_map", {})
                    for base_c, hover_c in hmap.items():
                        # Case insensitive replace for hex codes
                        pattern = re.compile(re.escape(base_c), re.IGNORECASE)
                        actual_svg = pattern.sub(hover_c, actual_svg)

                painter_svg = QPainter(icon_pixmap)
                renderer = QSvgRenderer(QByteArray(actual_svg.encode('utf-8')))
                renderer.render(painter_svg)
                painter_svg.end()
                
            # Priority 3: Nerd Font Character
            elif nf_char:
                display_char = nf_char
                # Robust parsing for hex codes
                try:
                    clean_hex = None
                    if nf_char.startswith("\\u"):
                        clean_hex = nf_char[2:]
                    elif nf_char.lower().startswith("u+"):
                        clean_hex = nf_char[2:]
                    elif nf_char.lower().startswith("0x"):
                        clean_hex = nf_char[2:]
                    
                    # If we have a potential hex string, try to convert
                    if clean_hex:
                        display_char = chr(int(clean_hex, 16))
                except:
                    # If parsing fails, use the raw string (e.g. user pasted the actual char)
                    pass

                # Determine size for the generated icon
                gen_w = self.script.get("_runtime_icon_w", self.script.get("icon_width", 0))
                gen_h = self.script.get("_runtime_icon_h", self.script.get("icon_height", 0))
                if gen_w <= 0: gen_w = 64
                if gen_h <= 0: gen_h = 64
                
                # Draw the character onto a transparent pixmap
                icon_pixmap = QPixmap(gen_w, gen_h)
                icon_pixmap.fill(Qt.GlobalColor.transparent)
                
                p = QPainter(icon_pixmap)
                p.setRenderHint(QPainter.RenderHint.Antialiasing)
                p.setRenderHint(QPainter.RenderHint.TextAntialiasing)
                
                # Simplified Font Selection - rely on Qt's fallback or specific priority
                # We try a few common Nerd Font family names. 
                # Note: iterating QFontDatabase in paintEvent is too heavy/crash-prone.
                font_fam = "JetBrainsMono NFP" # Default preference
                
            # Set font and calculate size
                f = QFont(font_fam)
                f.setStyleHint(QFont.StyleHint.Monospace)
                
                # Try to find a good pixel size
                font_size = int(min(gen_w, gen_h) * 0.85)
                f.setPixelSize(font_size)
                p.setFont(f)
                
                # Use metrics for precise centering
                metrics = p.fontMetrics()
                rect = metrics.tightBoundingRect(display_char)
                
                # Safe Color - Use dynamic color based on hover state
                current_color = self.fg_hover if is_hovered else self.fg_normal
                
                c_str = current_color
                if not isinstance(c_str, str) or not c_str.startswith("#"):
                    c_str = "#FFFFFF"
                p.setPen(QColor(c_str))
                
                # Calculate offsets to truly center the glyph
                x_off = (gen_w - rect.width()) / 2 - rect.x()
                y_off = (gen_h - rect.height()) / 2 - rect.y()
                
                p.drawText(int(x_off), int(y_off), display_char)
                p.end()

            # Final processing of the pixmap (scaling if needed)
            if icon_pixmap and not icon_pixmap.isNull():
                # Get custom size or use auto
                custom_w = self.script.get("_runtime_icon_w", self.script.get("icon_width", 0))
                custom_h = self.script.get("_runtime_icon_h", self.script.get("icon_height", 0))
                
                if custom_w > 0 and custom_h > 0:
                    icon_pixmap = icon_pixmap.scaled(custom_w, custom_h, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation)
                elif custom_w > 0:
                    icon_pixmap = icon_pixmap.scaledToWidth(custom_w, Qt.TransformationMode.SmoothTransformation)
                elif custom_h > 0:
                    icon_pixmap = icon_pixmap.scaledToHeight(custom_h, Qt.TransformationMode.SmoothTransformation)
                else:
                    # Auto: max 32px height, or half of button height
                    btn_h = self.height()
                    if btn_h > 0:
                        max_icon_h = min(32, btn_h // 2)
                        # Ensure Nerd Font icons feel similar in scale to images
                        if nf_char: max_icon_h = min(40, btn_h // 2)
                        
                        if max_icon_h > 0:
                             icon_pixmap = icon_pixmap.scaledToHeight(max_icon_h, Qt.TransformationMode.SmoothTransformation)
                
                if not icon_pixmap.isNull():
                    icon_w = icon_pixmap.width()
                    icon_h = icon_pixmap.height()
                    
        except Exception as e:
            icon_pixmap = None
            icon_w = 0
            icon_h = 0
        
        # Get icon position and text alignment
        icon_position = self.script.get("icon_position", "top")
        text_align = self.script.get("_runtime_text_align", self.script.get("text_align", "center"))
        
        # Prepare content
        color = self.fg_hover if is_hovered else self.fg_normal
        
        # Process tags
        html = self.raw_text
        html = html.replace("<br>", "{{BR}}").replace("<br/>", "{{BR}}").replace("<BR>", "{{BR}}")
        html = re.sub(r"<fs:(\d+)>", r"{{FS:\1}}", html)
        html = html.replace("</fs>", "{{/FS}}")
        html = html.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        html = html.replace("{{BR}}", "<br/>")
        html = re.sub(r"\{\{FS:(\d+)\}\}", r'<span style="font-size:\1pt">', html)
        html = html.replace("{{/FS}}", "</span>")
        
        # Account for button padding (10px in QSS) and spacing
        padding = 10
        spacing = self.script.get("icon_gap", 2) if icon_pixmap else 0

        # Calculate available width based on icon position
        if icon_position in ["top", "bottom", "center"]:
            available_w = self.width() - (padding * 2)
        else:
            available_w = self.width() - (padding * 2) - icon_w - spacing
        available_w = max(10, available_w)

        is_single_line = "<br/>" not in html

        # Measure width using a temporary QTextDocument
        temp_doc = QTextDocument()
        temp_doc.setDefaultFont(self.font())
        if is_single_line:
            opt = temp_doc.defaultTextOption()
            opt.setWrapMode(QTextOption.WrapMode.NoWrap)
            temp_doc.setDefaultTextOption(opt)
        temp_doc.setHtml(f"<div style='font-family: {self.font().family()};'>{html}</div>")

        # Elide text if single-line and too long
        if is_single_line and temp_doc.idealWidth() > available_w:
            plain_text = temp_doc.toPlainText()
            
            # Reconstruct the exact font to get accurate metrics
            font_fam = self.script.get("font_family", self.config.get("default_font_family", "Consolas"))
            fs_val = self.script.get("font_size", self.config.get("default_font_size", 10))
            is_bold = self.script.get("is_bold", self.config.get("default_is_bold", True))
            
            test_font = QFont(font_fam, fs_val)
            test_font.setBold(is_bold)
            fm = QFontMetrics(test_font)
            
            # Elide text
            elided = fm.elidedText(plain_text, Qt.TextElideMode.ElideRight, available_w)
            
            # Keep custom font-size if matched
            fs_match = re.search(r'font-size:\s*(\d+pt)', html)
            font_size_style = f"font-size:{fs_match.group(1)};" if fs_match else ""
            
            html = f"<span style='color: {color}; font-family: {self.font().family()}; {font_size_style}'>{elided}</span>"

        doc = QTextDocument()
        doc.setDefaultFont(self.font())
        if is_single_line:
            opt = doc.defaultTextOption()
            opt.setWrapMode(QTextOption.WrapMode.NoWrap)
            doc.setDefaultTextOption(opt)
        
        if icon_position == "center":
            if icon_pixmap:
                icon_x = (self.width() - icon_w) / 2
                icon_y = (self.height() - icon_h) / 2
                painter.drawPixmap(int(icon_x), int(icon_y), icon_pixmap)
        elif icon_position in ["top", "bottom"]:
            # Vertical layout: Text uses full width and is aligned by HTML
            doc.setHtml(f"<div style='color: {color}; text-align: {text_align}; font-family: {self.font().family()};'>{html}</div>")
            doc.setTextWidth(self.width() - (padding * 2))
            text_h = doc.size().height()
            total_h = icon_h + spacing + text_h
            y_start = (self.height() - total_h) / 2
            
            if icon_position == "top":
                if icon_pixmap:
                    icon_x = (self.width() - icon_w) / 2
                    painter.drawPixmap(int(icon_x), int(y_start), icon_pixmap)
                    y_start += icon_h + spacing
                painter.translate(padding, y_start)
                doc.drawContents(painter)
            else:
                painter.translate(padding, y_start)
                doc.drawContents(painter)
                if icon_pixmap:
                    painter.resetTransform()
                    icon_x = (self.width() - icon_w) / 2
                    icon_y = y_start + text_h + spacing
                    painter.drawPixmap(int(icon_x), int(icon_y), icon_pixmap)
        else:
            # Horizontal layout: We calculate alignment of the icon + text block
            doc.setHtml(f"<div style='color: {color}; text-align: {text_align}; font-family: {self.font().family()};'>{html}</div>")
            available_w = self.width() - (padding * 2) - icon_w - spacing
            doc.setTextWidth(available_w)
            text_w = doc.idealWidth()
            text_h = doc.size().height()
            
            total_w = icon_w + spacing + text_w
            
            if text_align == "left":
                x_start = padding
            elif text_align == "right":
                x_start = self.width() - padding - total_w
            else:
                x_start = (self.width() - total_w) / 2
            
            if icon_position == "left":
                if icon_pixmap:
                    icon_y = (self.height() - icon_h) / 2
                    painter.drawPixmap(int(x_start), int(icon_y), icon_pixmap)
                text_x = x_start + icon_w + spacing
                text_y = (self.height() - text_h) / 2
                painter.translate(text_x, text_y)
                doc.drawContents(painter)
            else:
                # Icon on right
                text_y = (self.height() - text_h) / 2
                painter.translate(x_start, text_y)
                doc.drawContents(painter)
                if icon_pixmap:
                    painter.resetTransform()
                    icon_x = x_start + text_w + spacing
                    icon_y = (self.height() - icon_h) / 2
                    painter.drawPixmap(int(icon_x), int(icon_y), icon_pixmap)

    def update_style(self):
        # Defaults
        # Folders -> Yellow (Explorer-like)
        # Scripts -> White
        
        # Use config defaults
        def_sbg = self.config.get("def_script_bg", "#FFFFFF")
        def_sfg = self.config.get("def_script_fg", "#000000")
        def_shbg = self.config.get("def_script_hbg", CP_BG)
        def_shfg = self.config.get("def_script_hfg", def_sbg)

        def_fbg = self.config.get("def_folder_bg", CP_YELLOW)
        def_ffg = self.config.get("def_folder_fg", "#000000")
        def_fhbg = self.config.get("def_folder_hbg", CP_BG)
        def_fhfg = self.config.get("def_folder_hfg", def_fbg)

        if self.is_folder:
            default_color = def_fbg
            default_text_color = def_ffg
            default_hover_bg = def_fhbg
            default_hover_fg = def_fhfg
        else:
            default_color = def_sbg
            default_text_color = def_sfg
            default_hover_bg = def_shbg
            default_hover_fg = def_shfg
        
        # Extract properties
        color = self.script.get("color", default_color)
        text_color = self.script.get("text_color", default_text_color)
        hover_bg = self.script.get("hover_color", default_hover_bg)
        hover_fg = self.script.get("hover_text_color", default_hover_fg)
        
        # Store for paintEvent
        self.fg_normal = text_color
        self.fg_hover = hover_fg
        
        border_width = self.script.get("border_width", 1 if self.is_folder else 0)
        border_color = self.script.get("border_color", color)
        
        # Robust CSS border logic (helps background-color apply on Windows)
        border_css = f"{border_width}px solid {border_color}" if border_width > 0 else f"1px solid transparent"
        radius = self.script.get("corner_radius", 0)
        
        # Font
        font_family = self.script.get("font_family", "Consolas")
        font_size = self.script.get("font_size", 10)
        is_bold = self.script.get("is_bold", True)
        is_italic = self.script.get("is_italic", False)
        
        f = QFont(font_family, font_size)
        f.setBold(is_bold)
        f.setItalic(is_italic)
        self.setFont(f)

        # Base Style
        bg_normal = "transparent" if self.script.get("transparent_bg") else color
        fg_normal = text_color
            
        # Hover Style defaults
        bg_hover = "transparent" if self.script.get("hover_transparent_bg") else hover_bg
        fg_hover = hover_fg

        self.setStyleSheet(f"""
            QPushButton {{
                background: {bg_normal};
                color: {fg_normal};
                border: {border_css};
                padding: 10px;
                border-radius: {radius}px;
            }}
            QPushButton:hover {{
                background: {bg_hover};
                color: {fg_hover};
                border: {border_css};
            }}
        """)



# -----------------------------------------------------------------------------
# SELECTION DIALOG
# -----------------------------------------------------------------------------
# -----------------------------------------------------------------------------
# CODE HIGHLIGHTER FOR INLINE SCRIPTS
# -----------------------------------------------------------------------------
class CodeHighlighter(QSyntaxHighlighter):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.language = "bat"
        self._format_map = {}
        self._pygments_available = False
        self.setup_rules()

    def set_language(self, lang):
        if lang.lower() == "cmd": lang = "bat"
        elif lang.lower() == "pwsh": lang = "powershell"
        self.language = lang.lower()
        self.setup_rules()
        self.rehighlight()

    def setup_rules(self):
        try:
            import pygments
            from pygments.styles import get_style_by_name
            self._pygments_available = True
            
            # Use 'monokai' as it looks great on dark backgrounds
            style = get_style_by_name('monokai')
            
            self._format_map = {}
            for token, style_def in style:
                fmt = QTextCharFormat()
                if style_def['color']:
                    fmt.setForeground(QColor(f"#{style_def['color']}"))
                if style_def['bgcolor']:
                    fmt.setBackground(QColor(f"#{style_def['bgcolor']}"))
                if style_def['bold']:
                    fmt.setFontWeight(QFont.Weight.Bold)
                if style_def['italic']:
                    fmt.setFontItalic(True)
                self._format_map[token] = fmt
        except ImportError:
            self._pygments_available = False
            
        # Optional: Add fallback regex rules here if pygments is not installed
        # But we'll rely on pygments per user's request.

    def highlightBlock(self, text):
        if not self._pygments_available:
            return
            
        try:
            from pygments import lex
            from pygments.lexers import get_lexer_by_name
            # Pygments usually adds a newline to the text, so we strip it if present.
            # highlightBlock gives us the exact text of the block without newline.
            lexer = get_lexer_by_name(self.language, stripall=True)
            
            pos = 0
            for token, val in lex(text, lexer):
                fmt = None
                t = token
                while t is not None:
                    if t in self._format_map:
                        fmt = self._format_map[t]
                        break
                    t = t.parent
                
                if fmt is not None:
                    # lex() may return chunks that span multiple lines, but QSyntaxHighlighter
                    # feeds line by line. We handle exact length of 'val'.
                    self.setFormat(pos, len(val), fmt)
                pos += len(val)
        except Exception:
            pass

# -----------------------------------------------------------------------------
# MULTI-BLOCK CODE WIDGET
# -----------------------------------------------------------------------------
class LineNumberArea(QWidget):
    def __init__(self, editor):
        super().__init__(editor)
        self.codeEditor = editor

    def sizeHint(self):
        return QSize(self.codeEditor.lineNumberAreaWidth(), 0)

    def paintEvent(self, event):
        self.codeEditor.lineNumberAreaPaintEvent(event)

class CodeEditor(QPlainTextEdit):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.line_number_area = LineNumberArea(self)
        
        self.blockCountChanged.connect(self.updateLineNumberAreaWidth)
        self.updateRequest.connect(self.updateLineNumberArea)
        
        self.updateLineNumberAreaWidth(0)

    def wheelEvent(self, event):
        event.ignore()

    def lineNumberAreaWidth(self):
        digits = 1
        max_val = max(1, self.blockCount())
        while max_val >= 10:
            max_val //= 10
            digits += 1
        space = 10 + self.fontMetrics().horizontalAdvance('9') * max(2, digits)
        return space

    def updateLineNumberAreaWidth(self, _):
        self.setViewportMargins(self.lineNumberAreaWidth(), 0, 0, 0)

    def updateLineNumberArea(self, rect, dy):
        if dy:
            self.line_number_area.scroll(0, dy)
        else:
            self.line_number_area.update(0, rect.y(), self.line_number_area.width(), rect.height())
            
        if rect.contains(self.viewport().rect()):
            self.updateLineNumberAreaWidth(0)

    def resizeEvent(self, event):
        super().resizeEvent(event)
        cr = self.contentsRect()
        self.line_number_area.setGeometry(QRect(cr.left(), cr.top(), self.lineNumberAreaWidth(), cr.height()))

    def lineNumberAreaPaintEvent(self, event):
        painter = QPainter(self.line_number_area)
        painter.fillRect(event.rect(), QColor(CP_PANEL))

        block = self.firstVisibleBlock()
        blockNumber = block.blockNumber()
        top = int(self.blockBoundingGeometry(block).translated(self.contentOffset()).top())
        bottom = top + int(self.blockBoundingRect(block).height())

        while block.isValid() and top <= event.rect().bottom():
            if block.isVisible() and bottom >= event.rect().top():
                number = str(blockNumber + 1)
                painter.setPen(QColor(CP_SUBTEXT))
                painter.setFont(self.font())
                line_h = self.fontMetrics().height()
                painter.drawText(0, top, self.line_number_area.width() - 5, line_h, Qt.AlignmentFlag.AlignRight, number)

            block = block.next()
            top = bottom
            bottom = top + int(self.blockBoundingRect(block).height())
            blockNumber += 1

class CodeBlockWidget(QWidget):
    def __init__(self, parent=None, run_callback=None, comment="", type_="cmd", code="", comment_size=None, comment_color=None, config=None):
        super().__init__(parent)
        self.run_callback = run_callback
        self.config = config or {}
        
        default_size = self.config.get("multiblock_comment_size", 10)
        default_color = self.config.get("multiblock_comment_color", CP_YELLOW)
        
        self.comment_color = comment_color if comment_color is not None else default_color

        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setStyleSheet(f"CodeBlockWidget {{ border: 1px solid {CP_DIM}; background-color: {CP_PANEL}; border-radius: 4px; }}")
        
        layout = QVBoxLayout(self)
        layout.setContentsMargins(4, 4, 4, 4)
        layout.setSpacing(2)
        
        # Header layout
        header_lay = QHBoxLayout()
        header_lay.setContentsMargins(0, 0, 0, 0)
        header_lay.setSpacing(4)
        
        self.comment_input = QLineEdit()
        self.comment_input.setPlaceholderText("Comment / Header")
        self.comment_input.setText(comment)
        self.comment_input.setFixedHeight(26)
        
        self.type_cmb = QComboBox()
        self.type_cmb.addItems(["cmd", "powershell", "pwsh", "python"])
        self.type_cmb.setCurrentText(type_)
        self.type_cmb.setFixedWidth(95)
        self.type_cmb.setFixedHeight(26)
        self.type_cmb.setStyleSheet(f"background-color: {CP_BG}; color: {CP_CYAN}; border: 1px solid {CP_DIM}; padding: 2px 4px;")

        self.comment_size_spn = QSpinBox()
        self.comment_size_spn.setRange(6, 40)
        self.comment_size_spn.setValue(comment_size if comment_size is not None else default_size)
        self.comment_size_spn.setFixedWidth(50)
        self.comment_size_spn.setFixedHeight(26)
        self.comment_size_spn.setToolTip("Comment Font Size")
        self.comment_size_spn.setStyleSheet(f"background-color: {CP_BG}; color: {CP_CYAN}; border: 1px solid {CP_DIM}; padding: 2px;")

        self.btn_comment_color = QPushButton("A")
        self.btn_comment_color.setFixedSize(26, 26)
        self.btn_comment_color.setToolTip("Comment Font Color")
        self.btn_comment_color.clicked.connect(self.pick_comment_color)

        self.update_comment_style()
        self.comment_size_spn.valueChanged.connect(self.update_comment_style)

        btn_up = QPushButton("▲")
        btn_up.setFixedSize(26, 26)
        btn_up.setToolTip("Move block up")
        btn_up.setStyleSheet(f"QPushButton {{ background-color: {CP_PANEL}; color: {CP_CYAN}; border: 1px solid {CP_DIM}; font-size: 8pt; font-weight: bold; padding: 0px; border-radius: 3px; }} QPushButton:hover {{ background-color: {CP_DIM}; }}")
        btn_up.clicked.connect(self.move_up)

        btn_down = QPushButton("▼")
        btn_down.setFixedSize(26, 26)
        btn_down.setToolTip("Move block down")
        btn_down.setStyleSheet(f"QPushButton {{ background-color: {CP_PANEL}; color: {CP_CYAN}; border: 1px solid {CP_DIM}; font-size: 8pt; font-weight: bold; padding: 0px; border-radius: 3px; }} QPushButton:hover {{ background-color: {CP_DIM}; }}")
        btn_down.clicked.connect(self.move_down)

        btn_run = QPushButton("▶")
        btn_run.setFixedSize(26, 26)
        btn_run.setToolTip("Run this block individually")
        btn_run.setStyleSheet(f"QPushButton {{ background-color: {CP_GREEN}; color: black; font-weight: bold; font-size: 8pt; border: none; padding: 0px; border-radius: 3px; }} QPushButton:hover {{ background-color: #00cc1b; }}")
        btn_run.clicked.connect(self.run_code)
        
        btn_del = QPushButton("✕")
        btn_del.setFixedSize(26, 26)
        btn_del.setToolTip("Delete this block")
        btn_del.setStyleSheet(f"QPushButton {{ background-color: {CP_RED}; color: white; font-weight: bold; font-size: 10pt; border: none; padding: 0px; border-radius: 3px; }} QPushButton:hover {{ background-color: #d30f36; }}")
        btn_del.clicked.connect(self.delete_block)
        
        header_lay.addWidget(self.comment_input)
        header_lay.addWidget(self.type_cmb)
        header_lay.addWidget(self.comment_size_spn)
        header_lay.addWidget(self.btn_comment_color)
        header_lay.addWidget(btn_up)
        header_lay.addWidget(btn_down)
        header_lay.addWidget(btn_run)
        header_lay.addWidget(btn_del)
        
        # Code editor
        self.txt_edit = CodeEditor()
        self.txt_edit.setPlainText(code)
        self.txt_edit.setFont(QFont("Consolas", 10))
        self.txt_edit.setStyleSheet(f"background-color: {CP_BG}; color: {CP_TEXT}; border: 1px solid {CP_DIM};")
        self.txt_edit.setLineWrapMode(QPlainTextEdit.LineWrapMode.WidgetWidth)
        self.txt_edit.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.txt_edit.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.txt_edit.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Minimum)
        
        # Syntax highlighter
        self.highlighter = CodeHighlighter(self.txt_edit.document())
        self.highlighter.set_language(type_)
        self.type_cmb.currentTextChanged.connect(self.highlighter.set_language)
        
        layout.addLayout(header_lay)
        layout.addWidget(self.txt_edit)
        
        self.txt_edit.textChanged.connect(self.adjust_height)
        QTimer.singleShot(0, self.adjust_height)
        QTimer.singleShot(100, self.adjust_height)
        
    def showEvent(self, event):
        super().showEvent(event)
        QTimer.singleShot(0, self.adjust_height)

    def resizeEvent(self, event):
        super().resizeEvent(event)
        QTimer.singleShot(0, self.adjust_height)

    def adjust_height(self):
        doc = self.txt_edit.document()
        font_metrics = QFontMetrics(self.txt_edit.font())
        line_height = font_metrics.lineSpacing()
        
        total_lines = 0
        block = doc.begin()
        while block.isValid():
            layout = block.layout()
            if layout and layout.lineCount() > 0:
                total_lines += layout.lineCount()
            else:
                total_lines += 1
            block = block.next()
            
        total_lines = max(doc.blockCount(), total_lines)
        
        content_height = total_lines * line_height + 18
        content_height = max(45, content_height)
        
        self.txt_edit.setFixedHeight(content_height)
        self.setFixedHeight(content_height + 42)
        self.updateGeometry()

    def update_comment_style(self):
        c = self.comment_color or CP_YELLOW
        s = self.comment_size_spn.value()
        self.comment_input.setStyleSheet(f"background-color: {CP_BG}; color: {c}; border: 1px solid {CP_DIM}; padding: 4px; font-size: {s}pt;")
        lc = QColor(c).lightness() if QColor(c).isValid() else 255
        fg = 'black' if lc > 128 else 'white'
        self.btn_comment_color.setStyleSheet(f"background-color: {c}; color: {fg}; border: 1px solid {CP_DIM}; font-weight: bold; font-size: 10pt; padding: 0px; border-radius: 3px;")

    def pick_comment_color(self):
        curr = self.comment_color or CP_YELLOW
        c = QColorDialog.getColor(QColor(curr), self, "Select Comment / Header Color")
        if c.isValid():
            self.comment_color = c.name().upper()
            self.update_comment_style()

    def move_up(self):
        parent_widget = self.parentWidget()
        if parent_widget and parent_widget.layout():
            layout = parent_widget.layout()
            idx = layout.indexOf(self)
            if idx > 0:
                layout.removeWidget(self)
                layout.insertWidget(idx - 1, self)

    def move_down(self):
        parent_widget = self.parentWidget()
        if parent_widget and parent_widget.layout():
            layout = parent_widget.layout()
            idx = layout.indexOf(self)
            if idx >= 0 and idx < layout.count() - 1:
                layout.removeWidget(self)
                layout.insertWidget(idx + 1, self)

    def run_code(self):
        if self.run_callback:
            self.run_callback(self.txt_edit.toPlainText(), self.type_cmb.currentText())
            
    def delete_block(self):
        self.setParent(None)
        self.deleteLater()

# -----------------------------------------------------------------------------
# COPY STYLE SEARCH DIALOG
# -----------------------------------------------------------------------------
class CopyStyleDialog(QDialog):
    def __init__(self, all_items, parent=None):
        super().__init__(parent)
        self.setWindowTitle("COPY STYLE FROM ITEM / FOLDER")
        self.resize(500, 450)
        self.all_items = all_items
        self.selected_style = None

        self.setStyleSheet(f"""
            QDialog {{ background-color: {CP_BG}; border: 2px solid {CP_CYAN}; }}
            QLabel {{ color: {CP_YELLOW}; font-family: 'Consolas'; font-weight: bold; }}
            QLineEdit {{ background-color: {CP_PANEL}; color: {CP_CYAN}; border: 1px solid {CP_DIM}; padding: 6px; font-family: 'Consolas'; }}
            QListWidget {{ background-color: {CP_PANEL}; color: {CP_TEXT}; border: 1px solid {CP_DIM}; font-family: 'Consolas'; font-size: 10pt; }}
            QListWidget::item:selected {{ background-color: {CP_CYAN}; color: black; font-weight: bold; }}
            QPushButton {{ background-color: {CP_DIM}; color: white; border: none; padding: 8px; font-family: 'Consolas'; font-weight: bold; }}
            QPushButton:hover {{ border: 1px solid {CP_YELLOW}; }}
        """)

        layout = QVBoxLayout(self)
        layout.setSpacing(10)

        layout.addWidget(QLabel("SEARCH ITEM / FOLDER TO COPY STYLE FROM:"))
        
        self.inp_search = QLineEdit()
        self.inp_search.setPlaceholderText("Type to filter...")
        self.inp_search.textChanged.connect(self.filter_items)
        layout.addWidget(self.inp_search)

        self.list_widget = QListWidget()
        self.list_widget.itemDoubleClicked.connect(self.accept_selection)
        layout.addWidget(self.list_widget)

        btn_box = QHBoxLayout()
        btn_apply = QPushButton("COPY STYLE")
        btn_apply.setStyleSheet(f"background-color: {CP_GREEN}; color: black; font-weight: bold;")
        btn_apply.clicked.connect(self.accept_selection)

        btn_cancel = QPushButton("CANCEL")
        btn_cancel.clicked.connect(self.reject)

        btn_box.addWidget(btn_apply)
        btn_box.addWidget(btn_cancel)
        layout.addLayout(btn_box)

        self.populate_list(self.all_items)

    def populate_list(self, items):
        self.list_widget.clear()
        for entry in items:
            item_type = "[FOLDER]" if entry["data"].get("type") == "folder" else "[SCRIPT]"
            label = f"{item_type} {entry['path']}"
            lw_item = QListWidgetItem(label)
            lw_item.setData(Qt.ItemDataRole.UserRole, entry["data"])
            self.list_widget.addItem(lw_item)

    def filter_items(self, text):
        query = text.lower().strip()
        filtered = [item for item in self.all_items if query in item["path"].lower()]
        self.populate_list(filtered)

    def accept_selection(self):
        current_item = self.list_widget.currentItem()
        if current_item:
            self.selected_style = current_item.data(Qt.ItemDataRole.UserRole)
            self.accept()

# FULL EDIT DIALOG
# -----------------------------------------------------------------------------
class EditDialog(QDialog):
    def __init__(self, script_data, parent=None):
        super().__init__(parent)
        self.script = script_data
        self.config = parent.config if parent and hasattr(parent, 'config') else {}
        self._batch_bg = None
        self._batch_fg = None
        self._batch_border = None
        self.setWindowTitle(f"EDIT // {self.script.get('name', 'UNKNOWN')}")
        edit_w = self.config.get("edit_panel_width", 1150)
        edit_h = self.config.get("edit_panel_height", 750)
        self.resize(edit_w, edit_h)
        self.setStyleSheet(f"""
            QDialog {{ background-color: {CP_BG}; }}
            QWidget {{ color: {CP_TEXT}; font-family: 'Consolas'; font-size: 10pt; }}
            QGroupBox {{ border: 1px solid {CP_DIM}; margin-top: 10px; padding-top: 10px; font-weight: bold; color: {CP_YELLOW}; }}
            QGroupBox::title {{ subcontrol-origin: margin; subcontrol-position: top left; padding: 0 5px; }}
            QLineEdit, QSpinBox, QComboBox, QPlainTextEdit {{
                background-color: {CP_PANEL}; color: {CP_CYAN}; border: 1px solid {CP_DIM}; padding: 4px; selection-background-color: {CP_CYAN}; selection-color: black;
            }}
            QLineEdit:focus, QPlainTextEdit:focus, QSpinBox:focus {{ border: 1px solid {CP_CYAN}; }}
            QSpinBox::up-button, QSpinBox::down-button {{ width: 0px; border: none; }}
            QPushButton {{ background-color: {CP_DIM}; border: 1px solid {CP_DIM}; color: white; padding: 6px 12px; }}
            QPushButton:hover {{ background-color: #2a2a2a; border: 1px solid {CP_YELLOW}; }}
            QCheckBox {{ spacing: 8px; }}
            QCheckBox::indicator {{ width: 14px; height: 14px; border: 1px solid {CP_DIM}; background: {CP_PANEL}; }}
            QCheckBox::indicator:checked {{ background: {CP_YELLOW}; border-color: {CP_YELLOW}; }}
        """)
        
        vbox = QVBoxLayout(self)
        
        # Content HBox
        hbox = QHBoxLayout()
        vbox.addLayout(hbox)
        
        # === LEFT PANEL ===
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        left_widget = QWidget()
        left_layout = QVBoxLayout(left_widget)
        
        # 1. Identity
        grp_basic = QGroupBox("IDENTITY")
        l_basic = QFormLayout()
        
        name_box = QHBoxLayout()
        self.inp_name = QLineEdit(self.script.get("name", ""))
        self.inp_name.setPlaceholderText("Script Name")
        # Removed MaximumWidth to allow it to expand
        name_box.addWidget(self.inp_name, stretch=1) 
        
        name_box.addWidget(QLabel("NF:"))
        self.inp_nf_char = QLineEdit(self.script.get("nf_char", ""))
        self.inp_nf_char.setPlaceholderText("")
        self.inp_nf_char.setFixedWidth(80) 
        self.inp_nf_char.setToolTip("Nerd Font Character")
        name_box.addWidget(self.inp_nf_char)
        
        # SVG Button and Preview
        self.btn_svg = QPushButton("SVG")
        self.btn_svg.setFixedWidth(60)
        self.btn_svg.setToolTip("Paste raw SVG code")
        self.btn_svg.clicked.connect(self.open_svg_dialog)
        name_box.addWidget(self.btn_svg)
        
        self.lbl_svg_preview = QLabel()
        self.lbl_svg_preview.setFixedSize(24, 24)
        self.lbl_svg_preview.setStyleSheet(f"border: 1px solid {CP_DIM}; background: {CP_PANEL};")
        self.lbl_svg_preview.setAlignment(Qt.AlignmentFlag.AlignCenter)
        name_box.addWidget(self.lbl_svg_preview)
        
        # Removed addStretch() to let inp_name take the space
        l_basic.addRow("Name:", name_box)
        
        self.update_svg_preview(self.script.get("svg_content", ""))
        
        # Tags row
        tags_box = QHBoxLayout()
        current_tags = self.script.get("tags", [])
        tags_str = ", ".join(current_tags) if isinstance(current_tags, list) else str(current_tags)
        self.inp_tags = QLineEdit(tags_str)
        self.inp_tags.setPlaceholderText("dev, python, admin (comma-separated)")
        tags_box.addWidget(self.inp_tags)
        l_basic.addRow("Tags:", tags_box)

        # Icon path (for all items)
        icon_box = QHBoxLayout()
        self.inp_icon = QLineEdit(normalize_path(self.script.get("icon_path", "")))
        self.inp_icon.setPlaceholderText("Optional .ico or .png")
        btn_browse_icon = QPushButton("📂")
        btn_browse_icon.setFixedWidth(36)
        btn_browse_icon.setToolTip("Browse for icon file")
        btn_browse_icon.setStyleSheet(f"background-color: {CP_DIM}; color: white; border: 1px solid {CP_DIM}; padding: 2px; font-size: 11pt;")
        btn_browse_icon.clicked.connect(self.browse_icon)
        icon_box.addWidget(self.inp_icon)
        icon_box.addWidget(btn_browse_icon)
        l_basic.addRow("Icon:", icon_box)
        
        # Icon settings row
        icon_settings = QHBoxLayout()
        icon_settings.addWidget(QLabel("W:"))
        self.spn_icon_w = QSpinBox()
        self.spn_icon_w.setRange(0, 256)
        self.spn_icon_w.setValue(self.script.get("icon_width", 0))
        self.spn_icon_w.setToolTip("0 = Auto")
        self.spn_icon_w.setFixedWidth(55)
        icon_settings.addWidget(self.spn_icon_w)
        
        icon_settings.addWidget(QLabel("H:"))
        self.spn_icon_h = QSpinBox()
        self.spn_icon_h.setRange(0, 256)
        self.spn_icon_h.setValue(self.script.get("icon_height", 0))
        self.spn_icon_h.setToolTip("0 = Auto")
        self.spn_icon_h.setFixedWidth(55)
        icon_settings.addWidget(self.spn_icon_h)
        
        icon_settings.addWidget(QLabel("Gap:"))
        self.spn_icon_gap = QSpinBox()
        self.spn_icon_gap.setRange(0, 50)
        self.spn_icon_gap.setValue(self.script.get("icon_gap", 2))
        self.spn_icon_gap.setToolTip("Space between icon and text")
        self.spn_icon_gap.setFixedWidth(45)
        icon_settings.addWidget(self.spn_icon_gap)
        
        icon_settings.addWidget(QLabel("Pos:"))
        self.cmb_icon_pos = QComboBox()
        self.cmb_icon_pos.addItems(["top", "left", "right", "bottom", "center"])
        self.cmb_icon_pos.setCurrentText(self.script.get("icon_position", "top"))
        self.cmb_icon_pos.setFixedWidth(75)
        icon_settings.addWidget(self.cmb_icon_pos)
        icon_settings.addStretch()
        l_basic.addRow("", icon_settings)
        
        grp_basic.setLayout(l_basic)
        left_layout.addWidget(grp_basic)
        
        # 2. Execution
        grp_exec = QGroupBox("BEHAVIOR")
        l_exec = QVBoxLayout()
        
        if self.script.get("type") != "folder":
            self.chk_hide = QCheckBox("Hide Term")
            self.chk_hide.setChecked(self.script.get("hide_terminal", False))
            self.chk_keep = QCheckBox("Keep Open")
            self.chk_keep.setChecked(self.script.get("keep_open", False))
            self.chk_kill = QCheckBox("Kill Launch")
            self.chk_kill.setChecked(self.script.get("kill_window", False))
            self.chk_new_term = QCheckBox("New Terminal")
            self.chk_new_term.setChecked(self.script.get("new_terminal", False))
            self.chk_admin = QCheckBox("Run as Admin")
            self.chk_admin.setChecked(self.script.get("run_admin", False))

            row1 = QHBoxLayout()
            row1.addWidget(self.chk_hide)
            row1.addWidget(self.chk_keep)
            row1.addWidget(self.chk_kill)
            row1.addWidget(self.chk_new_term)
            l_exec.addLayout(row1)
            
            row2 = QHBoxLayout()
            row2.addWidget(self.chk_admin)
        else:
            row2 = QHBoxLayout()

        self.chk_edit_on_click = QCheckBox("Edit on Left Click")
        self.chk_edit_on_click.setChecked(self.script.get("edit_on_click", False))
        self.chk_edit_on_click.setToolTip("Left-clicking this item opens the Edit Dialog directly instead of launching it")
        row2.addWidget(self.chk_edit_on_click)

        self.chk_pass_lock = QCheckBox("Password Lock")
        self.chk_pass_lock.setChecked(self.script.get("require_password", False))
        row2.addWidget(self.chk_pass_lock)
        row2.addStretch() 
        l_exec.addLayout(row2)

        if self.script.get("type") != "folder":
            l_sc = QFormLayout()
            
            # Ctrl+Left row layout
            layout_ctrl_left = QHBoxLayout()
            self.inp_ctrl_left = QLineEdit(self.script.get("ctrl_left_cmd", ""))
            layout_ctrl_left.addWidget(self.inp_ctrl_left)
            
            btn_ctrl_left_preset = QPushButton("▼")
            btn_ctrl_left_preset.setFixedWidth(28)
            btn_ctrl_left_preset.setStyleSheet(f"background-color: {CP_PANEL}; border: 1px solid {CP_DIM}; color: {CP_CYAN};")
            
            menu_ctrl_left = QMenu(self)
            menu_ctrl_left.setStyleSheet(f"""
                QMenu {{ background-color: {CP_PANEL}; color: {CP_TEXT}; border: 1px solid {CP_DIM}; }}
                QMenu::item:selected {{ background-color: {CP_CYAN}; color: black; }}
            """)
            for module in CTRL_COMMAND_MODULES:
                act = QAction(module["name"], self)
                act.triggered.connect(lambda checked, c=module["cmd"]: self.inp_ctrl_left.setText(c))
                menu_ctrl_left.addAction(act)
            btn_ctrl_left_preset.setMenu(menu_ctrl_left)
            layout_ctrl_left.addWidget(btn_ctrl_left_preset)
            
            # Ctrl+Right row layout
            layout_ctrl_right = QHBoxLayout()
            self.inp_ctrl_right = QLineEdit(self.script.get("ctrl_right_cmd", ""))
            layout_ctrl_right.addWidget(self.inp_ctrl_right)
            
            btn_ctrl_right_preset = QPushButton("▼")
            btn_ctrl_right_preset.setFixedWidth(28)
            btn_ctrl_right_preset.setStyleSheet(f"background-color: {CP_PANEL}; border: 1px solid {CP_DIM}; color: {CP_CYAN};")
            
            menu_ctrl_right = QMenu(self)
            menu_ctrl_right.setStyleSheet(f"""
                QMenu {{ background-color: {CP_PANEL}; color: {CP_TEXT}; border: 1px solid {CP_DIM}; }}
                QMenu::item:selected {{ background-color: {CP_CYAN}; color: black; }}
            """)
            for module in CTRL_COMMAND_MODULES:
                act = QAction(module["name"], self)
                act.triggered.connect(lambda checked, c=module["cmd"]: self.inp_ctrl_right.setText(c))
                menu_ctrl_right.addAction(act)
            btn_ctrl_right_preset.setMenu(menu_ctrl_right)
            layout_ctrl_right.addWidget(btn_ctrl_right_preset)
            
            l_sc.addRow("Ctrl+Left:", layout_ctrl_left)
            l_sc.addRow("Ctrl+Right:", layout_ctrl_right)
            l_exec.addLayout(l_sc)
            
        grp_exec.setLayout(l_exec)
        left_layout.addWidget(grp_exec)
            
        # 3. Typography
        grp_typo = QGroupBox("TYPOGRAPHY")
        l_typo = QGridLayout()
        self.cmb_font = QComboBox()
        all_fonts = sorted(QFontDatabase.families())
        self.cmb_font.addItems(all_fonts)
        
        # Use global default if item has no custom font
        default_font = self.config.get("default_font_family", "Consolas")
        current_font = self.script.get("font_family", default_font)
        idx = self.cmb_font.findText(current_font, Qt.MatchFlag.MatchExactly)
        if idx >= 0: self.cmb_font.setCurrentIndex(idx)
        else: self.cmb_font.setEditText(current_font) # fallback if editable
        
        l_typo.addWidget(QLabel("Font:"), 0, 0)
        l_typo.addWidget(self.cmb_font, 0, 1, 1, 3)
        l_typo.addWidget(QLabel("Size:"), 1, 0)
        self.spn_size = QSpinBox()
        self.spn_size.setRange(6, 72)
        
        # Pull global default if item has no font_size
        default_fs = self.config.get("default_font_size", 10)
        default_bold = self.config.get("default_is_bold", True)
        default_italic = self.config.get("default_is_italic", False)
            
        self.spn_size.setValue(self.script.get("font_size", default_fs))
        l_typo.addWidget(self.spn_size, 1, 1)
        self.chk_bold = QCheckBox("Bold")
        self.chk_bold.setChecked(self.script.get("is_bold", default_bold))
        l_typo.addWidget(self.chk_bold, 1, 2)
        self.chk_italic = QCheckBox("Italic")
        self.chk_italic.setChecked(self.script.get("is_italic", default_italic))
        l_typo.addWidget(self.chk_italic, 1, 3)

        l_typo.addWidget(QLabel("Align:"), 2, 0)
        self.cmb_align = QComboBox()
        self.cmb_align.addItems(["center", "left", "right"])
        self.cmb_align.setCurrentText(self.script.get("text_align", "center"))
        l_typo.addWidget(self.cmb_align, 2, 1, 1, 3)

        grp_typo.setLayout(l_typo)
        left_layout.addWidget(grp_typo)
        
        # 4. Colors
        grp_colors = QGroupBox("COLORS")
        l_colors = QGridLayout()
        self.btn_col_bg = self.create_color_btn("BG Color", "color")
        self.btn_col_fg = self.create_color_btn("Text Color", "text_color")
        self.btn_col_hbg = self.create_color_btn("Hover BG", "hover_color")
        self.btn_col_hfg = self.create_color_btn("Hover Text", "hover_text_color")
        self.btn_col_brd = self.create_color_btn("Border", "border_color")
        l_colors.addWidget(self.btn_col_bg, 0, 0)
        l_colors.addWidget(self.btn_col_fg, 0, 1)
        l_colors.addWidget(self.btn_col_hbg, 1, 0)
        l_colors.addWidget(self.btn_col_hfg, 1, 1)
        l_colors.addWidget(self.btn_col_brd, 2, 0, 1, 2)
        
        self.chk_trans_bg = QCheckBox("Transparent BG")
        self.chk_trans_bg.setChecked(self.script.get("transparent_bg", False))
        l_colors.addWidget(self.chk_trans_bg, 3, 0)

        self.chk_trans_hbg = QCheckBox("Transparent Hover BG")
        self.chk_trans_hbg.setChecked(self.script.get("hover_transparent_bg", False))
        l_colors.addWidget(self.chk_trans_hbg, 3, 1)
        
        grp_colors.setLayout(l_colors)
        left_layout.addWidget(grp_colors)
        
        # 5. Layout
        grp_layout = QGroupBox("GRID LAYOUT")
        l_lay = QGridLayout()
        self.spn_cspan = QSpinBox(); self.spn_cspan.setRange(1, 10); self.spn_cspan.setValue(self.script.get("col_span", 1))
        self.spn_rspan = QSpinBox(); self.spn_rspan.setRange(1, 10); self.spn_rspan.setValue(self.script.get("row_span", 1))
        self.spn_width = QSpinBox(); self.spn_width.setRange(0, 9999); self.spn_width.setValue(self.script.get("width", 0))
        self.spn_height = QSpinBox(); self.spn_height.setRange(0, 9999); self.spn_height.setValue(self.script.get("height", 0))
        self.spn_radius = QSpinBox(); self.spn_radius.setRange(0, 50); self.spn_radius.setValue(self.script.get("corner_radius", 0))
        self.spn_border = QSpinBox(); self.spn_border.setRange(0, 10); self.spn_border.setValue(self.script.get("border_width", 0))
        
        l_lay.addWidget(QLabel("Col Span:"), 0, 0); l_lay.addWidget(self.spn_cspan, 0, 1)
        l_lay.addWidget(QLabel("Row Span:"), 0, 2); l_lay.addWidget(self.spn_rspan, 0, 3)
        l_lay.addWidget(QLabel("Width:"), 1, 0); l_lay.addWidget(self.spn_width, 1, 1)
        l_lay.addWidget(QLabel("Height:"), 1, 2); l_lay.addWidget(self.spn_height, 1, 3)
        l_lay.addWidget(QLabel("Radius:"), 2, 0); l_lay.addWidget(self.spn_radius, 2, 1)
        l_lay.addWidget(QLabel("Border:"), 2, 2); l_lay.addWidget(self.spn_border, 2, 3)
        grp_layout.setLayout(l_lay)
        left_layout.addWidget(grp_layout)
        
        # 6. Folder Specific View Settings
        if self.script.get("type") == "folder":
            grp_fview = QGroupBox("FOLDER VIEW SETTINGS")
            l_fv = QGridLayout()
            l_fv.setSpacing(8)
            
            l_fv.addWidget(QLabel("Inner Columns:"), 0, 0)
            self.spn_inner_cols = QSpinBox(); self.spn_inner_cols.setRange(0, 20); 
            self.spn_inner_cols.setValue(self.script.get("grid_columns", 0)) # 0 means default
            self.spn_inner_cols.setToolTip("0 = Inherit Global")
            l_fv.addWidget(self.spn_inner_cols, 0, 1)
            
            l_fv.addWidget(QLabel("Inner Row Height:"), 0, 2)
            self.spn_inner_h = QSpinBox(); self.spn_inner_h.setRange(0, 9999); 
            self.spn_inner_h.setValue(self.script.get("grid_btn_height", 0)) # 0 means default
            self.spn_inner_h.setToolTip("0 = Inherit Global")
            l_fv.addWidget(self.spn_inner_h, 0, 3)

            l_fv.addWidget(QLabel("Batch Font Size:"), 1, 0)
            self.spn_batch_font_size = QSpinBox()
            self.spn_batch_font_size.setRange(0, 72)
            self.spn_batch_font_size.setValue(0)
            self.spn_batch_font_size.setSpecialValueText("Keep")
            self.spn_batch_font_size.setToolTip("Select value > 0 to apply font size to all items inside on Save.")
            l_fv.addWidget(self.spn_batch_font_size, 1, 1)

            l_fv.addWidget(QLabel("Batch Border Width:"), 1, 2)
            self.spn_batch_border_width = QSpinBox()
            self.spn_batch_border_width.setRange(-1, 50)
            self.spn_batch_border_width.setValue(-1)
            self.spn_batch_border_width.setSpecialValueText("Keep")
            self.spn_batch_border_width.setToolTip("Select value >= 0 to apply border width to all items inside on Save.")
            l_fv.addWidget(self.spn_batch_border_width, 1, 3)

            l_fv.addWidget(QLabel("Batch Align:"), 2, 0)
            self.cmb_batch_align = QComboBox()
            self.cmb_batch_align.addItems(["", "center", "left", "right"])
            self.cmb_batch_align.setToolTip("Apply text alignment to all items inside this folder on Save")
            l_fv.addWidget(self.cmb_batch_align, 2, 1)

            l_fv.addWidget(QLabel("Batch Colors:"), 3, 0)
            color_btn_lay = QHBoxLayout()
            color_btn_lay.setContentsMargins(0, 0, 0, 0)
            color_btn_lay.setSpacing(4)

            self.btn_batch_bg = QPushButton("Pick BG")
            self.btn_batch_bg.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
            self.btn_batch_bg.clicked.connect(self.pick_batch_bg)
            color_btn_lay.addWidget(self.btn_batch_bg)

            self.btn_batch_fg = QPushButton("Pick FG")
            self.btn_batch_fg.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
            self.btn_batch_fg.clicked.connect(self.pick_batch_fg)
            color_btn_lay.addWidget(self.btn_batch_fg)

            self.btn_batch_border = QPushButton("Pick Border")
            self.btn_batch_border.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
            self.btn_batch_border.clicked.connect(self.pick_batch_border)
            color_btn_lay.addWidget(self.btn_batch_border)

            self.btn_clear_batch_col = QPushButton("Clear")
            self.btn_clear_batch_col.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
            self.btn_clear_batch_col.clicked.connect(self.clear_batch_colors)
            color_btn_lay.addWidget(self.btn_clear_batch_col)

            l_fv.addLayout(color_btn_lay, 3, 1, 1, 3)

            l_fv.addWidget(QLabel("Batch Options:"), 4, 0)
            trans_box = QHBoxLayout()
            trans_box.setContentsMargins(0, 0, 0, 0)
            trans_box.setSpacing(15)

            self.chk_batch_trans = QCheckBox("Batch Transparent BG")
            self.chk_batch_trans.setChecked(False)
            self.chk_batch_trans.setToolTip("Set background to transparent for all items inside this folder on Save")
            trans_box.addWidget(self.chk_batch_trans)

            self.chk_batch_trans_hbg = QCheckBox("Batch Transparent Hover BG")
            self.chk_batch_trans_hbg.setChecked(False)
            self.chk_batch_trans_hbg.setToolTip("Set hover background to transparent for all items inside this folder on Save")
            trans_box.addWidget(self.chk_batch_trans_hbg)
            trans_box.addStretch()

            l_fv.addLayout(trans_box, 4, 1, 1, 3)
            
            grp_fview.setLayout(l_fv)
            left_layout.addWidget(grp_fview)
        
        left_layout.addStretch()
        left_widget.setLayout(left_layout)
        scroll.setWidget(left_widget)
        hbox.addWidget(scroll, stretch=4) # 40% split
        
        # === RIGHT PANEL ===
        if self.script.get("type") != "folder":
            right_grp = QGroupBox("SCRIPT EXECUTION TARGET")
            r_lay = QVBoxLayout()
            
            # Switch
            mode_box = QHBoxLayout()
            self.grp_mode = QButtonGroup(self)
            self.rb_file = QRadioButton("Target File")
            self.rb_inline = QRadioButton("Inline Script")
            self.rb_multi = QRadioButton("Multi-Block")
            
            self.grp_mode.addButton(self.rb_file)
            self.grp_mode.addButton(self.rb_inline)
            self.grp_mode.addButton(self.rb_multi)
            
            mode_box.addWidget(self.rb_file)
            mode_box.addWidget(self.rb_inline)
            mode_box.addWidget(self.rb_multi)
            
            if self.script.get("use_multi_block"):
                self.rb_multi.setChecked(True)
            elif self.script.get("use_inline"):
                self.rb_inline.setChecked(True)
            else:
                self.rb_file.setChecked(True)
            
            r_lay.addLayout(mode_box)
            
            # --- TARGET FILE CONTAINER ---
            self.target_file_container = QWidget()
            target_file_lay = QVBoxLayout(self.target_file_container)
            target_file_lay.setContentsMargins(0, 10, 0, 0)
            target_file_lay.setSpacing(8)
            
            target_file_lay.addWidget(QLabel("Target Executable / File Path:"))
            
            path_box = QHBoxLayout()
            self.inp_path = QLineEdit(normalize_path(self.script.get("path", "")))
            self.inp_path.setPlaceholderText("C:\\path\\to\\script.py or executable...")
            btn_browse_path = QPushButton("Browse...")
            btn_browse_path.setStyleSheet(f"background-color: {CP_DIM}; color: white; padding: 6px 12px;")
            btn_browse_path.clicked.connect(self.browse_path)
            path_box.addWidget(self.inp_path)
            path_box.addWidget(btn_browse_path)
            
            target_file_lay.addLayout(path_box)
            target_file_lay.addStretch()
            
            r_lay.addWidget(self.target_file_container)
            
            # --- SINGLE BLOCK CONTAINER ---
            self.single_block_container = QWidget()
            single_lay = QVBoxLayout(self.single_block_container)
            single_lay.setContentsMargins(0, 0, 0, 0)
            
            # Interpreter
            interp_layout = QHBoxLayout()
            interp_layout.addWidget(QLabel("Interpreter:"))
            
            self.cmb_type = QComboBox()
            self.cmb_type.addItems(["cmd", "powershell", "pwsh", "python"])
            self.cmb_type.setCurrentText(self.script.get("inline_type", "cmd"))
            interp_layout.addWidget(self.cmb_type)

            btn_run_inline = QPushButton("Run")
            btn_run_inline.setFixedWidth(50)
            btn_run_inline.setToolTip("Test run this inline script immediately")
            btn_run_inline.setStyleSheet(f"background-color: {CP_GREEN}; color: black; border: none; font-weight: bold;")
            btn_run_inline.clicked.connect(self.test_run_inline)
            interp_layout.addWidget(btn_run_inline)
            
            single_lay.addLayout(interp_layout)
            
            # Editor
            single_lay.addWidget(QLabel("Code:"))
            self.txt_inline = CodeEditor()
            self.txt_inline.setPlainText(self.script.get("inline_script", ""))
            self.txt_inline.setFont(QFont("Consolas", 10))
            self.txt_inline.setStyleSheet(f"background-color: {CP_BG}; color: {CP_TEXT}; border: 1px solid {CP_DIM};")
            self.highlighter = CodeHighlighter(self.txt_inline.document())
            self.highlighter.set_language(self.cmb_type.currentText())
            self.cmb_type.currentTextChanged.connect(self.highlighter.set_language)
            single_lay.addWidget(self.txt_inline)
            
            r_lay.addWidget(self.single_block_container)
            
            # --- MULTI BLOCK CONTAINER ---
            self.multi_block_container = QWidget()
            multi_lay = QVBoxLayout(self.multi_block_container)
            multi_lay.setContentsMargins(0, 0, 0, 0)
            
            # Header with "+" button
            multi_header = QHBoxLayout()
            multi_header.addWidget(QLabel("Multi-Block Scripts:"))
            
            btn_add_block = QPushButton("+ Add Block")
            btn_add_block.setFixedWidth(100)
            btn_add_block.setStyleSheet(f"background-color: {CP_CYAN}; color: black; font-weight: bold; border: none; padding: 4px;")
            btn_add_block.clicked.connect(lambda: self.add_multi_block())
            multi_header.addWidget(btn_add_block)
            
            multi_lay.addLayout(multi_header)
            
            # Scroll area for blocks
            self.blocks_scroll = QScrollArea()
            self.blocks_scroll.setWidgetResizable(True)
            self.blocks_scroll.setStyleSheet(f"background-color: {CP_BG}; border: 1px solid {CP_DIM};")
            
            # Cyberpunk Scrollbar Style for outer scroll area
            self.blocks_scroll.verticalScrollBar().setStyleSheet(f"""
                QScrollBar:vertical {{
                    border: none;
                    background: {CP_BG};
                    width: 4px;
                    margin: 0px 0px 0px 0px;
                }}
                QScrollBar::handle:vertical {{
                    background: #FFFFFF;
                    min-height: 20px;
                    border-radius: 2px;
                }}
                QScrollBar::handle:vertical:hover {{
                    background: #FFFFFF;
                }}
                QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
                    border: none;
                    background: none;
                    height: 0px;
                }}
                QScrollBar::up-arrow:vertical, QScrollBar::down-arrow:vertical {{
                    border: none;
                    background: none;
                }}
                QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {{
                    background: none;
                }}
            """)
            
            self.blocks_widget = QWidget()
            self.blocks_widget.setStyleSheet(f"background-color: {CP_BG};")
            self.blocks_layout = QVBoxLayout(self.blocks_widget)
            self.blocks_layout.setContentsMargins(5, 5, 5, 5)
            self.blocks_layout.setAlignment(Qt.AlignmentFlag.AlignTop)
            
            self.blocks_scroll.setWidget(self.blocks_widget)
            multi_lay.addWidget(self.blocks_scroll)
            
            r_lay.addWidget(self.multi_block_container)
            
            # Load existing blocks
            blocks = self.script.get("inline_blocks", [])
            for block in blocks:
                self.add_multi_block(
                    comment=block.get("comment", ""),
                    type_=block.get("type", "cmd"),
                    code=block.get("code", ""),
                    comment_size=block.get("comment_size"),
                    comment_color=block.get("comment_color")
                )
                
            self.grp_mode.buttonToggled.connect(lambda: self.toggle_mode())
            self.toggle_mode()
            
            right_grp.setLayout(r_lay)
            hbox.addWidget(right_grp, stretch=6) # 60% split
            
        # === BOTTOM BUTTONS ===
        btn_layout = QHBoxLayout()
        
        btn_reset = QPushButton("RESET")
        btn_reset.setStyleSheet(f"background-color: {CP_DIM}; color: white; padding: 10px;")
        btn_reset.clicked.connect(self.reset_styles)
        
        btn_random = QPushButton("RANDOM")
        btn_random.setStyleSheet(f"background-color: {CP_CYAN}; color: black; padding: 10px;")
        btn_random.clicked.connect(self.randomize_colors)
        
        btn_copy_style = QPushButton("COPY STYLE FROM...")
        btn_copy_style.setStyleSheet(f"background-color: {CP_CYAN}; color: black; font-weight: bold; padding: 10px;")
        btn_copy_style.clicked.connect(self.open_copy_style_dialog)

        btn_save = QPushButton("SAVE CHANGES"); 
        btn_save.setStyleSheet(f"background-color: {CP_YELLOW}; color: black; font-weight: bold; padding: 10px;")
        btn_save.clicked.connect(self.save)
        btn_cancel = QPushButton("CANCEL")
        btn_cancel.setStyleSheet(f"background-color: {CP_RED}; color: white; padding: 10px;")
        btn_cancel.clicked.connect(self.reject)
        
        btn_layout.addWidget(btn_reset)
        btn_layout.addWidget(btn_random)
        btn_layout.addWidget(btn_copy_style)
        btn_layout.addStretch()
        btn_layout.addWidget(btn_save)
        btn_layout.addWidget(btn_cancel)
        vbox.addLayout(btn_layout)

    def collect_all_style_candidates(self, item_list, current_path=""):
        candidates = []
        for item in item_list:
            if item is self.script:
                continue
            name = item.get("name", "Unnamed").replace("<br>", " ").replace("<br/>", " ").replace("<BR>", " ")
            name = " ".join(name.split())
            path_str = f"{current_path} > {name}" if current_path else name
            
            candidates.append({"path": path_str, "data": item})
            
            if item.get("type") == "folder" and "scripts" in item:
                candidates.extend(self.collect_all_style_candidates(item["scripts"], path_str))
        return candidates

    def open_copy_style_dialog(self):
        all_scripts = self.config.get("scripts", [])
        candidates = self.collect_all_style_candidates(all_scripts)
        if not candidates:
            QMessageBox.information(self, "Copy Style", "No other items found in configuration.")
            return

        dlg = CopyStyleDialog(candidates, self)
        if dlg.exec() and dlg.selected_style:
            src = dlg.selected_style
            style_keys = [
                "color", "text_color", "hover_color", "hover_text_color",
                "border_color", "border_width", "transparent_bg", "hover_transparent_bg",
                "font_family", "font_size", "is_bold", "is_italic", "text_align",
                "corner_radius", "col_span", "row_span", "width", "height",
                "icon_width", "icon_height", "icon_gap", "icon_position",
                "grid_columns", "grid_btn_height"
            ]
            for key in style_keys:
                if key in src:
                    self.script[key] = src[key]
                else:
                    self.script.pop(key, None)

            # Update dialog UI controls to reflect copied values
            def_font = self.config.get("default_font_family", "Consolas")
            def_fs = self.config.get("default_font_size", 10)
            def_bold = self.config.get("default_is_bold", True)
            def_italic = self.config.get("default_is_italic", False)

            current_font = self.script.get("font_family", def_font)
            idx = self.cmb_font.findText(current_font, Qt.MatchFlag.MatchExactly)
            if idx >= 0: self.cmb_font.setCurrentIndex(idx)
            
            self.spn_size.setValue(self.script.get("font_size", def_fs))
            self.chk_bold.setChecked(self.script.get("is_bold", def_bold))
            self.chk_italic.setChecked(self.script.get("is_italic", def_italic))
            self.cmb_align.setCurrentText(self.script.get("text_align", "center"))
            self.chk_trans_bg.setChecked(self.script.get("transparent_bg", False))
            self.chk_trans_hbg.setChecked(self.script.get("hover_transparent_bg", False))

            self.spn_cspan.setValue(self.script.get("col_span", 1))
            self.spn_rspan.setValue(self.script.get("row_span", 1))
            self.spn_width.setValue(self.script.get("width", 0))
            self.spn_height.setValue(self.script.get("height", 0))
            self.spn_radius.setValue(self.script.get("corner_radius", 0))
            self.spn_border.setValue(self.script.get("border_width", 0))

            self.spn_icon_w.setValue(self.script.get("icon_width", 0))
            self.spn_icon_h.setValue(self.script.get("icon_height", 0))
            self.spn_icon_gap.setValue(self.script.get("icon_gap", 2))
            self.cmb_icon_pos.setCurrentText(self.script.get("icon_position", "top"))

            # Update color picker buttons
            is_folder = (self.script.get("type") == "folder")
            def_sbg = self.config.get("def_folder_bg", CP_YELLOW) if is_folder else self.config.get("def_script_bg", "#FFFFFF")
            def_sfg = self.config.get("def_folder_fg", "#000000") if is_folder else self.config.get("def_script_fg", "#000000")
            def_shbg = self.config.get("def_folder_hbg", CP_BG) if is_folder else self.config.get("def_script_hbg", CP_BG)
            def_shfg = self.config.get("def_folder_hfg", def_sbg) if is_folder else self.config.get("def_script_hfg", def_sbg)

            self.set_btn_color(self.btn_col_bg, self.script.get("color", def_sbg))
            self.set_btn_color(self.btn_col_fg, self.script.get("text_color", def_sfg))
            self.set_btn_color(self.btn_col_hbg, self.script.get("hover_color", def_shbg))
            self.set_btn_color(self.btn_col_hfg, self.script.get("hover_text_color", def_shfg))
            self.set_btn_color(self.btn_col_brd, self.script.get("border_color", self.script.get("color", def_sbg)))

            if is_folder:
                self.spn_inner_cols.setValue(self.script.get("grid_columns", 0))
                self.spn_inner_h.setValue(self.script.get("grid_btn_height", 0))

    def run_code_block(self, code, interpreter):
        import tempfile
        if not code.strip(): return
        
        if interpreter == "python": ext = ".py"
        elif interpreter in ["powershell", "pwsh"]: ext = ".ps1"
        else: ext = ".bat"
        
        try:
            with tempfile.NamedTemporaryFile(mode='w', suffix=ext, delete=False) as f:
                f.write(code)
                tmp = f.name
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Temp file error: {e}")
            return
            
        keep = True
        hide = False
        admin = self.chk_admin.isChecked()
        
        parent = self.parent()
        if hasattr(parent, "_run_shell"):
            cwd = os.getcwd()
            
            if ext == ".ps1":
                ps_exe = interpreter
                if ps_exe not in ["pwsh", "powershell"]:
                     ps_exe = "pwsh" if shutil.which("pwsh") else "powershell"
                
                no_exit = "-NoExit" if keep else ""
                params = f'{no_exit} -File "{tmp}"'
                parent._run_shell(ps_exe, params, cwd, admin=admin, hide=hide)
                
            elif ext == ".py":
                mode = "/k" if keep else "/c"
                params = f'{mode} python "{tmp}"'
                parent._run_shell("cmd.exe", params, cwd, admin=admin, hide=hide)
                
            else:
                mode = "/k" if keep else "/c"
                parent._run_shell("cmd.exe", f'{mode} "{tmp}"', cwd, admin=admin, hide=hide)

    def test_run_inline(self):
        self.run_code_block(self.txt_inline.toPlainText(), self.cmb_type.currentText())

    def run_individual_block(self, code, interpreter):
        self.run_code_block(code, interpreter)

    def add_multi_block(self, comment="", type_="cmd", code="", comment_size=None, comment_color=None):
        block = CodeBlockWidget(
            run_callback=self.run_individual_block,
            comment=comment,
            type_=type_,
            code=code,
            comment_size=comment_size,
            comment_color=comment_color,
            config=self.config
        )
        self.blocks_layout.addWidget(block)
        return block

    def toggle_mode(self):
        is_file = self.rb_file.isChecked()
        is_inline = self.rb_inline.isChecked()
        is_multi = self.rb_multi.isChecked()
        
        self.target_file_container.setVisible(is_file)
        self.single_block_container.setVisible(is_inline)
        self.multi_block_container.setVisible(is_multi)

    def reset_styles(self):
        # Determine defaults from global config
        is_folder = (self.script.get("type") == "folder")
        parent = self.parent()
        
        # Color defaults from config
        if is_folder:
            def_bg = self.config.get("def_folder_bg", CP_YELLOW)
            def_fg = self.config.get("def_folder_fg", "#000000")
            def_hbg = self.config.get("def_folder_hbg", CP_BG)
            def_hfg = self.config.get("def_folder_hfg", def_bg)
        else:
            def_bg = self.config.get("def_script_bg", "#FFFFFF")
            def_fg = self.config.get("def_script_fg", "#000000")
            def_hbg = self.config.get("def_script_hbg", CP_BG)
            def_hfg = self.config.get("def_script_hfg", def_bg)
        
        # Font defaults
        def_font = "Consolas"
        def_fs = 10
        def_bold = True
        def_italic = False
        if parent and hasattr(parent, "config"):
            def_font = parent.config.get("default_font_family", "Consolas")
            def_fs = parent.config.get("default_font_size", 10)
            def_bold = parent.config.get("default_is_bold", True)
            def_italic = parent.config.get("default_is_italic", False)

        # Reset Typography
        idx = self.cmb_font.findText(def_font, Qt.MatchFlag.MatchExactly)
        if idx >= 0: self.cmb_font.setCurrentIndex(idx)
        self.spn_size.setValue(def_fs)
        self.chk_bold.setChecked(def_bold)
        self.chk_italic.setChecked(def_italic)
        self.cmb_align.setCurrentText("center")
        self.chk_trans_bg.setChecked(False)
        self.chk_trans_hbg.setChecked(False)

        # Reset Colors
        self.script.pop("color", None)
        self.script.pop("transparent_bg", None)
        self.script.pop("hover_transparent_bg", None)
        self.script.pop("text_color", None)
        self.script.pop("hover_color", None)
        self.script.pop("hover_text_color", None)
        self.script.pop("border_color", None)

        self.set_btn_color(self.btn_col_bg, def_bg)
        self.set_btn_color(self.btn_col_fg, def_fg)
        self.set_btn_color(self.btn_col_hbg, def_hbg)
        self.set_btn_color(self.btn_col_hfg, def_hfg)
        self.set_btn_color(self.btn_col_brd, def_bg)

        # Reset Layout/Styling Metrics
        self.spn_cspan.setValue(1)
        self.spn_rspan.setValue(1)
        self.spn_width.setValue(0)
        self.spn_height.setValue(0)
        self.spn_radius.setValue(0)
        self.spn_border.setValue(1 if is_folder else 0)

        if is_folder:
            self.spn_inner_cols.setValue(0)
            self.spn_inner_h.setValue(0)

        # Reset Icon Settings (but preserve icon_path)
        self.spn_icon_w.setValue(0)
        self.spn_icon_h.setValue(0)
        self.spn_icon_gap.setValue(2)
        self.cmb_icon_pos.setCurrentText("top")

    def randomize_colors(self):
        import random
        
        def rand_color():
            return "#{:06x}".format(random.randint(0, 0xFFFFFF))
        
        def contrasting_text(bg_hex):
            # Calculate luminance and return black or white
            bg = bg_hex.lstrip('#')
            r, g, b = int(bg[0:2], 16), int(bg[2:4], 16), int(bg[4:6], 16)
            luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
            return "#000000" if luminance > 0.5 else "#FFFFFF"
        
        # Generate random colors
        bg_color = rand_color()
        text_color = contrasting_text(bg_color)
        hover_bg = rand_color()
        hover_text = contrasting_text(hover_bg)
        border_color = rand_color()
        border_width = random.randint(1, 3)
        
        # Apply to script
        self.script["color"] = bg_color
        self.script["text_color"] = text_color
        self.script["hover_color"] = hover_bg
        self.script["hover_text_color"] = hover_text
        self.script["border_color"] = border_color
        
        # Update UI
        self.set_btn_color(self.btn_col_bg, bg_color)
        self.set_btn_color(self.btn_col_fg, text_color)
        self.set_btn_color(self.btn_col_hbg, hover_bg)
        self.set_btn_color(self.btn_col_hfg, hover_text)
        self.set_btn_color(self.btn_col_brd, border_color)
        self.spn_border.setValue(border_width)

    def create_color_btn(self, label, key):
        # Determine effective default based on key and type, matching CyberButton logic
        is_folder = (self.script.get("type") == "folder")
        
        # Initialize default_val, which will be overridden by specific keys
        default_val = CP_BG 
        
        # 1. Background
        if key == "color":
            default_val = self.config.get("def_folder_bg", CP_YELLOW) if is_folder else self.config.get("def_script_bg", "#FFFFFF")
            
        # 2. Text Color
        elif key == "text_color":
            default_val = self.config.get("def_folder_fg", "#000000") if is_folder else self.config.get("def_script_fg", "#000000")
            
        # 3. Hover Color
        elif key == "hover_color":
            default_val = self.config.get("def_folder_hbg", CP_BG) if is_folder else self.config.get("def_script_hbg", CP_BG)
            
        # 4. Hover Text
        elif key == "hover_text_color":
            default_val = self.config.get("def_folder_hfg", CP_YELLOW) if is_folder else self.config.get("def_script_hfg", "#FFFFFF")
            
        # 5. Border Color
        elif key == "border_color":
            default_val = self.script.get("color", CP_YELLOW if is_folder else "#FFFFFF")

        c = self.script.get(key)
        if not c: c = default_val
        
        btn = QPushButton(label)
        self.set_btn_color(btn, c)
        btn.clicked.connect(lambda: self.pick_color(btn, key))
        return btn

    def set_btn_color(self, btn, color_str):
        lc = QColor(color_str).lightness()
        btn.setStyleSheet(f"background-color: {color_str}; color: {'black' if lc > 128 else 'white'}; border: 1px solid {CP_DIM};")

    def pick_color(self, btn, key):
        curr = self.script.get(key) or "#000000"
        c = QColorDialog.getColor(QColor(curr), self)
        if c.isValid():
            h = c.name()
            self.script[key] = h
            self.set_btn_color(btn, h)

    def pick_batch_bg(self):
        default_color = self.config.get("def_script_bg", "#FFFFFF")
        c = QColorDialog.getColor(QColor(default_color), self)
        if c.isValid():
            self._batch_bg = c.name()
            self.set_btn_color(self.btn_batch_bg, self._batch_bg)
            
    def pick_batch_fg(self):
        default_color = self.config.get("def_script_fg", "#000000")
        c = QColorDialog.getColor(QColor(default_color), self)
        if c.isValid():
            self._batch_fg = c.name()
            self.set_btn_color(self.btn_batch_fg, self._batch_fg)

    def pick_batch_border(self):
        default_color = self.config.get("window_border_color", CP_YELLOW)
        c = QColorDialog.getColor(QColor(default_color), self)
        if c.isValid():
            self._batch_border = c.name()
            self.set_btn_color(self.btn_batch_border, self._batch_border)
            
    def clear_batch_colors(self):
        self._batch_bg = None
        self._batch_fg = None
        self._batch_border = None
        self.btn_batch_bg.setText("Pick BG")
        self.btn_batch_bg.setStyleSheet("")
        self.btn_batch_fg.setText("Pick FG")
        self.btn_batch_fg.setStyleSheet("")
        self.btn_batch_border.setText("Pick Border")
        self.btn_batch_border.setStyleSheet("")

    def browse_path(self):
        f, _ = QFileDialog.getOpenFileName(self, "Select Executable")
        if f: self.inp_path.setText(f)

    def browse_icon(self):
        f, _ = QFileDialog.getOpenFileName(self, "Select Icon", "", "Icon Files (*.ico *.png *.jpg *.svg)")
        if f: self.inp_icon.setText(f)

    def update_svg_preview(self, svg_code):
        if not svg_code or not svg_code.strip():
            self.lbl_svg_preview.clear()
            self.btn_svg.setStyleSheet(f"background-color: {CP_DIM}; color: white;")
            return
            
        try:
            pix = QPixmap(20, 20)
            pix.fill(Qt.GlobalColor.transparent)
            painter = QPainter(pix)
            renderer = QSvgRenderer(QByteArray(svg_code.encode('utf-8')))
            renderer.render(painter)
            painter.end()
            self.lbl_svg_preview.setPixmap(pix)
            self.btn_svg.setStyleSheet(f"background-color: {CP_CYAN}; color: black; font-weight: bold;")
        except:
            self.lbl_svg_preview.setText("ERR")
            self.lbl_svg_preview.setStyleSheet(f"color: {CP_RED}; font-size: 8pt;")

    def open_svg_dialog(self):
        current = self._temp_svg_content if hasattr(self, "_temp_svg_content") else self.script.get("svg_content", "")
        current_map = self.script.get("svg_hover_map", {})
        if not hasattr(self, "_temp_svg_content"):
             self._temp_svg_content = current
             
        dlg = SvgInputDialog(self._temp_svg_content, current_map, self)
        if dlg.exec():
            self._temp_svg_content = dlg.svg_code
            self.script["svg_hover_map"] = dlg.hover_map
            self.update_svg_preview(self._temp_svg_content)

    def save(self):
        self.script["name"] = self.inp_name.text()
        self.script["nf_char"] = self.inp_nf_char.text()
        self.script["icon_path"] = self.inp_icon.text()
        raw_tags = [t.strip().lstrip('#') for t in self.inp_tags.text().split(',') if t.strip()]
        self.script["tags"] = raw_tags
        
        # Save SVG
        if hasattr(self, "_temp_svg_content"):
            self.script["svg_content"] = self._temp_svg_content
        self.script["icon_width"] = self.spn_icon_w.value()
        self.script["icon_height"] = self.spn_icon_h.value()
        self.script["icon_gap"] = self.spn_icon_gap.value()
        self.script["icon_position"] = self.cmb_icon_pos.currentText()
        
        if self.script.get("type") != "folder":
            self.script["path"] = self.inp_path.text()
            self.script["hide_terminal"] = self.chk_hide.isChecked()
            self.script["keep_open"] = self.chk_keep.isChecked()
            self.script["kill_window"] = self.chk_kill.isChecked()
            self.script["new_terminal"] = self.chk_new_term.isChecked()
            self.script["run_admin"] = self.chk_admin.isChecked()
            self.script["ctrl_left_cmd"] = self.inp_ctrl_left.text()
            self.script["ctrl_right_cmd"] = self.inp_ctrl_right.text()
            self.script["use_inline"] = self.rb_inline.isChecked()
            self.script["use_multi_block"] = self.rb_multi.isChecked()
            self.script["inline_type"] = self.cmb_type.currentText()
            self.script["inline_script"] = self.txt_inline.toPlainText()
            blocks_data = []
            for i in range(self.blocks_layout.count()):
                item = self.blocks_layout.itemAt(i)
                if item:
                    w = item.widget()
                    if isinstance(w, CodeBlockWidget):
                        blocks_data.append({
                            "comment": w.comment_input.text(),
                            "type": w.type_cmb.currentText(),
                            "code": w.txt_edit.toPlainText(),
                            "comment_size": w.comment_size_spn.value(),
                            "comment_color": w.comment_color
                        })
            self.script["inline_blocks"] = blocks_data
        
        self.script["edit_on_click"] = self.chk_edit_on_click.isChecked()
        self.script["require_password"] = self.chk_pass_lock.isChecked()
        self.script["font_family"] = self.cmb_font.currentText()
        self.script["font_size"] = self.spn_size.value()
        self.script["is_bold"] = self.chk_bold.isChecked()
        self.script["is_italic"] = self.chk_italic.isChecked()
        self.script["text_align"] = self.cmb_align.currentText()
        self.script["transparent_bg"] = self.chk_trans_bg.isChecked()
        self.script["hover_transparent_bg"] = self.chk_trans_hbg.isChecked()
        self.script["col_span"] = self.spn_cspan.value()
        self.script["row_span"] = self.spn_rspan.value()
        self.script["width"] = self.spn_width.value()
        self.script["height"] = self.spn_height.value()
        self.script["corner_radius"] = self.spn_radius.value()
        self.script["border_width"] = self.spn_border.value()
        
        if self.script.get("type") == "folder":
            self.script["grid_columns"] = self.spn_inner_cols.value()
            self.script["grid_btn_height"] = self.spn_inner_h.value()
            
            batch_fs = self.spn_batch_font_size.value()
            if batch_fs > 0:
                def apply_font_size_recursive(items, fs):
                    for item in items:
                        item["font_size"] = fs
                        if item.get("type") == "folder" and "scripts" in item:
                            apply_font_size_recursive(item["scripts"], fs)
                apply_font_size_recursive(self.script.get("scripts", []), batch_fs)

            batch_bw = self.spn_batch_border_width.value()
            if batch_bw >= 0:
                def apply_border_width_recursive(items, bw):
                    for item in items:
                        item["border_width"] = bw
                        if item.get("type") == "folder" and "scripts" in item:
                            apply_border_width_recursive(item["scripts"], bw)
                apply_border_width_recursive(self.script.get("scripts", []), batch_bw)

            batch_align = self.cmb_batch_align.currentText()
            if batch_align:
                def apply_align_recursive(items, alignment):
                    for item in items:
                        item["text_align"] = alignment
                        if item.get("type") == "folder" and "scripts" in item:
                            apply_align_recursive(item["scripts"], alignment)
                
                apply_align_recursive(self.script.get("scripts", []), batch_align)

            if self._batch_bg or self._batch_fg or self._batch_border:
                def apply_colors_recursive(items, bg, fg, border):
                    for item in items:
                        if bg:
                            item["color"] = bg
                        if fg:
                            item["text_color"] = fg
                        if border:
                            item["border_color"] = border
                        if item.get("type") == "folder" and "scripts" in item:
                            apply_colors_recursive(item["scripts"], bg, fg, border)
                
                apply_colors_recursive(self.script.get("scripts", []), self._batch_bg, self._batch_fg, self._batch_border)

            if self.chk_batch_trans.isChecked():
                def apply_trans_recursive(items):
                    for item in items:
                        item["transparent_bg"] = True
                        if item.get("type") == "folder" and "scripts" in item:
                            apply_trans_recursive(item["scripts"])
                apply_trans_recursive(self.script.get("scripts", []))

            if self.chk_batch_trans_hbg.isChecked():
                def apply_trans_hbg_recursive(items):
                    for item in items:
                        item["hover_transparent_bg"] = True
                        if item.get("type") == "folder" and "scripts" in item:
                            apply_trans_hbg_recursive(item["scripts"])
                apply_trans_hbg_recursive(self.script.get("scripts", []))
        
        self.accept()

# -----------------------------------------------------------------------------
# MAIN WINDOW
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# SETTINGS DIALOG
# -----------------------------------------------------------------------------
class SettingsDialog(QDialog):
    def __init__(self, config, parent=None):
        super().__init__(parent)
        self.config = config
        self.setWindowTitle("GLOBAL CONFIG")
        self.resize(1100, 850)
        self.app_bg = self.config.get("app_bg", CP_BG)
        self.win_border = self.config.get("window_border_color", CP_YELLOW)
        self.cfg_color = self.config.get("cfg_btn_color", CP_DIM)
        self.cfg_text_color = self.config.get("cfg_text_color", "white")
        
        # Item Style Defaults
        self.def_script_bg = self.config.get("def_script_bg", "#FFFFFF")
        self.def_script_fg = self.config.get("def_script_fg", "#000000")
        self.def_script_hbg = self.config.get("def_script_hbg", CP_BG)
        self.def_script_hfg = self.config.get("def_script_hfg", self.def_script_bg)

        self.def_folder_bg = self.config.get("def_folder_bg", CP_YELLOW)
        self.def_folder_fg = self.config.get("def_folder_fg", "#000000")
        self.def_folder_hbg = self.config.get("def_folder_hbg", CP_BG)
        self.def_folder_hfg = self.config.get("def_folder_hfg", self.def_folder_bg)
        
        self.setStyleSheet(f"""
            QDialog {{ background-color: {self.app_bg}; border: 2px solid {self.win_border}; }}
            QLabel {{ color: {CP_TEXT}; font-family: 'Consolas'; font-weight: bold; }}
            QLineEdit, QSpinBox {{ background: {CP_PANEL}; color: {CP_CYAN}; border: 1px solid {CP_DIM}; padding: 5px; }}
            QSpinBox::up-button, QSpinBox::down-button {{ width: 0px; border: none; }}
            QCheckBox {{ color: {CP_TEXT}; font-family: 'Consolas'; spacing: 8px; }}
            QCheckBox::indicator {{ width: 14px; height: 14px; border: 1px solid {CP_DIM}; background: {CP_PANEL}; }}
            QCheckBox::indicator:checked {{ background: {CP_YELLOW}; border-color: {CP_YELLOW}; }}
            QPushButton {{ background: {CP_DIM}; color: white; border: none; padding: 8px; font-weight: bold; }}
            QPushButton:hover {{ background: {CP_DIM}44; border: 1px solid {self.win_border}; }}
        """)
        self.setup_ui()

    def setup_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setSpacing(15)
        main_layout.setContentsMargins(30, 30, 30, 30)

        panels_layout = QHBoxLayout()
        panels_layout.setSpacing(25)

        left_widget = QWidget()
        layout = QVBoxLayout(left_widget)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(15)
        
        # 1. Grid Settings
        grp_grid = QGroupBox("GRID")
        grp_grid.setStyleSheet(f"QGroupBox {{ border: 1px solid {CP_DIM}; margin-top: 10px; padding-top: 10px; color: {CP_YELLOW}; font-weight: bold; }}")
        l_grid = QFormLayout()
        
        self.spn_cols = QSpinBox()
        self.spn_cols.setRange(1, 20)
        self.spn_cols.setValue(self.config.get("columns", 5))
        l_grid.addRow("Columns:", self.spn_cols)

        self.spn_search_cols = QSpinBox()
        self.spn_search_cols.setRange(1, 20)
        self.spn_search_cols.setValue(self.config.get("search_columns", 5))
        l_grid.addRow("Search Columns:", self.spn_search_cols)
        
        self.spn_btn_h = QSpinBox()
        self.spn_btn_h.setRange(20, 9999)
        self.spn_btn_h.setValue(self.config.get("default_btn_height", 40))
        l_grid.addRow("Btn Height:", self.spn_btn_h)

        # Font settings
        self.cmb_font = QComboBox()
        all_fonts = sorted(QFontDatabase.families())
        self.cmb_font.addItems(all_fonts)
        current_font = self.config.get("default_font_family", "Consolas")
        idx = self.cmb_font.findText(current_font, Qt.MatchFlag.MatchExactly)
        if idx >= 0: self.cmb_font.setCurrentIndex(idx)
        
        l_grid.addRow("Font:", self.cmb_font)

        self.spn_font_size = QSpinBox()
        self.spn_font_size.setRange(6, 40)
        self.spn_font_size.setValue(self.config.get("default_font_size", 10))
        l_grid.addRow("Font Size:", self.spn_font_size)

        font_style_box = QHBoxLayout()
        self.chk_bold = QCheckBox("Bold")
        self.chk_bold.setChecked(self.config.get("default_is_bold", True))
        self.chk_italic = QCheckBox("Italic")
        self.chk_italic.setChecked(self.config.get("default_is_italic", False))
        font_style_box.addWidget(self.chk_bold)
        font_style_box.addWidget(self.chk_italic)
        font_style_box.addStretch()
        l_grid.addRow("Style:", font_style_box)

        grp_grid.setLayout(l_grid)
        layout.addWidget(grp_grid)

        # 2. Appearance Settings
        grp_app = QGroupBox("APPEARANCE")
        grp_app.setStyleSheet(f"QGroupBox {{ border: 1px solid {CP_DIM}; margin-top: 10px; padding-top: 10px; color: {CP_YELLOW}; font-weight: bold; }}")
        l_app = QFormLayout()

        self.btn_app_bg = QPushButton("Pick Background Color")
        self.update_color_btn_style(self.btn_app_bg, self.app_bg)
        self.btn_app_bg.clicked.connect(self.pick_app_bg)
        l_app.addRow("Main BG:", self.btn_app_bg)

        self.btn_win_border = QPushButton("Pick Border Color")
        self.update_color_btn_style(self.btn_win_border, self.win_border)
        self.btn_win_border.clicked.connect(self.pick_win_border)
        l_app.addRow("Win Border:", self.btn_win_border)

        cfg_box = QHBoxLayout()
        self.btn_cfg_col = QPushButton("BG")
        self.update_color_btn_style(self.btn_cfg_col, self.cfg_color)
        self.btn_cfg_col.clicked.connect(self.pick_cfg_color)
        
        self.btn_cfg_txt = QPushButton("FG")
        self.update_color_btn_style(self.btn_cfg_txt, self.cfg_text_color)
        self.btn_cfg_txt.clicked.connect(self.pick_cfg_text_color)
        
        cfg_box.addWidget(self.btn_cfg_col)
        cfg_box.addWidget(self.btn_cfg_txt)
        l_app.addRow("CFG Button:", cfg_box)

        self.chk_show_tags = QCheckBox("Show Tag Filter Bar")
        self.chk_show_tags.setChecked(self.config.get("show_tags", True))
        l_app.addRow("Tags:", self.chk_show_tags)

        grp_app.setLayout(l_app)
        layout.addWidget(grp_app)

        # 3. Window Settings
        grp_win = QGroupBox("WINDOW")
        grp_win.setStyleSheet(f"QGroupBox {{ border: 1px solid {CP_DIM}; margin-top: 10px; padding-top: 10px; color: {CP_YELLOW}; font-weight: bold; }}")
        l_win = QFormLayout()
        
        size_box = QHBoxLayout()
        lbl_main = QLabel("Main:")
        lbl_main.setFixedWidth(35)
        size_box.addWidget(lbl_main)
        size_box.addWidget(QLabel("W:"))
        self.spn_w = QSpinBox(); self.spn_w.setRange(400, 3000); self.spn_w.setValue(self.config.get("window_width", 1100))
        size_box.addWidget(self.spn_w)
        size_box.addSpacing(10)
        size_box.addWidget(QLabel("H:"))
        self.spn_h = QSpinBox(); self.spn_h.setRange(300, 2000); self.spn_h.setValue(self.config.get("window_height", 800))
        size_box.addWidget(self.spn_h)
        size_box.addStretch()
        l_win.addRow(size_box)
        
        edit_size_box = QHBoxLayout()
        lbl_edit = QLabel("Edit:")
        lbl_edit.setFixedWidth(35)
        edit_size_box.addWidget(lbl_edit)
        edit_size_box.addWidget(QLabel("W:"))
        self.spn_edit_w = QSpinBox(); self.spn_edit_w.setRange(400, 3000); self.spn_edit_w.setValue(self.config.get("edit_panel_width", 1150))
        edit_size_box.addWidget(self.spn_edit_w)
        edit_size_box.addSpacing(10)
        edit_size_box.addWidget(QLabel("H:"))
        self.spn_edit_h = QSpinBox(); self.spn_edit_h.setRange(300, 2000); self.spn_edit_h.setValue(self.config.get("edit_panel_height", 750))
        edit_size_box.addWidget(self.spn_edit_h)
        edit_size_box.addStretch()
        l_win.addRow(edit_size_box)
        
        self.chk_top = QCheckBox("Always On Top")
        self.chk_top.setChecked(self.config.get("always_on_top", False))
        l_win.addRow("", self.chk_top)
        
        grp_win.setLayout(l_win)
        layout.addWidget(grp_win)

        # 4. Item Style Defaults
        grp_items = QGroupBox("ITEM DEFAULTS")
        grp_items.setStyleSheet(f"QGroupBox {{ border: 1px solid {CP_DIM}; margin-top: 10px; padding-top: 10px; color: {CP_YELLOW}; font-weight: bold; }}")
        l_items = QGridLayout()

        # Labels
        # l_items.addWidget(QLabel("CATEGORY"), 0, 0)
        l_items.addWidget(QLabel("BG"), 0, 1)
        l_items.addWidget(QLabel("FG"), 0, 2)
        l_items.addWidget(QLabel("H-BG"), 0, 3)
        l_items.addWidget(QLabel("H-FG"), 0, 4)

        # Scripts
        l_items.addWidget(QLabel("SCRIPT:"), 1, 0)
        self.btn_sbg = QPushButton(""); self.update_color_btn_style(self.btn_sbg, self.def_script_bg)
        self.btn_sbg.clicked.connect(lambda: self.pick_config_color("def_script_bg", self.btn_sbg))
        l_items.addWidget(self.btn_sbg, 1, 1)

        self.btn_sfg = QPushButton(""); self.update_color_btn_style(self.btn_sfg, self.def_script_fg)
        self.btn_sfg.clicked.connect(lambda: self.pick_config_color("def_script_fg", self.btn_sfg))
        l_items.addWidget(self.btn_sfg, 1, 2)

        self.btn_shbg = QPushButton(""); self.update_color_btn_style(self.btn_shbg, self.def_script_hbg)
        self.btn_shbg.clicked.connect(lambda: self.pick_config_color("def_script_hbg", self.btn_shbg))
        l_items.addWidget(self.btn_shbg, 1, 3)

        self.btn_shfg = QPushButton(""); self.update_color_btn_style(self.btn_shfg, self.def_script_hfg)
        self.btn_shfg.clicked.connect(lambda: self.pick_config_color("def_script_hfg", self.btn_shfg))
        l_items.addWidget(self.btn_shfg, 1, 4)

        # Folders
        l_items.addWidget(QLabel("FOLDER:"), 2, 0)
        self.btn_fbg = QPushButton(""); self.update_color_btn_style(self.btn_fbg, self.def_folder_bg)
        self.btn_fbg.clicked.connect(lambda: self.pick_config_color("def_folder_bg", self.btn_fbg))
        l_items.addWidget(self.btn_fbg, 2, 1)

        self.btn_ffg = QPushButton(""); self.update_color_btn_style(self.btn_ffg, self.def_folder_fg)
        self.btn_ffg.clicked.connect(lambda: self.pick_config_color("def_folder_fg", self.btn_ffg))
        l_items.addWidget(self.btn_ffg, 2, 2)

        self.btn_fhbg = QPushButton(""); self.update_color_btn_style(self.btn_fhbg, self.def_folder_hbg)
        self.btn_fhbg.clicked.connect(lambda: self.pick_config_color("def_folder_hbg", self.btn_fhbg))
        l_items.addWidget(self.btn_fhbg, 2, 3)

        self.btn_fhfg = QPushButton(""); self.update_color_btn_style(self.btn_fhfg, self.def_folder_hfg)
        self.btn_fhfg.clicked.connect(lambda: self.pick_config_color("def_folder_hfg", self.btn_fhfg))
        l_items.addWidget(self.btn_fhfg, 2, 4)

        grp_items.setLayout(l_items)
        layout.addWidget(grp_items)

        # Create Right Panel for SEARCH CUSTOMIZATION
        right_widget = QWidget()
        right_panel = QVBoxLayout(right_widget)
        right_panel.setContentsMargins(0, 0, 0, 0)
        right_panel.setSpacing(15)

        grp_search_custom = QGroupBox("SEARCH MODE LAYOUT")
        grp_search_custom.setStyleSheet(f"QGroupBox {{ border: 1px solid {CP_DIM}; margin-top: 10px; padding-top: 10px; color: {CP_YELLOW}; font-weight: bold; }}")
        l_search_custom = QFormLayout()

        # Visual box properties
        self.spn_search_box_w = QSpinBox()
        self.spn_search_box_w.setRange(20, 1000)
        self.spn_search_box_w.setValue(self.config.get("search_box_width", 150))
        l_search_custom.addRow("Box Width:", self.spn_search_box_w)

        self.spn_search_box_h = QSpinBox()
        self.spn_search_box_h.setRange(20, 1000)
        self.spn_search_box_h.setValue(self.config.get("search_box_height", 150))
        l_search_custom.addRow("Box Height:", self.spn_search_box_h)

        self.spn_search_box_icon_s = QSpinBox()
        self.spn_search_box_icon_s.setRange(8, 256)
        self.spn_search_box_icon_s.setValue(self.config.get("search_box_icon_size", 48))
        l_search_custom.addRow("Box Icon Size:", self.spn_search_box_icon_s)

        self.spn_search_box_cols = QSpinBox()
        self.spn_search_box_cols.setRange(1, 20)
        self.spn_search_box_cols.setValue(self.config.get("search_box_columns", 5))
        l_search_custom.addRow("Box Columns:", self.spn_search_box_cols)

        # List items properties
        self.spn_search_list_w = QSpinBox()
        self.spn_search_list_w.setRange(20, 2000)
        self.spn_search_list_w.setValue(self.config.get("search_list_width", 250))
        l_search_custom.addRow("List Item Width:", self.spn_search_list_w)

        self.spn_search_list_h = QSpinBox()
        self.spn_search_list_h.setRange(10, 500)
        self.spn_search_list_h.setValue(self.config.get("search_list_height", 40))
        l_search_custom.addRow("List Item Height:", self.spn_search_list_h)

        self.spn_search_list_cols = QSpinBox()
        self.spn_search_list_cols.setRange(1, 20)
        self.spn_search_list_cols.setValue(self.config.get("search_list_columns", 3))
        l_search_custom.addRow("List Columns:", self.spn_search_list_cols)

        self.chk_search_left_align = QCheckBox("Left Align Text during search")
        self.chk_search_left_align.setChecked(self.config.get("search_left_align", False))
        l_search_custom.addRow("Text Alignment:", self.chk_search_left_align)

        grp_search_custom.setLayout(l_search_custom)
        right_panel.addWidget(grp_search_custom)

        # Multi-block comment defaults
        grp_mb = QGroupBox("MULTI-BLOCK DEFAULTS")
        grp_mb.setStyleSheet(f"QGroupBox {{ border: 1px solid {CP_DIM}; margin-top: 10px; padding-top: 10px; color: {CP_YELLOW}; font-weight: bold; }}")
        l_mb = QFormLayout()

        self.spn_mb_size = QSpinBox()
        self.spn_mb_size.setRange(6, 40)
        self.spn_mb_size.setValue(self.config.get("multiblock_comment_size", 10))
        l_mb.addRow("Comment Font Size:", self.spn_mb_size)

        self.btn_mb_color = QPushButton("Pick Comment Color")
        self.mb_color = self.config.get("multiblock_comment_color", CP_YELLOW)
        self.update_color_btn_style(self.btn_mb_color, self.mb_color)
        self.btn_mb_color.clicked.connect(self.pick_mb_color)
        l_mb.addRow("Comment Color:", self.btn_mb_color)

        grp_mb.setLayout(l_mb)
        right_panel.addWidget(grp_mb)

        right_panel.addStretch()

        panels_layout.addWidget(left_widget, stretch=1)
        panels_layout.addWidget(right_widget, stretch=1)
        main_layout.addLayout(panels_layout)

        # Save in main_layout
        btn_save = QPushButton("SAVE CONFIG")
        btn_save.setStyleSheet(f"background-color: {CP_GREEN}; color: black;")
        btn_save.clicked.connect(self.save)
        main_layout.addWidget(btn_save)

    def update_color_btn_style(self, btn, color):
        lc = QColor(color).lightness()
        btn.setStyleSheet(f"background-color: {color}; color: {'black' if lc > 128 else 'white'}; border: 1px solid {CP_DIM}; padding: 5px;")

    def pick_app_bg(self):
        c = QColorDialog.getColor(QColor(self.app_bg), self)
        if c.isValid():
            self.app_bg = c.name()
            self.update_color_btn_style(self.btn_app_bg, self.app_bg)
            self.update_dialog_style()

    def pick_win_border(self):
        c = QColorDialog.getColor(QColor(self.win_border), self)
        if c.isValid():
            self.win_border = c.name()
            self.update_color_btn_style(self.btn_win_border, self.win_border)
            self.update_dialog_style()

    def pick_cfg_color(self):
        c = QColorDialog.getColor(QColor(self.cfg_color), self)
        if c.isValid():
            self.cfg_color = c.name()
            self.update_color_btn_style(self.btn_cfg_col, self.cfg_color)

    def pick_cfg_text_color(self):
        c = QColorDialog.getColor(QColor(self.cfg_text_color), self)
        if c.isValid():
            self.cfg_text_color = c.name()
            self.update_color_btn_style(self.btn_cfg_txt, self.cfg_text_color)

    def pick_mb_color(self):
        c = QColorDialog.getColor(QColor(self.mb_color), self)
        if c.isValid():
            self.mb_color = c.name().upper()
            self.update_color_btn_style(self.btn_mb_color, self.mb_color)

    def pick_config_color(self, attr_name, btn):
        current_color = getattr(self, attr_name)
        c = QColorDialog.getColor(QColor(current_color), self)
        if c.isValid():
            setattr(self, attr_name, c.name())
            self.update_color_btn_style(btn, c.name())

    def update_dialog_style(self):
        self.setStyleSheet(f"""
            QDialog {{ background-color: {self.app_bg}; border: 2px solid {self.win_border}; }}
            QLabel {{ color: {CP_TEXT}; font-family: 'Consolas'; font-weight: bold; }}
            QLineEdit, QSpinBox {{ background: {CP_PANEL}; color: {CP_CYAN}; border: 1px solid {CP_DIM}; padding: 5px; }}
            QSpinBox::up-button, QSpinBox::down-button {{ width: 0px; border: none; }}
            QCheckBox {{ color: {CP_TEXT}; font-family: 'Consolas'; spacing: 8px; }}
            QCheckBox::indicator {{ width: 14px; height: 14px; border: 1px solid {CP_DIM}; background: {CP_PANEL}; }}
            QCheckBox::indicator:checked {{ background: {CP_YELLOW}; border-color: {CP_YELLOW}; }}
            QPushButton {{ background: {CP_DIM}; color: white; border: none; padding: 8px; font-weight: bold; }}
            QPushButton:hover {{ background: {CP_DIM}44; border: 1px solid {self.win_border}; }}
        """)

    def save(self):
        self.config["columns"] = self.spn_cols.value()
        self.config["search_columns"] = self.spn_search_cols.value()
        
        # Search Custom Layout Variables
        self.config["search_box_width"] = self.spn_search_box_w.value()
        self.config["search_box_height"] = self.spn_search_box_h.value()
        self.config["search_box_icon_size"] = self.spn_search_box_icon_s.value()
        self.config["search_box_columns"] = self.spn_search_box_cols.value()
        self.config["search_list_width"] = self.spn_search_list_w.value()
        self.config["search_list_height"] = self.spn_search_list_h.value()
        self.config["search_list_columns"] = self.spn_search_list_cols.value()
        self.config["search_left_align"] = self.chk_search_left_align.isChecked()

        self.config["default_btn_height"] = self.spn_btn_h.value()
        self.config["default_font_family"] = self.cmb_font.currentText()
        self.config["default_font_size"] = self.spn_font_size.value()
        self.config["default_is_bold"] = self.chk_bold.isChecked()
        self.config["default_is_italic"] = self.chk_italic.isChecked()
        self.config["app_bg"] = self.app_bg
        self.config["window_border_color"] = self.win_border
        self.config["cfg_btn_color"] = self.cfg_color
        self.config["cfg_text_color"] = self.cfg_text_color
        self.config["window_width"] = self.spn_w.value()
        self.config["window_height"] = self.spn_h.value()
        self.config["edit_panel_width"] = self.spn_edit_w.value()
        self.config["edit_panel_height"] = self.spn_edit_h.value()
        self.config["always_on_top"] = self.chk_top.isChecked()
        self.config["show_tags"] = self.chk_show_tags.isChecked()
        
        # Item Style Defaults
        self.config["def_script_bg"] = self.def_script_bg
        self.config["def_script_fg"] = self.def_script_fg
        self.config["def_script_hbg"] = self.def_script_hbg
        self.config["def_script_hfg"] = self.def_script_hfg

        self.config["def_folder_bg"] = self.def_folder_bg
        self.config["def_folder_fg"] = self.def_folder_fg
        self.config["def_folder_hbg"] = self.def_folder_hbg
        self.config["def_folder_hfg"] = self.def_folder_hfg

        # Multi-block Defaults
        self.config["multiblock_comment_size"] = self.spn_mb_size.value()
        self.config["multiblock_comment_color"] = self.mb_color
        
        self.accept()

# -----------------------------------------------------------------------------
# MAIN WINDOW
# -----------------------------------------------------------------------------

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("SCRIPT // MANAGER_V3.2")
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        
        self.config = {}
        self.view_stack = [] 
        self.active_tag_filter = None
        self.drag_pos = QPoint()
        
        self.load_config()
        self.setup_icon()
        
        # Clipboard for Cut/Paste
        self.clipboard_item = None
        self.clipboard_source_list = None

        # Apply global settings
        app_bg = self.config.get("app_bg", CP_BG)
        self.setStyleSheet(f"QMainWindow {{ background-color: {app_bg}; }}")
        
        # Apply window settings
        w = self.config.get("window_width", 1100)
        h = self.config.get("window_height", 800)
        self.resize(w, h)
        if self.config.get("always_on_top", False):
            self.setWindowFlag(Qt.WindowType.WindowStaysOnTopHint)
        
        self.setup_ui()
        self.refresh_grid()

    def setup_icon(self):
        # We use a shared utility to ensure the icon is set from a file source
        # Windows taskbar is much more reliable when loading from a disk-based asset
        icon_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app_icon_v3.png")
        
        if not os.path.exists(icon_path):
            # Generate the icon file if it doesn't exist
            pixmap = QPixmap(256, 256)
            pixmap.fill(Qt.GlobalColor.transparent)
            painter = QPainter(pixmap)
            painter.setRenderHint(QPainter.RenderHint.Antialiasing)
            
            # Draw Background Square with Rounded Corners
            painter.setBrush(QBrush(QColor(CP_BG)))
            painter.setPen(QColor(CP_CYAN)) # Cyan border
            painter.drawRoundedRect(10, 10, 236, 236, 40, 40)
            
            # Draw </> text
            painter.setPen(QColor(CP_YELLOW))
            font = QFont("Consolas", 120, QFont.Weight.Bold)
            painter.setFont(font)
            painter.drawText(pixmap.rect(), Qt.AlignmentFlag.AlignCenter, "</>")
            painter.end()
            pixmap.save(icon_path)

        icon = QIcon(icon_path)
        self.setWindowIcon(icon)
        QApplication.instance().setWindowIcon(icon)
        
        # Delayed re-apply to handle cases where Windows taskbar is slow to update
        QTimer.singleShot(100, lambda: self.setWindowIcon(icon))
        QTimer.singleShot(500, lambda: self.setWindowIcon(icon))

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.drag_pos = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            event.accept()

    def mouseMoveEvent(self, event):
        if event.buttons() == Qt.MouseButton.LeftButton:
            self.move(event.globalPosition().toPoint() - self.drag_pos)
            event.accept()

    def _fix_floats(self, obj):
        """Recursively convert float values that should be ints (whole numbers)."""
        if isinstance(obj, dict):
            return {k: self._fix_floats(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [self._fix_floats(i) for i in obj]
        if isinstance(obj, float) and obj.is_integer():
            return int(obj)
        return obj

    def load_config(self):
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r", encoding='utf-8') as f:
                    self.config = self._fix_floats(json.load(f))
            except: self.config = {"scripts": []}
        else: self.config = {"scripts": []}
            
    def save_config(self):
        try:
            os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
            with open(CONFIG_FILE, "w", encoding='utf-8') as f:
                json.dump(self.config, f, indent=4)
            self.refresh_grid()
            
            # Apply immediate global effects
            app_bg = self.config.get("app_bg", CP_BG)
            win_border = self.config.get("window_border_color", CP_YELLOW)
            self.setStyleSheet(f"QMainWindow {{ background-color: {app_bg}; }}")
            if hasattr(self, 'main_frame'):
                self.main_frame.setStyleSheet(f"#MainFrame {{ border: 2px solid {win_border}; background-color: {app_bg}; }}")

            if hasattr(self, 'btn_cfg'):
                cfg_col = self.config.get("cfg_btn_color", CP_DIM)
                self.btn_cfg.script["color"] = cfg_col
                lc = QColor(cfg_col).lightness() if QColor(cfg_col).isValid() else 0
                cfg_stroke = "#000000" if lc > 128 else "#FFFFFF"
                SVG_CFG = f'<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="{cfg_stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.4 15A1.65 1.65 0 0 0 20 12A1.65 1.65 0 0 0 19.4 9L21 7.4L19 4.6L16.8 5.6A1.65 1.65 0 0 0 14.4 4.1L14 1.8H10L9.6 4.1A1.65 1.65 0 0 0 7.2 5.6L5 4.6L3 7.4L4.6 9A1.65 1.65 0 0 0 4 12A1.65 1.65 0 0 0 4.6 15L3 16.6L5 19.4L7.2 18.4A1.65 1.65 0 0 0 16.8 18.4L19 19.4L21 16.6L19.4 15Z" stroke="{cfg_stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
                self.btn_cfg.script["svg_content"] = SVG_CFG
                self.btn_cfg.update_style()

            if self.config.get("always_on_top", False):
                self.setWindowFlag(Qt.WindowType.WindowStaysOnTopHint, True)
            else:
                self.setWindowFlag(Qt.WindowType.WindowStaysOnTopHint, False)

            self.show()
            
        except Exception as e:
            print(f"Error saving config: {e}")

    def setup_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        clayout = QVBoxLayout(central)
        clayout.setContentsMargins(0, 0, 0, 0)

        # MAIN FRAME (for border)
        self.main_frame = QFrame()
        self.main_frame.setObjectName("MainFrame")
        app_bg = self.config.get("app_bg", CP_BG)
        win_border = self.config.get("window_border_color", CP_YELLOW)
        self.main_frame.setStyleSheet(f"#MainFrame {{ border: 2px solid {win_border}; background-color: {app_bg}; }}")
        
        self.main_layout = QVBoxLayout(self.main_frame)
        self.main_layout.setContentsMargins(20, 15, 20, 20)
        self.main_layout.setSpacing(10)
        clayout.addWidget(self.main_frame)

        header = QHBoxLayout()
        header.setSpacing(10)
        self.breadcrumb_layout = QHBoxLayout()
        self.breadcrumb_layout.setSpacing(0)
        
        header.addLayout(self.breadcrumb_layout)
        header.addStretch()
        
        # ADD BUTTONS - Script and Folder
        SVG_ADD_SCRIPT = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2V8H20" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 11V17" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 14H15" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        SVG_ADD_FOLDER = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 19V9C22 7.89543 21.1046 7 20 7H12L10 5H4C2.89543 5 2 5.89543 2 7V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19Z" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 11V17" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 14H15" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'

        cfg_col = self.config.get("cfg_btn_color", CP_DIM)
        cfg_txt = self.config.get("cfg_text_color", "white")
        lc = QColor(cfg_col).lightness() if QColor(cfg_col).isValid() else 0
        cfg_stroke = "#000000" if lc > 128 else "#FFFFFF"
        
        SVG_CFG = f'<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="{cfg_stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.4 15A1.65 1.65 0 0 0 20 12A1.65 1.65 0 0 0 19.4 9L21 7.4L19 4.6L16.8 5.6A1.65 1.65 0 0 0 14.4 4.1L14 1.8H10L9.6 4.1A1.65 1.65 0 0 0 7.2 5.6L5 4.6L3 7.4L4.6 9A1.65 1.65 0 0 0 4 12A1.65 1.65 0 0 0 4.6 15L3 16.6L5 19.4L7.2 18.4A1.65 1.65 0 0 0 9.6 19.9L10 22.2H14L14.4 19.9A1.65 1.65 0 0 0 16.8 18.4L19 19.4L21 16.6L19.4 15Z" stroke="{cfg_stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        SVG_CLOSE = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 7L7 17M7 7L17 17" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'

        self.btn_add_script = CyberButton("", script_data={"color": CP_GREEN, "type": "script", "text_color": "black", "svg_content": SVG_ADD_SCRIPT, "icon_width": 22, "icon_height": 22, "icon_position": "center"}, config=self.config)
        self.btn_add_script.setFixedSize(45, 35)
        self.btn_add_script.setToolTip("Add New Script (+S)")
        self.btn_add_script.clicked.connect(self.add_new_item)
        
        self.btn_add_folder = CyberButton("", script_data={"color": CP_YELLOW, "type": "script", "text_color": "black", "svg_content": SVG_ADD_FOLDER, "icon_width": 22, "icon_height": 22, "icon_position": "center"}, config=self.config)
        self.btn_add_folder.setFixedSize(45, 35)
        self.btn_add_folder.setToolTip("Add New Folder (+F)")
        self.btn_add_folder.clicked.connect(self.add_new_folder)
        
        # Search Box
        self.inp_search = QLineEdit()
        self.inp_search.setPlaceholderText("SEARCH...")
        self.inp_search.setFixedWidth(200)
        self.inp_search.setStyleSheet(f"""
            QLineEdit {{ 
                background-color: {CP_PANEL}; 
                color: {CP_CYAN}; 
                border: 1px solid {CP_DIM}; 
                padding: 5px; 
                font-family: 'Consolas';
                font-size: 11pt;
            }}
            QLineEdit:focus {{ border: 1px solid {CP_CYAN}; }}
        """)
        self.inp_search.textChanged.connect(self.handle_search)

        self.btn_cfg = CyberButton("", script_data={"color": cfg_col, "type": "script", "text_color": cfg_txt, "svg_content": SVG_CFG, "icon_width": 22, "icon_height": 22, "icon_position": "center"}, config=self.config)
        self.btn_cfg.setFixedSize(45, 35)
        self.btn_cfg.setToolTip("Global Configuration")
        self.btn_cfg.clicked.connect(self.open_global_settings)

        self.btn_close = CyberButton("", script_data={
            "color": "#d30f36",
            "hover_color": "#ff003c",
            "border_width": 1,
            "border_color": "#ff2a55",
            "corner_radius": 2,
            "type": "script",
            "text_color": "white",
            "svg_content": SVG_CLOSE,
            "icon_width": 18,
            "icon_height": 18,
            "icon_position": "center"
        }, config=self.config)
        self.btn_close.setFixedSize(45, 35)
        self.btn_close.setToolTip("Close Launcher")
        self.btn_close.clicked.connect(self.close)

        header.addWidget(self.inp_search) # Add search here
        header.addWidget(self.btn_add_script)
        header.addWidget(self.btn_add_folder)
        header.addWidget(self.btn_cfg)
        header.addWidget(self.btn_close)
        
        self.main_layout.addLayout(header)

        # Tag Filter Bar
        self.tag_bar_scroll = QScrollArea()
        self.tag_bar_scroll.setWidgetResizable(True)
        self.tag_bar_scroll.setFixedHeight(35)
        self.tag_bar_scroll.setStyleSheet("background: transparent; border: none;")
        self.tag_bar_scroll.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.tag_bar_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        
        self.tag_bar_widget = QWidget()
        self.tag_bar_layout = QHBoxLayout(self.tag_bar_widget)
        self.tag_bar_layout.setContentsMargins(0, 0, 0, 0)
        self.tag_bar_layout.setSpacing(6)
        self.tag_bar_layout.setAlignment(Qt.AlignmentFlag.AlignLeft)
        
        self.tag_bar_scroll.setWidget(self.tag_bar_widget)
        self.main_layout.addWidget(self.tag_bar_scroll)

        # Grid
        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.scroll.setStyleSheet(f"background: transparent; border: none;")
        self.scroll.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        
        self.grid_container = QWidget()
        self.grid_container.setAcceptDrops(True)
        self.grid_container.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.grid_container.customContextMenuRequested.connect(self.show_grid_context_menu)
        
        # Event filters for drag/drop on container
        self.grid_container.dragEnterEvent = self.gridDragEnterEvent
        self.grid_container.dropEvent = self.gridDropEvent
        
        self.grid = QGridLayout(self.grid_container)
        self.grid.setSpacing(10)
        self.grid.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft)
        
        self.scroll.setWidget(self.grid_container)
        self.main_layout.addWidget(self.scroll)

    def show_grid_context_menu(self, pos):
        menu = QMenu(self)
        menu.setStyleSheet(f"QMenu {{ background-color: {CP_PANEL}; color: {CP_TEXT}; border: 1px solid {CP_CYAN}; }} QMenu::item:selected {{ background-color: {CP_CYAN}; color: {CP_BG}; }}")
        
        paste_act = menu.addAction("Paste Here")
        paste_act.setEnabled(self.clipboard_item is not None)
        paste_act.triggered.connect(self.paste_item)
        
        menu.addSeparator()
        menu.addAction("Add Script").triggered.connect(self.add_new_item)
        menu.addAction("Add Folder").triggered.connect(self.add_new_folder)
        
        menu.exec(self.grid_container.mapToGlobal(pos))

    def gridDragEnterEvent(self, event):
        if event.mimeData().hasFormat("application/x-script-item"):
            event.acceptProposedAction()

    def gridDropEvent(self, event):
        source_btn = event.source()
        if not isinstance(source_btn, CyberButton): return
        
        # Find where it was dropped
        drop_pos = event.position().toPoint()
        
        scripts = self.view_stack[-1]["scripts"] if self.view_stack else self.config["scripts"]
        
        # Find nearest item index
        target_idx = -1
        min_dist = 999999
        for i in range(self.grid.count()):
            w = self.grid.itemAt(i).widget()
            if w:
                dist = (w.geometry().center() - drop_pos).manhattanLength()
                if dist < min_dist:
                    min_dist = dist
                    target_idx = i
        
        if source_btn.script in scripts:
            old_idx = scripts.index(source_btn.script)
            
            # Guard: If dropping on itself or no meaningful change, skip refresh
            if target_idx == old_idx or target_idx == -1:
                event.accept()
                return

            # Perform the move
            scripts.pop(old_idx)
            scripts.insert(target_idx, source_btn.script)
            
            self.save_config()
            event.acceptProposedAction()

    def item_has_tag(self, item, target_tag):
        if not target_tag: return True
        tags = item.get("tags", [])
        target = target_tag.lower().strip().lstrip('#')
        if isinstance(tags, list):
            return any(str(t).strip().lower().lstrip('#') == target for t in tags)
        elif isinstance(tags, str):
            return any(t.strip().lower().lstrip('#') == target for t in tags.split(','))
        return False

    def collect_all_tags(self, item_list, tag_set):
        for item in item_list:
            tags = item.get("tags", [])
            if isinstance(tags, list):
                for t in tags:
                    if str(t).strip():
                        tag_set.add(str(t).strip().lower().lstrip('#'))
            elif isinstance(tags, str) and tags.strip():
                for t in tags.split(','):
                    if t.strip():
                        tag_set.add(t.strip().lower().lstrip('#'))
            if item.get("type") == "folder" and "scripts" in item:
                self.collect_all_tags(item["scripts"], tag_set)

    def set_tag_filter(self, tag):
        self.active_tag_filter = tag
        self.refresh_grid()

    def update_tag_bar(self):
        self.clear_layout(self.tag_bar_layout)

        if not self.config.get("show_tags", True):
            self.tag_bar_scroll.hide()
            return

        tag_set = set()
        self.collect_all_tags(self.config.get("scripts", []), tag_set)
        
        if not tag_set:
            self.tag_bar_scroll.hide()
            return
            
        self.tag_bar_scroll.show()
        
        btn_all = QPushButton("ALL")
        is_all = (self.active_tag_filter is None)
        btn_all.setCursor(Qt.CursorShape.PointingHandCursor)
        bg_all = CP_YELLOW if is_all else CP_PANEL
        fg_all = "black" if is_all else CP_TEXT
        btn_all.setStyleSheet(f"""
            QPushButton {{
                background-color: {bg_all}; color: {fg_all};
                border: 1px solid {CP_DIM}; border-radius: 12px;
                padding: 3px 10px; font-family: 'Consolas'; font-size: 9pt; font-weight: bold;
            }}
            QPushButton:hover {{ border: 1px solid {CP_CYAN}; }}
        """)
        btn_all.clicked.connect(lambda: self.set_tag_filter(None))
        self.tag_bar_layout.addWidget(btn_all)
        
        for tag in sorted(list(tag_set)):
            is_active = (self.active_tag_filter == tag)
            btn = QPushButton(f"#{tag}")
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            bg_c = CP_CYAN if is_active else CP_PANEL
            fg_c = "black" if is_active else CP_TEXT
            btn.setStyleSheet(f"""
                QPushButton {{
                    background-color: {bg_c}; color: {fg_c};
                    border: 1px solid {CP_DIM}; border-radius: 12px;
                    padding: 3px 10px; font-family: 'Consolas'; font-size: 9pt; font-weight: bold;
                }}
                QPushButton:hover {{ border: 1px solid {CP_YELLOW}; }}
            """)
            btn.clicked.connect(partial(self.set_tag_filter, None if is_active else tag))
            self.tag_bar_layout.addWidget(btn)

    def collect_all_items(self, item_list, results):
        """Recursively collect all items matching search and tag filters"""
        query = self.inp_search.text().lower().strip()
        is_tag_query = query.startswith("#")
        clean_q = query[1:] if is_tag_query else query

        for item in item_list:
            if item.get("type") != "folder":
                name_match = (not is_tag_query) and (clean_q in item.get("name", "").lower())
                tag_match = self.item_has_tag(item, clean_q)
                
                if name_match or tag_match or not clean_q:
                    if self.active_tag_filter:
                        if self.item_has_tag(item, self.active_tag_filter):
                            results.append(item)
                    else:
                        results.append(item)
            
            if item.get("type") == "folder" and "scripts" in item:
                self.collect_all_items(item["scripts"], results)

    def handle_search(self, text):
        self.refresh_grid()

    def clear_layout(self, layout):
        while layout.count():
            item = layout.takeAt(0)
            if item.widget(): item.widget().deleteLater()
            elif item.layout(): self.clear_layout(item.layout())

    def refresh_grid(self):
        # Recursively clear temporary search runtime overrides
        def clear_runtime_keys(items):
            for item in items:
                item.pop("_runtime_icon_w", None)
                item.pop("_runtime_icon_h", None)
                item.pop("_runtime_text_align", None)
                if "scripts" in item:
                    clear_runtime_keys(item["scripts"])
        clear_runtime_keys(self.config.get("scripts", []))

        while self.grid.count():
            item = self.grid.takeAt(0)
            if item.widget(): item.widget().deleteLater()

        self.clear_layout(self.breadcrumb_layout)
        
        # Helper for breadcrumb clicks
        def navigate_to(index):
            if index == -1: self.view_stack = []
            else: self.view_stack = self.view_stack[:index+1]
            self.refresh_grid()

        def create_bc_btn(text, action):
            btn = QPushButton(text)
            btn.setFont(QFont("Consolas", 14, QFont.Weight.Bold))
            btn.setStyleSheet(f"""
                QPushButton {{ 
                    color: {CP_YELLOW}; border: none; background: transparent; padding: 2px 5px; text-transform: uppercase;
                }}
                QPushButton:hover {{ color: {CP_CYAN}; text-decoration: underline; }}
            """)
            btn.clicked.connect(action)
            return btn

        def create_sep():
            lbl = QLabel("/")
            lbl.setFont(QFont("Consolas", 14, QFont.Weight.Bold))
            lbl.setStyleSheet(f"color: white; padding: 0 5px;")
            return lbl

        # Initial // ROOT
        self.breadcrumb_layout.addWidget(QLabel("// "))
        self.breadcrumb_layout.itemAt(0).widget().setStyleSheet(f"color: {CP_YELLOW}; font-family: 'Consolas'; font-size: 14pt; font-weight: bold;")
        
        root_btn = create_bc_btn("ROOT", lambda: navigate_to(-1))
        self.breadcrumb_layout.addWidget(root_btn)

        self.update_tag_bar()

        # CHECK SEARCH STATE
        search_query = self.inp_search.text().strip()
        is_searching = len(search_query) > 0

        if is_searching:
            # SEARCH MODE
            self.breadcrumb_layout.addWidget(create_sep())
            lbl_search = QLabel(f"SEARCH: {search_query}")
            lbl_search.setStyleSheet(f"color: {CP_CYAN}; font-family: 'Consolas'; font-size: 14pt; font-weight: bold;")
            self.breadcrumb_layout.addWidget(lbl_search)
            
            # Flattened list of matching items
            scripts = []
            self.collect_all_items(self.config.get("scripts", []), scripts)
            
            # Partition matching scripts: visual box items vs text-only list items
            visual_scripts = []
            list_scripts = []
            for s in scripts:
                has_icon = bool(s.get("icon_path", "").strip() or s.get("svg_content", "").strip() or s.get("nf_char", "").strip())
                if has_icon:
                    visual_scripts.append(s)
                else:
                    list_scripts.append(s)
                    
            # Get default typography
            def_fs = self.config.get("default_font_size", 10)
            def_font = self.config.get("default_font_family", "Consolas")
            def_bold = self.config.get("default_is_bold", True)
            def_italic = self.config.get("default_is_italic", False)

            # Get configuration settings
            box_w = self.config.get("search_box_width", 150)
            box_h = self.config.get("search_box_height", 150)
            box_icon_size = self.config.get("search_box_icon_size", 48)
            box_cols = self.config.get("search_box_columns", 5)

            list_w = self.config.get("search_list_width", 250)
            list_h = self.config.get("search_list_height", 40)
            list_cols = self.config.get("search_list_columns", 3)

            # 1. Create a widget for the visual boxes
            visual_widget = QWidget()
            visual_grid = QGridLayout(visual_widget)
            visual_grid.setContentsMargins(0, 0, 0, 0)
            visual_grid.setSpacing(10)
            visual_grid.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft)

            # 2. Create a widget for the list items
            list_widget = QWidget()
            list_grid = QGridLayout(list_widget)
            list_grid.setContentsMargins(0, 0, 0, 0)
            list_grid.setSpacing(10)
            list_grid.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft)

            r_v, c_v = 0, 0
            search_left_align = self.config.get("search_left_align", False)

            # Render Visual Box scripts
            for script in visual_scripts:
                # Force icons and heights overrides
                script["_runtime_icon_w"] = box_icon_size
                script["_runtime_icon_h"] = box_icon_size
                script.pop("_runtime_text_align", None)
                
                name = script.get("name", "Unnamed").replace("<br>", " ").replace("<br/>", " ").replace("<BR>", " ")
                name = " ".join(name.split())
                btn = CyberButton(name, script_data=script, config=self.config)
                btn.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
                btn.setMaximumWidth(box_w)
                btn.setFixedHeight(box_h)
                btn.setMinimumWidth(50)
                
                # Apply font
                f = QFont(script.get("font_family", def_font), script.get("font_size", def_fs))
                f.setBold(script.get("is_bold", def_bold))
                f.setItalic(script.get("is_italic", def_italic))
                btn.setFont(f)
                btn.clicked.connect(partial(self.handle_click, script))
                btn.customContextMenuRequested.connect(partial(self.show_context_menu, btn, script))
                visual_grid.addWidget(btn, r_v, c_v, 1, 1)
                
                c_v += 1
                if c_v >= box_cols:
                    c_v = 0
                    r_v += 1
            
            r_l, c_l = 0, 0

            # Render Text-only List scripts
            for script in list_scripts:
                # Clear any runtime overrides to make sure they render clean
                script.pop("_runtime_icon_w", None)
                script.pop("_runtime_icon_h", None)
                if search_left_align:
                    script["_runtime_text_align"] = "left"
                else:
                    script.pop("_runtime_text_align", None)
                
                name = script.get("name", "Unnamed").replace("<br>", " ").replace("<br/>", " ").replace("<BR>", " ")
                name = " ".join(name.split())
                btn = CyberButton(name, script_data=script, config=self.config)
                btn.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
                btn.setMaximumWidth(list_w)
                btn.setFixedHeight(list_h)
                btn.setMinimumWidth(50)
                
                # Apply font
                f = QFont(script.get("font_family", def_font), script.get("font_size", def_fs))
                f.setBold(script.get("is_bold", def_bold))
                f.setItalic(script.get("is_italic", def_italic))
                btn.setFont(f)

                btn.clicked.connect(partial(self.handle_click, script))
                btn.customContextMenuRequested.connect(partial(self.show_context_menu, btn, script))
                list_grid.addWidget(btn, r_l, c_l, 1, 1)

                c_l += 1
                if c_l >= list_cols:
                    c_l = 0
                    r_l += 1
            
            # Add sub-widgets to main grid layout
            self.grid.addWidget(visual_widget, 0, 0, 1, 1)
            if visual_scripts and list_scripts:
                divider = QLabel("SCRIPTS & ACTIONS")
                divider.setStyleSheet(f"color: {CP_DIM}; font-family: 'Consolas'; font-size: 11pt; font-weight: bold; margin-top: 15px; margin-bottom: 5px;")
                self.grid.addWidget(divider, 1, 0, 1, 1)
                self.grid.addWidget(list_widget, 2, 0, 1, 1)
            else:
                self.grid.addWidget(list_widget, 1, 0, 1, 1)
            
            return
            
        else:
            # NORMAL NAVIGATION
            # Restore breadcrumbs
            if self.view_stack:
                for i, folder in enumerate(self.view_stack):
                    self.breadcrumb_layout.addWidget(create_sep())
                    name = folder.get("name", "???").replace("<br>", " ").replace("<br/>", " ").replace("<BR>", " ")
                    name = " ".join(name.split())
                    btn = create_bc_btn(name, partial(lambda idx: navigate_to(idx), i))
                    btn.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
                    btn.customContextMenuRequested.connect(partial(self.show_breadcrumb_context_menu, btn, folder))
                    self.breadcrumb_layout.addWidget(btn)

            if self.view_stack:
                folder = self.view_stack[-1]
                scripts = folder.get("scripts", [])
                
                # Context settings (fallback to global)
                cols = folder.get("grid_columns", 0)
                if cols == 0: cols = self.config.get("columns", 5)
                
                def_h = folder.get("grid_btn_height", 0)
                if def_h == 0: def_h = self.config.get("default_btn_height", 40)
            else:
                scripts = self.config.get("scripts", [])
                
                # Global settings
                cols = self.config.get("columns", 5)
                def_h = self.config.get("default_btn_height", 40)

            if self.active_tag_filter:
                scripts = [s for s in scripts if self.item_has_tag(s, self.active_tag_filter)]

        # Default typography
        def_fs = self.config.get("default_font_size", 10)
        def_font = self.config.get("default_font_family", "Consolas")
        def_bold = self.config.get("default_is_bold", True)
        def_italic = self.config.get("default_is_italic", False)

        grid_map = {} # (row, col) -> occupied
        r, c = 0, 0
        
        for script in scripts:
            # Force height update if not specifically set
            if "height" not in script or script["height"] == 0:
                script["_runtime_height"] = def_h
            
            # Apply default font settings if item doesn't have them
            if "font_size" not in script:
                script["_runtime_font_size"] = def_fs
            else:
                script["_runtime_font_size"] = script["font_size"]
            
            if "font_family" not in script:
                script["_runtime_font_family"] = def_font
            else:
                script["_runtime_font_family"] = script["font_family"]
                
            if "is_bold" not in script:
                script["_runtime_is_bold"] = def_bold
            else:
                script["_runtime_is_bold"] = script["is_bold"]
                
            if "is_italic" not in script:
                script["_runtime_is_italic"] = def_italic
            else:
                script["_runtime_is_italic"] = script["is_italic"]
            
            # Determine spans
            c_span = script.get("col_span", 1)
            r_span = script.get("row_span", 1)
            
            # Find next free slot
            while True:
                conflict = False
                for ir in range(r, r + r_span):
                    for ic in range(c, c + c_span):
                         if (ir, ic) in grid_map:
                             conflict = True
                             break
                    if conflict: break
                
                # Check column boundary
                if c + c_span > cols:
                    r += 1
                    c = 0
                    continue

                if not conflict:
                    break # Found spot
                
                c += 1
                if c >= cols:
                     r += 1
                     c = 0
            
            # Mark occupied
            for ir in range(r, r + r_span):
                for ic in range(c, c + c_span):
                    grid_map[(ir, ic)] = True
            
            # Add widget
            btn = CyberButton(script.get("name", "Unnamed"), script_data=script, config=self.config)
            
            # Apply dynamic preferences - calculate height based on row span
            item_h = script.get("height", 0)
            if item_h == 0:
                item_h = def_h
            
            # For row span > 1, calculate total height including spacing
            if r_span > 1:
                spacing = self.grid.spacing()
                total_h = (item_h * r_span) + (spacing * (r_span - 1))
                btn.setFixedHeight(total_h)
            else:
                btn.setFixedHeight(item_h)
            
            # Apply runtime font settings
            f = QFont(script.get("_runtime_font_family", def_font), script.get("_runtime_font_size", def_fs))
            f.setBold(script.get("_runtime_is_bold", def_bold))
            f.setItalic(script.get("_runtime_is_italic", def_italic))
            btn.setFont(f)
                
            btn.clicked.connect(partial(self.handle_click, script))
            btn.customContextMenuRequested.connect(partial(self.show_context_menu, btn, script))
            self.grid.addWidget(btn, r, c, r_span, c_span, Qt.AlignmentFlag.AlignTop)
        


    def handle_click(self, script):
        if script.get("require_password"):
            if PasswordDialog(self).exec() != QDialog.DialogCode.Accepted:
                return
                
        if script.get("edit_on_click"):
            self.open_edit(script)
            return

        if script.get("type") == "folder":
            self.view_stack.append(script)
            self.refresh_grid()
        else:
            self.launch_script(script)

    def _run_shell(self, executable, params=None, work_dir=None, admin=False, hide=False):
        # Centralized helper for robust Windows / Linux process launching
        if os.name == 'nt':
            verb = "runas" if admin else None
            show = 0 if hide else 1 # SW_HIDE=0, SW_SHOWNORMAL=1
            try:
                # ShellExecuteW handles path quoting and working directories natively
                res = ctypes.windll.shell32.ShellExecuteW(None, verb, str(executable), params, str(work_dir or ""), show)
                if res <= 32:
                     QMessageBox.warning(self, "Launch Error", f"ShellExecute failed (Code {res}) for:\n{executable}")
            except Exception as e:
                QMessageBox.critical(self, "System Error", f"Failed to execute {executable}:\n{str(e)}")
        else:
            try:
                exec_normalized = normalize_path(executable)
                work_dir_normalized = normalize_path(work_dir) if work_dir else None
                
                # Check if we should host in bash/terminal
                if exec_normalized == "cmd.exe" or exec_normalized.endswith(".bat") or exec_normalized.endswith(".cmd"):
                    # Translate Windows command processor to bash
                    cleaned_params = params or ""
                    keep_open = False
                    if cleaned_params.startswith("/k ") or cleaned_params.startswith("/k"):
                        keep_open = True
                        cleaned_params = cleaned_params[3:].strip()
                    elif cleaned_params.startswith("/c ") or cleaned_params.startswith("/c"):
                        cleaned_params = cleaned_params[3:].strip()
                    
                    # Normalize any Windows-style paths in the parameters
                    def replace_paths_in_str(match):
                        return normalize_path(match.group(0))
                    cleaned_params = re.sub(r'[a-zA-Z]:\\[^"]+|[a-zA-Z]:/[^"]+', replace_paths_in_str, cleaned_params)
                    
                    bash_cmd = cleaned_params
                    if not bash_cmd:
                        bash_cmd = exec_normalized
                    
                    if keep_open:
                        terminal_emulators = ["x-terminal-emulator", "gnome-terminal", "konsole", "xfce4-terminal", "xterm"]
                        term_exe = None
                        for te in terminal_emulators:
                            if shutil.which(te):
                                term_exe = te
                                break
                        
                        if term_exe:
                            if term_exe == "gnome-terminal":
                                subprocess.Popen([term_exe, "--", "bash", "-c", f"{bash_cmd}; read -p 'Press Enter to exit...'"], cwd=work_dir_normalized)
                            else:
                                subprocess.Popen([term_exe, "-e", f"bash -c \"{bash_cmd}; read -p 'Press Enter to exit...'\""], cwd=work_dir_normalized)
                        else:
                            subprocess.Popen(["/bin/bash", "-c", bash_cmd], cwd=work_dir_normalized)
                    else:
                        subprocess.Popen(["/bin/bash", "-c", bash_cmd], cwd=work_dir_normalized)
                
                else:
                    # Non-cmd launch: e.g. python or direct file execution
                    cmd_list = []
                    if exec_normalized in ["python", "pythonw"]:
                        cmd_list.append(sys.executable)
                    else:
                        cmd_list.append(exec_normalized)
                    
                    if params:
                        import shlex
                        parsed_params = shlex.split(params)
                        normalized_params = [normalize_path(p) for p in parsed_params]
                        cmd_list.extend(normalized_params)
                    
                    if os.path.isdir(exec_normalized):
                        if hasattr(os, 'startfile'):
                            try:
                                os.startfile(exec_normalized)
                            except Exception:
                                QDesktopServices.openUrl(QUrl.fromLocalFile(exec_normalized))
                        else:
                            QDesktopServices.openUrl(QUrl.fromLocalFile(exec_normalized))
                    else:
                        subprocess.Popen(cmd_list, cwd=work_dir_normalized)
            except Exception as e:
                QMessageBox.critical(self, "System Error", f"Failed to execute {executable}:\n{str(e)}")

    def launch_script(self, script):
        # Handle Inline
        if script.get("use_inline"):
            self.launch_inline(script)
            if script.get("kill_window"): self.close()
            return

        path = normalize_path(os.path.expandvars(script.get("path", "")))
        hide = script.get("hide_terminal", False)
        
        if not path: return
        cwd = os.path.dirname(path) if os.path.isfile(path) else None
        
        new_term = script.get("new_terminal", False)
        keep = script.get("keep_open", False)
        admin = script.get("run_admin", False)

        try:
            if path.endswith(".py"):
                if admin or new_term:
                    # Use cmd to host python so /k (keep open) works
                    mode = "/k" if keep else "/c"
                    params = f'{mode} python "{path}"'
                    self._run_shell("cmd.exe", params, cwd, admin=admin, hide=hide)
                else:
                    # Simple launch
                    py_exe = "pythonw" if hide else "python"
                    self._run_shell(py_exe, f'"{path}"', cwd, hide=hide)
            elif path.endswith(".ps1"):
                # Determine shell
                ps_exe = script.get("inline_type")
                if ps_exe not in ["pwsh", "powershell"]:
                    ps_exe = "pwsh" if shutil.which("pwsh") else "powershell"
                
                # Construct params
                no_exit = "-NoExit" if keep else ""
                params = f'{no_exit} -File "{path}"'
                
                if admin or new_term:
                    self._run_shell(ps_exe, params, cwd, admin=admin, hide=hide)
                else:
                    self._run_shell(ps_exe, params, cwd, hide=hide)
            else:
                # Generic launch (Executables, Batch files, Folders)
                if admin or new_term:
                    mode = "/k" if keep else "/c"
                    self._run_shell("cmd.exe", f'{mode} "{path}"', cwd, admin=admin, hide=hide)
                else:
                    self._run_shell(path, None, cwd, hide=hide)
            
            if script.get("kill_window"): self.close()
        except Exception as e: QMessageBox.critical(self, "Error", str(e))

    def launch_inline(self, script):
        import tempfile
        
        if script.get("use_multi_block"):
            blocks = script.get("inline_blocks", [])
            for block in blocks:
                code = block.get("code", "")
                if not code.strip():
                    continue
                it = block.get("type", "cmd")
                if it == "python": ext = ".py"
                elif it in ["powershell", "pwsh"]: ext = ".ps1"
                else: ext = ".bat"
                
                with tempfile.NamedTemporaryFile(mode='w', suffix=ext, delete=False) as f:
                    f.write(code)
                    tmp = f.name
                
                hide = script.get("hide_terminal", False)
                new_term = script.get("new_terminal", False)
                keep = script.get("keep_open", False)
                admin = script.get("run_admin", False)

                if ext == ".ps1":
                    ps_exe = it
                    if ps_exe not in ["pwsh", "powershell"]:
                         ps_exe = "pwsh" if shutil.which("pwsh") else "powershell"
                    
                    no_exit = "-NoExit" if keep else ""
                    params = f'{no_exit} -File "{tmp}"'
                    self._run_shell(ps_exe, params, os.getcwd(), admin=admin, hide=hide)
                elif ext == ".py":
                    mode = "/k" if keep else "/c"
                    if keep or new_term or admin:
                        params = f'{mode} python "{tmp}"'
                        self._run_shell("cmd.exe", params, os.getcwd(), admin=admin, hide=hide)
                    else:
                        py_exe = "pythonw" if hide else "python"
                        self._run_shell(py_exe, f'"{tmp}"', os.getcwd(), admin=admin, hide=hide)
                else:
                    mode = "/k" if keep else "/c"
                    self._run_shell("cmd.exe", f'{mode} "{tmp}"', os.getcwd(), admin=admin, hide=hide)
            return

        code = script.get("inline_script", "")
        # Very simple execution
        it = script.get("inline_type", "cmd")
        if it == "python": ext = ".py"
        elif it in ["powershell", "pwsh"]: ext = ".ps1"
        else: ext = ".bat"
        with tempfile.NamedTemporaryFile(mode='w', suffix=ext, delete=False) as f:
            f.write(code)
            tmp = f.name
        
        hide = script.get("hide_terminal", False)
        new_term = script.get("new_terminal", False)
        keep = script.get("keep_open", False)
        admin = script.get("run_admin", False)

        if ext == ".ps1":
            ps_exe = script.get("inline_type", "powershell")
            if ps_exe not in ["pwsh", "powershell"]:
                 ps_exe = "pwsh" if shutil.which("pwsh") else "powershell"
            
            no_exit = "-NoExit" if keep else ""
            params = f'{no_exit} -File "{tmp}"'
            self._run_shell(ps_exe, params, os.getcwd(), admin=admin, hide=hide)
        elif ext == ".py":
            mode = "/k" if keep else "/c"
            # We host python in cmd if we need to keep it open or if new terminal is needed
            if keep or new_term or admin:
                params = f'{mode} python "{tmp}"'
                self._run_shell("cmd.exe", params, os.getcwd(), admin=admin, hide=hide)
            else:
                py_exe = "pythonw" if hide else "python"
                self._run_shell(py_exe, f'"{tmp}"', os.getcwd(), admin=admin, hide=hide)
        else:
            # Inline batch/command
            mode = "/k" if keep else "/c"
            self._run_shell("cmd.exe", f'{mode} "{tmp}"', os.getcwd(), admin=admin, hide=hide)

    def show_context_menu(self, btn, script, pos):
        # Check if context menu should be suppressed (Ctrl+Right Click with command)
        if hasattr(btn, 'suppress_context_menu') and btn.suppress_context_menu:
            btn.suppress_context_menu = False  # Reset flag
            return
        
        menu = QMenu(self)
        menu.setStyleSheet(f"QMenu {{ background-color: {CP_PANEL}; color: {CP_TEXT}; border: 1px solid {CP_CYAN}; }} QMenu::item:selected {{ background-color: {CP_CYAN}; color: {CP_BG}; }}")
        
        menu.addAction("Edit").triggered.connect(lambda: self.open_edit(script))
        menu.addAction("Reset Styles").triggered.connect(lambda: self.reset_item_styles(script))
        menu.addAction("Duplicate").triggered.connect(lambda: self.duplicate_item(script))
        menu.addSeparator()
        menu.addAction("Cut").triggered.connect(lambda: self.cut_item(script))
        
        paste_act = menu.addAction("Paste")
        paste_act.setEnabled(self.clipboard_item is not None)
        paste_act.triggered.connect(self.paste_item)
        
        menu.addSeparator()
        menu.addAction("Delete").triggered.connect(lambda: self.delete_item(script))
        menu.exec(btn.mapToGlobal(pos))

    def reset_item_styles(self, script):
        """Reset item styles to global defaults - matches EditDialog reset"""
        is_folder = (script.get("type") == "folder")
        
        # Remove custom style keys to use defaults (same as EditDialog)
        # Note: icon_path is preserved, only icon sizing/position reset
        keys_to_remove = ["color", "text_color", "hover_color", "hover_text_color", 
                         "border_color", "font_family", "font_size", "is_bold", 
                         "is_italic", "corner_radius", "border_width", "width", "height",
                         "icon_width", "icon_height", "icon_gap", "icon_position"]
        for key in keys_to_remove:
            script.pop(key, None)
        
        # Reset spans
        script["col_span"] = 1
        script["row_span"] = 1
        
        # Reset folder-specific settings
        if is_folder:
            script["grid_columns"] = 0
            script["grid_btn_height"] = 0
        
        self.save_config()

    def find_parent_list(self, current_list, target_item):
        for item in current_list:
            if item is target_item:
                return current_list
            if item.get("type") == "folder" and "scripts" in item:
                res = self.find_parent_list(item["scripts"], target_item)
                if res is not None:
                    return res
        return None

    def duplicate_item(self, script):
        import copy
        new_script = copy.deepcopy(script)
        if "name" in new_script: new_script["name"] += " (Copy)"
        
        target_list = self.find_parent_list(self.config.get("scripts", []), script)
        if target_list is None:
            target_list = self.view_stack[-1]["scripts"] if self.view_stack else self.config["scripts"]
        target_list.append(new_script)
        self.save_config()

    def cut_item(self, script):
        self.clipboard_item = script
        target_list = self.find_parent_list(self.config.get("scripts", []), script)
        if target_list is None:
            target_list = self.view_stack[-1]["scripts"] if self.view_stack else self.config["scripts"]
        self.clipboard_source_list = target_list
        # Visual feedback could be added here (e.g. ghosting the button)
        QApplication.beep()

    def paste_item(self):
        if not self.clipboard_item: return
        
        target_list = self.view_stack[-1]["scripts"] if self.view_stack else self.config["scripts"]
        
        # Remove from old
        if self.clipboard_source_list is not None and self.clipboard_item in self.clipboard_source_list:
            self.clipboard_source_list.remove(self.clipboard_item)
            
        # Add to new
        target_list.append(self.clipboard_item)
        
        self.clipboard_item = None
        self.clipboard_source_list = None
        self.save_config()

    def show_breadcrumb_context_menu(self, btn, folder, pos):
        menu = QMenu(self)
        menu.setStyleSheet(f"QMenu {{ background-color: {CP_PANEL}; color: {CP_TEXT}; border: 1px solid {CP_CYAN}; }} QMenu::item:selected {{ background-color: {CP_CYAN}; color: {CP_BG}; }}")
        menu.addAction("Edit Folder").triggered.connect(lambda: self.open_edit(folder))
        menu.exec(btn.mapToGlobal(pos))

    def open_edit(self, script):
        if EditDialog(script, self).exec(): self.save_config()

    def delete_item(self, script):
        dlg = QDialog(self)
        dlg.setWindowTitle("DELETE")
        dlg.setFixedSize(350, 120)
        dlg.setStyleSheet(f"""
            QDialog {{ background-color: {CP_BG}; border: 2px solid {CP_RED}; }}
            QLabel {{ color: {CP_TEXT}; font-family: 'Consolas'; font-size: 11pt; }}
        """)
        
        layout = QVBoxLayout(dlg)
        layout.setContentsMargins(20, 20, 20, 20)
        
        lbl = QLabel(f"Delete '{script.get('name')}'?")
        lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(lbl)
        
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        
        btn_yes = QPushButton("YES")
        btn_yes.setStyleSheet(f"background-color: {CP_RED}; color: white; border: none; padding: 8px 25px; font-family: 'Consolas'; font-weight: bold;")
        btn_yes.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_yes.clicked.connect(dlg.accept)
        
        btn_no = QPushButton("NO")
        btn_no.setStyleSheet(f"background-color: {CP_DIM}; color: white; border: none; padding: 8px 25px; font-family: 'Consolas'; font-weight: bold;")
        btn_no.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_no.clicked.connect(dlg.reject)
        
        btn_layout.addWidget(btn_yes)
        btn_layout.addWidget(btn_no)
        btn_layout.addStretch()
        layout.addLayout(btn_layout)
        
        if dlg.exec():
            target_list = self.find_parent_list(self.config.get("scripts", []), script)
            if target_list is None:
                target_list = self.view_stack[-1]["scripts"] if self.view_stack else self.config["scripts"]
            if script in target_list:
                target_list.remove(script)
                self.save_config()

    def add_new_item(self):
        new_script = {"name": "New Script", "path": "", "type": "script"}
        target_list = self.view_stack[-1]["scripts"] if self.view_stack else self.config["scripts"]
        target_list.append(new_script)
        if EditDialog(new_script, self).exec(): self.save_config()
        else: target_list.remove(new_script)

    def add_new_folder(self):
        new_folder = {
            "name": "New Folder", 
            "type": "folder", 
            "scripts": [],
            "col_span": 1,
            "row_span": 1
        }
        target_list = self.view_stack[-1]["scripts"] if self.view_stack else self.config["scripts"]
        target_list.append(new_folder)
        if EditDialog(new_folder, self).exec(): 
            self.save_config()
        else: 
            target_list.remove(new_folder)

    def open_global_settings(self):
        dlg = SettingsDialog(self.config, self)
        if dlg.exec():
            self.save_config()



if __name__ == "__main__":
    app = QApplication(sys.argv)
    
    # Set app-wide icon immediately
    icon_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app_icon_v3.png")
    if os.path.exists(icon_path):
        app.setWindowIcon(QIcon(icon_path))
        
    window = MainWindow()
    window.show()
    sys.exit(app.exec())
