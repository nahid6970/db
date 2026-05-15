import sys, re, os
from PyQt6.QtWidgets import QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, QPushButton
from PyQt6.QtCore import Qt

CP_BG = "#050505"; CP_PANEL = "#111111"; CP_YELLOW = "#FCEE0A"
CP_CYAN = "#00F0FF"; CP_DIM = "#3a3a3a"; CP_TEXT = "#E0E0E0"

HTML_FILE = os.path.join(os.path.dirname(__file__), "index.html")
PATTERN = re.compile(r'(<div id="version-badge"[^>]*>)([^<]*)(</div>)')

def read_current():
    with open(HTML_FILE, encoding="utf-8") as f:
        content = f.read()
    m = PATTERN.search(content)
    return m.group(2).strip() if m else ""

def write_version(new_text):
    with open(HTML_FILE, encoding="utf-8") as f:
        content = f.read()
    new_content, n = PATTERN.subn(lambda m: m.group(1) + new_text + m.group(3), content)
    if n == 0:
        return False
    with open(HTML_FILE, "w", encoding="utf-8") as f:
        f.write(new_content)
    return True

class App(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Set Version Label")
        self.setFixedSize(360, 130)
        self.setStyleSheet(f"""
            QMainWindow, QWidget {{ background-color: {CP_BG}; color: {CP_TEXT}; font-family: Consolas; font-size: 10pt; }}
            QLineEdit {{ background: {CP_PANEL}; color: {CP_CYAN}; border: 1px solid {CP_DIM}; padding: 4px; }}
            QLineEdit:focus {{ border: 1px solid {CP_CYAN}; }}
            QPushButton {{ background: {CP_DIM}; border: 1px solid {CP_DIM}; color: white; padding: 6px 14px; font-weight: bold; }}
            QPushButton:hover {{ border: 1px solid {CP_YELLOW}; color: {CP_YELLOW}; }}
            QPushButton:pressed {{ background: {CP_YELLOW}; color: black; }}
        """)
        w = QWidget(); self.setCentralWidget(w)
        layout = QVBoxLayout(w); layout.setContentsMargins(16, 16, 16, 16); layout.setSpacing(10)

        layout.addWidget(QLabel("Version label text:"))
        self.input = QLineEdit(read_current())
        self.input.returnPressed.connect(self.save)
        layout.addWidget(self.input)

        row = QHBoxLayout()
        self.status = QLabel("")
        self.status.setStyleSheet(f"color: {CP_DIM};")
        btn = QPushButton("SAVE")
        btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn.clicked.connect(self.save)
        row.addWidget(self.status, 1)
        row.addWidget(btn)
        layout.addLayout(row)

    def save(self):
        text = self.input.text().strip()
        if not text:
            self.status.setText("⚠ Cannot be empty"); self.status.setStyleSheet(f"color: {CP_YELLOW};"); return
        if write_version(text):
            self.status.setText(f"✓ Saved as: {text}"); self.status.setStyleSheet(f"color: {CP_CYAN};")
        else:
            self.status.setText("✗ Pattern not found"); self.status.setStyleSheet("color: #FF003C;")

if __name__ == "__main__":
    app = QApplication(sys.argv)
    w = App(); w.show()
    sys.exit(app.exec())
