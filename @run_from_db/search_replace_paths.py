import sys
import os
import re
from pathlib import Path
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QLabel, QLineEdit, QPushButton, 
                             QFileDialog, QMessageBox, QTextEdit, QGroupBox,
                             QProgressBar, QCheckBox, QListWidget, QListWidgetItem)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QFont

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

class SearchReplaceWorker(QThread):
    """Worker thread for search and replace operations"""
    progress = pyqtSignal(str)
    finished = pyqtSignal(dict)
    match_found = pyqtSignal(str, str, int)  # file_path, match_type, count
    
    def __init__(self, folder_path, search_text, replace_text, file_extensions, preview_only=False, search_in_paths=True):
        super().__init__()
        self.folder_path = folder_path
        self.search_text = search_text
        self.replace_text = replace_text
        self.file_extensions = file_extensions
        self.preview_only = preview_only
        self.search_in_paths = search_in_paths
        
    def normalize_path(self, path):
        """Normalize path to forward slashes"""
        # Handle double backslashes first
        path = path.replace('\\\\', '/')
        # Then single backslashes
        path = path.replace('\\', '/')
        # Then double forward slashes
        path = path.replace('//', '/')
        return path
    
    def run(self):
        results = {
            'files_processed': 0,
            'files_modified': 0,
            'total_replacements': 0,
            'path_matches': 0,
            'content_matches': 0,
            'errors': []
        }
        
        try:
            # Normalize the search and replace paths to forward slashes as base
            search_normalized = self.normalize_path(self.search_text)
            replace_normalized = self.normalize_path(self.replace_text)
            
            # Create all 4 variations of search and replace
            search_variants = [
                search_normalized,  # /
                search_normalized.replace('/', '//'),  # //
                search_normalized.replace('/', '\\'),  # \
                search_normalized.replace('/', '\\\\')  # \\
            ]
            
            replace_variants = [
                replace_normalized,  # /
                replace_normalized.replace('/', '//'),  # //
                replace_normalized.replace('/', '\\'),  # \
                replace_normalized.replace('/', '\\\\')  # \\
            ]
            
            # Walk through all files in the folder
            for root, dirs, files in os.walk(self.folder_path):
                # Check if search text appears in directory path
                if self.search_in_paths:
                    for search_variant in search_variants:
                        if search_variant.lower() in root.lower():
                            results['path_matches'] += 1
                            self.match_found.emit(root, "DIRECTORY_PATH", 1)
                            self.progress.emit(f"📁 Found in path: {root}")
                            break
                
                for filename in files:
                    file_path = os.path.join(root, filename)
                    
                    # Check if search text appears in filename
                    if self.search_in_paths:
                        for search_variant in search_variants:
                            if search_variant.lower() in filename.lower():
                                results['path_matches'] += 1
                                self.match_found.emit(file_path, "FILENAME", 1)
                                self.progress.emit(f"📄 Found in filename: {file_path}")
                                break
                    
                    # Check if file extension matches for content search
                    if not self.file_extensions or any(filename.endswith(ext) for ext in self.file_extensions):
                        self.progress.emit(f"Scanning: {file_path}")
                        
                        try:
                            # Read file content
                            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                                content = f.read()
                            
                            results['files_processed'] += 1
                            
                            # Check for matches in content
                            modified = False
                            new_content = content
                            replacements_in_file = 0
                            
                            # Search/Replace each variant
                            for search_variant, replace_variant in zip(search_variants, replace_variants):
                                if search_variant in new_content:
                                    count = new_content.count(search_variant)
                                    replacements_in_file += count
                                    
                                    if self.preview_only:
                                        # Preview mode - just report findings
                                        self.match_found.emit(file_path, "CONTENT", count)
                                        self.progress.emit(f"🔍 Found in content: {file_path} ({count} matches)")
                                    else:
                                        # Replace mode
                                        new_content = new_content.replace(search_variant, replace_variant)
                                        modified = True
                            
                            # Write back if modified (only in replace mode)
                            if modified and not self.preview_only:
                                with open(file_path, 'w', encoding='utf-8') as f:
                                    f.write(new_content)
                                
                                results['files_modified'] += 1
                                results['total_replacements'] += replacements_in_file
                                results['content_matches'] += 1
                                self.progress.emit(f"✓ Modified: {file_path} ({replacements_in_file} replacements)")
                            elif replacements_in_file > 0:
                                results['content_matches'] += 1
                                results['total_replacements'] += replacements_in_file
                        
                        except Exception as e:
                            error_msg = f"Error processing {file_path}: {str(e)}"
                            results['errors'].append(error_msg)
                            self.progress.emit(f"✗ {error_msg}")
        
        except Exception as e:
            results['errors'].append(f"Fatal error: {str(e)}")
        
        self.finished.emit(results)


class SearchReplacePaths(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("SEARCH_REPLACE // CYBER_QT")
        self.setGeometry(100, 100, 900, 700)
        
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
                padding: 12px 24px; 
                font-size: 11pt;
                font-weight: bold;
            }}
            QPushButton#AccentButton:hover {{
                background-color: {CP_GREEN}; 
                color: {CP_BG};
            }}
            
            QPushButton#BrowseButton {{
                background-color: {CP_PANEL}; 
                border: 1px solid {CP_ORANGE}; 
                color: {CP_ORANGE}; 
                padding: 6px 12px; 
                font-weight: bold;
            }}
            QPushButton#BrowseButton:hover {{
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
            
            QProgressBar {{
                border: 1px solid {CP_DIM};
                background-color: {CP_PANEL};
                color: {CP_TEXT};
                text-align: center;
                height: 20px;
            }}
            QProgressBar::chunk {{
                background-color: {CP_GREEN};
            }}
            
            QListWidget {{
                background-color: {CP_PANEL};
                border: 1px solid {CP_DIM};
                color: {CP_TEXT};
            }}
        """)
        
        self.worker = None
        self.matches = []  # Store preview matches
        self.setup_ui()
        
    def setup_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        main_layout = QVBoxLayout(central)
        main_layout.setContentsMargins(20, 20, 20, 20)
        main_layout.setSpacing(15)

        # Header
        header = QLabel("SEARCH_REPLACE_PATHS")
        header.setObjectName("HeaderLabel")
        header.setAlignment(Qt.AlignmentFlag.AlignCenter)
        main_layout.addWidget(header)
        
        # Folder selection
        folder_group = QGroupBox("TARGET_FOLDER")
        folder_layout = QHBoxLayout(folder_group)
        
        folder_label = QLabel("FOLDER:")
        folder_label.setObjectName("SectionLabel")
        folder_layout.addWidget(folder_label)
        
        self.folder_input = QLineEdit()
        self.folder_input.setPlaceholderText("Select folder to search...")
        folder_layout.addWidget(self.folder_input, 1)
        
        self.browse_btn = QPushButton("BROWSE")
        self.browse_btn.setObjectName("BrowseButton")
        self.browse_btn.clicked.connect(self.browse_folder)
        folder_layout.addWidget(self.browse_btn)
        
        main_layout.addWidget(folder_group)
        
        # Search and Replace inputs
        search_replace_group = QGroupBox("SEARCH_AND_REPLACE")
        search_replace_layout = QVBoxLayout(search_replace_group)
        
        # Search text
        search_layout = QHBoxLayout()
        search_label = QLabel("FIND:")
        search_label.setObjectName("SectionLabel")
        search_label.setMinimumWidth(80)
        search_layout.addWidget(search_label)
        
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Enter path to find (any separator format)")
        search_layout.addWidget(self.search_input)
        
        search_replace_layout.addLayout(search_layout)
        
        # Replace text
        replace_layout = QHBoxLayout()
        replace_label = QLabel("REPLACE:")
        replace_label.setObjectName("SectionLabel")
        replace_label.setMinimumWidth(80)
        replace_layout.addWidget(replace_label)
        
        self.replace_input = QLineEdit()
        self.replace_input.setPlaceholderText("Enter replacement path (any separator format)")
        replace_layout.addWidget(self.replace_input)
        
        search_replace_layout.addLayout(replace_layout)
        
        # Info label
        info_label = QLabel("NOTE: Searches for path in all 4 formats (/, //, \\, \\\\) and replaces with matching format")
        info_label.setObjectName("StatusLabel")
        info_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        search_replace_layout.addWidget(info_label)
        
        main_layout.addWidget(search_replace_group)
        
        # File extensions filter
        filter_group = QGroupBox("FILE_FILTERS")
        filter_layout = QVBoxLayout(filter_group)
        
        filter_info_layout = QHBoxLayout()
        filter_label = QLabel("EXTENSIONS:")
        filter_label.setObjectName("SectionLabel")
        filter_info_layout.addWidget(filter_label)
        
        self.extensions_input = QLineEdit()
        self.extensions_input.setPlaceholderText("e.g., .py .txt .json (leave empty for all files)")
        filter_info_layout.addWidget(self.extensions_input)
        
        filter_layout.addLayout(filter_info_layout)
        
        # Search options
        options_layout = QHBoxLayout()
        self.search_paths_checkbox = QCheckBox("Search in file/folder names")
        self.search_paths_checkbox.setChecked(True)
        options_layout.addWidget(self.search_paths_checkbox)
        options_layout.addStretch()
        filter_layout.addLayout(options_layout)
        
        main_layout.addWidget(filter_group)
        
        # Execute buttons
        button_layout = QHBoxLayout()
        
        self.preview_btn = QPushButton("PREVIEW_MATCHES")
        self.preview_btn.setObjectName("AccentButton")
        self.preview_btn.clicked.connect(self.preview_matches)
        button_layout.addWidget(self.preview_btn)
        
        self.execute_btn = QPushButton("EXECUTE_REPLACE")
        self.execute_btn.setObjectName("AccentButton")
        self.execute_btn.clicked.connect(self.execute_replace)
        button_layout.addWidget(self.execute_btn)
        
        main_layout.addLayout(button_layout)
        
        # Progress bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        self.progress_bar.setRange(0, 0)  # Indeterminate progress
        main_layout.addWidget(self.progress_bar)
        
        # Matches list (for preview)
        matches_group = QGroupBox("MATCHES_FOUND")
        matches_layout = QVBoxLayout(matches_group)
        
        self.matches_list = QListWidget()
        self.matches_list.setMinimumHeight(150)
        matches_layout.addWidget(self.matches_list)
        
        main_layout.addWidget(matches_group)
        
        # Log output
        log_group = QGroupBox("OPERATION_LOG")
        log_layout = QVBoxLayout(log_group)
        
        self.log_output = QTextEdit()
        self.log_output.setReadOnly(True)
        self.log_output.setMinimumHeight(150)
        self.log_output.setStyleSheet(f"""
            QTextEdit {{
                background-color: {CP_PANEL}; 
                color: {CP_GREEN}; 
                border: 1px solid {CP_GREEN}; 
                padding: 6px;
                font-family: 'Consolas';
                font-size: 9pt;
            }}
        """)
        log_layout.addWidget(self.log_output)
        
        main_layout.addWidget(log_group)
        
        # Status
        self.status_label = QLabel("SYSTEM_READY >> Configure search and replace parameters")
        self.status_label.setObjectName("StatusLabel")
        main_layout.addWidget(self.status_label)
    
    def browse_folder(self):
        """Open folder browser dialog"""
        folder = QFileDialog.getExistingDirectory(
            self,
            "Select Folder to Search",
            "",
            QFileDialog.Option.ShowDirsOnly
        )
        
        if folder:
            self.folder_input.setText(folder)
            self.status_label.setText(f"FOLDER_SELECTED >> {folder}")
            self.log_output.append(f"<span style='color: {CP_CYAN};'>Selected folder: {folder}</span>")
    
    def preview_matches(self):
        """Preview what will be found without making changes"""
        folder_path = self.folder_input.text().strip()
        search_text = self.search_input.text().strip()
        
        if not folder_path:
            QMessageBox.warning(self, "Missing Input", "Please select a folder to search.")
            return
        
        if not os.path.exists(folder_path):
            QMessageBox.warning(self, "Invalid Folder", "The selected folder does not exist.")
            return
        
        if not search_text:
            QMessageBox.warning(self, "Missing Input", "Please enter text to search for.")
            return
        
        # Parse file extensions
        extensions_text = self.extensions_input.text().strip()
        file_extensions = []
        if extensions_text:
            file_extensions = [ext.strip() for ext in extensions_text.split() if ext.strip()]
        
        # Clear previous results
        self.matches_list.clear()
        self.matches = []
        self.log_output.clear()
        self.log_output.append(f"<span style='color: {CP_YELLOW};'>PREVIEW_MODE...</span>")
        self.log_output.append(f"<span style='color: {CP_CYAN};'>Folder: {folder_path}</span>")
        self.log_output.append(f"<span style='color: {CP_CYAN};'>Find: {search_text}</span>")
        if file_extensions:
            self.log_output.append(f"<span style='color: {CP_CYAN};'>Extensions: {', '.join(file_extensions)}</span>")
        else:
            self.log_output.append(f"<span style='color: {CP_CYAN};'>Extensions: All files</span>")
        self.log_output.append("")
        
        self.progress_bar.setVisible(True)
        self.preview_btn.setEnabled(False)
        self.execute_btn.setEnabled(False)
        self.status_label.setText("SCANNING >> Finding matches...")
        
        # Start worker thread in preview mode
        search_in_paths = self.search_paths_checkbox.isChecked()
        self.worker = SearchReplaceWorker(folder_path, search_text, "", file_extensions, preview_only=True, search_in_paths=search_in_paths)
        self.worker.progress.connect(self.on_progress)
        self.worker.match_found.connect(self.on_match_found)
        self.worker.finished.connect(self.on_preview_finished)
        self.worker.start()
    
    def execute_replace(self):
        """Execute the search and replace operation"""
        # Validate inputs
        folder_path = self.folder_input.text().strip()
        search_text = self.search_input.text().strip()
        replace_text = self.replace_input.text().strip()
        
        if not folder_path:
            QMessageBox.warning(self, "Missing Input", "Please select a folder to search.")
            return
        
        if not os.path.exists(folder_path):
            QMessageBox.warning(self, "Invalid Folder", "The selected folder does not exist.")
            return
        
        if not search_text:
            QMessageBox.warning(self, "Missing Input", "Please enter text to search for.")
            return
        
        if not replace_text:
            QMessageBox.warning(self, "Missing Input", "Please enter replacement text.")
            return
        
        # Confirm operation
        reply = QMessageBox.question(
            self,
            "Confirm Replace",
            f"This will search and replace in all files under:\n{folder_path}\n\n"
            f"Find: {search_text}\n"
            f"Replace: {replace_text}\n\n"
            f"Will search for all 4 separator variations and replace with matching format.\n\n"
            f"This operation cannot be undone. Continue?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply != QMessageBox.StandardButton.Yes:
            return
        
        # Parse file extensions
        extensions_text = self.extensions_input.text().strip()
        file_extensions = []
        if extensions_text:
            file_extensions = [ext.strip() for ext in extensions_text.split() if ext.strip()]
        
        # Clear log and show progress
        self.matches_list.clear()
        self.log_output.clear()
        self.log_output.append(f"<span style='color: {CP_YELLOW};'>STARTING_OPERATION...</span>")
        self.log_output.append(f"<span style='color: {CP_CYAN};'>Folder: {folder_path}</span>")
        self.log_output.append(f"<span style='color: {CP_CYAN};'>Find: {search_text}</span>")
        self.log_output.append(f"<span style='color: {CP_CYAN};'>Replace: {replace_text}</span>")
        if file_extensions:
            self.log_output.append(f"<span style='color: {CP_CYAN};'>Extensions: {', '.join(file_extensions)}</span>")
        else:
            self.log_output.append(f"<span style='color: {CP_CYAN};'>Extensions: All files</span>")
        self.log_output.append("")
        
        self.progress_bar.setVisible(True)
        self.preview_btn.setEnabled(False)
        self.execute_btn.setEnabled(False)
        self.status_label.setText("PROCESSING >> Searching and replacing...")
        
        # Start worker thread
        search_in_paths = self.search_paths_checkbox.isChecked()
        self.worker = SearchReplaceWorker(folder_path, search_text, replace_text, file_extensions, preview_only=False, search_in_paths=search_in_paths)
        self.worker.progress.connect(self.on_progress)
        self.worker.match_found.connect(self.on_match_found)
        self.worker.finished.connect(self.on_finished)
        self.worker.start()
    
    def on_match_found(self, file_path, match_type, count):
        """Handle match found signal"""
        self.matches.append((file_path, match_type, count))
        
        # Add to matches list
        if match_type == "DIRECTORY_PATH":
            item_text = f"📁 DIR: {file_path}"
        elif match_type == "FILENAME":
            item_text = f"📄 FILE: {file_path}"
        else:  # CONTENT
            item_text = f"📝 CONTENT ({count}x): {file_path}"
        
        item = QListWidgetItem(item_text)
        self.matches_list.addItem(item)
    
    def on_progress(self, message):
        """Handle progress updates from worker thread"""
        if message.startswith("✓"):
            self.log_output.append(f"<span style='color: {CP_GREEN};'>{message}</span>")
        elif message.startswith("✗"):
            self.log_output.append(f"<span style='color: {CP_RED};'>{message}</span>")
        elif message.startswith("📁") or message.startswith("📄") or message.startswith("🔍"):
            self.log_output.append(f"<span style='color: {CP_YELLOW};'>{message}</span>")
        else:
            self.log_output.append(f"<span style='color: {CP_TEXT};'>{message}</span>")
        
        # Auto-scroll to bottom
        self.log_output.verticalScrollBar().setValue(
            self.log_output.verticalScrollBar().maximum()
        )
    
    def on_preview_finished(self, results):
        """Handle completion of preview operation"""
        self.progress_bar.setVisible(False)
        self.preview_btn.setEnabled(True)
        self.execute_btn.setEnabled(True)
        
        # Display summary
        self.log_output.append("")
        self.log_output.append(f"<span style='color: {CP_YELLOW};'>PREVIEW_COMPLETE</span>")
        self.log_output.append(f"<span style='color: {CP_CYAN};'>Files scanned: {results['files_processed']}</span>")
        self.log_output.append(f"<span style='color: {CP_GREEN};'>Path matches: {results['path_matches']}</span>")
        self.log_output.append(f"<span style='color: {CP_GREEN};'>Content matches: {results['content_matches']}</span>")
        self.log_output.append(f"<span style='color: {CP_GREEN};'>Total occurrences: {results['total_replacements']}</span>")
        
        if results['errors']:
            self.log_output.append(f"<span style='color: {CP_RED};'>Errors: {len(results['errors'])}</span>")
        
        total_matches = results['path_matches'] + results['content_matches']
        self.status_label.setText(
            f"PREVIEW >> Found {total_matches} matches ({results['total_replacements']} total occurrences)"
        )
        
        if total_matches == 0:
            QMessageBox.information(
                self,
                "No Matches Found",
                f"No matches found for:\n{self.search_input.text()}\n\n"
                f"Try checking:\n"
                f"- The search path is correct\n"
                f"- File extensions filter isn't too restrictive\n"
                f"- The path exists in file contents or names"
            )
    
    def on_finished(self, results):
        """Handle completion of search and replace operation"""
        self.progress_bar.setVisible(False)
        self.preview_btn.setEnabled(True)
        self.execute_btn.setEnabled(True)
        
        # Display summary
        self.log_output.append("")
        self.log_output.append(f"<span style='color: {CP_YELLOW};'>OPERATION_COMPLETE</span>")
        self.log_output.append(f"<span style='color: {CP_CYAN};'>Files processed: {results['files_processed']}</span>")
        self.log_output.append(f"<span style='color: {CP_GREEN};'>Files modified: {results['files_modified']}</span>")
        self.log_output.append(f"<span style='color: {CP_GREEN};'>Total replacements: {results['total_replacements']}</span>")
        
        if results['errors']:
            self.log_output.append(f"<span style='color: {CP_RED};'>Errors: {len(results['errors'])}</span>")
            for error in results['errors'][:10]:  # Show first 10 errors
                self.log_output.append(f"<span style='color: {CP_RED};'>  {error}</span>")
            if len(results['errors']) > 10:
                self.log_output.append(f"<span style='color: {CP_RED};'>  ... and {len(results['errors']) - 10} more errors</span>")
        
        self.status_label.setText(
            f"COMPLETE >> {results['files_modified']} files modified, "
            f"{results['total_replacements']} replacements made"
        )
        
        # Show completion message
        QMessageBox.information(
            self,
            "Operation Complete",
            f"Search and replace completed!\n\n"
            f"Files processed: {results['files_processed']}\n"
            f"Files modified: {results['files_modified']}\n"
            f"Total replacements: {results['total_replacements']}\n"
            f"Errors: {len(results['errors'])}"
        )
    
    def on_finished(self, results):
        """Handle completion of search and replace operation"""
        self.progress_bar.setVisible(False)
        self.execute_btn.setEnabled(True)
        
        # Display summary
        self.log_output.append("")
        self.log_output.append(f"<span style='color: {CP_YELLOW};'>OPERATION_COMPLETE</span>")
        self.log_output.append(f"<span style='color: {CP_CYAN};'>Files processed: {results['files_processed']}</span>")
        self.log_output.append(f"<span style='color: {CP_GREEN};'>Files modified: {results['files_modified']}</span>")
        self.log_output.append(f"<span style='color: {CP_GREEN};'>Total replacements: {results['total_replacements']}</span>")
        
        if results['errors']:
            self.log_output.append(f"<span style='color: {CP_RED};'>Errors: {len(results['errors'])}</span>")
            for error in results['errors'][:10]:  # Show first 10 errors
                self.log_output.append(f"<span style='color: {CP_RED};'>  {error}</span>")
            if len(results['errors']) > 10:
                self.log_output.append(f"<span style='color: {CP_RED};'>  ... and {len(results['errors']) - 10} more errors</span>")
        
        self.status_label.setText(
            f"COMPLETE >> {results['files_modified']} files modified, "
            f"{results['total_replacements']} replacements made"
        )
        
        # Show completion message
        QMessageBox.information(
            self,
            "Operation Complete",
            f"Search and replace completed!\n\n"
            f"Files processed: {results['files_processed']}\n"
            f"Files modified: {results['files_modified']}\n"
            f"Total replacements: {results['total_replacements']}\n"
            f"Errors: {len(results['errors'])}"
        )


def main():
    app = QApplication(sys.argv)
    
    # Set application properties
    app.setApplicationName("Search Replace Paths")
    app.setApplicationVersion("1.0")
    
    window = SearchReplacePaths()
    window.show()
    
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
