import customtkinter as ctk
import psutil
import os
import threading
from tkinter import filedialog, messagebox
import ctypes
import sys
from pathlib import Path

# CYBERPUNK THEME PALETTE
CP_BG = "#050505"
CP_PANEL = "#111111"
CP_YELLOW = "#FCEE0A"
CP_CYAN = "#00F0FF"
CP_RED = "#FF003C"
CP_GREEN = "#00ff21"
CP_ORANGE = "#ff934b"
CP_DIM = "#3a3a3a"
CP_TEXT = "#E0E0E0"
CP_SUBTEXT = "#808080"

# Configuration
ctk.set_appearance_mode("Dark")

class ProcessItem(ctk.CTkFrame):
    def __init__(self, master, proc, file_path, kill_callback):
        super().__init__(master, fg_color=CP_PANEL, corner_radius=0, border_width=1, border_color=CP_DIM)
        self.pack(fill="x", padx=10, pady=5)
        self.proc = proc
        self.kill_callback = kill_callback

        try:
            name = proc.name()
            pid = proc.pid
            username = proc.username()
        except:
            name = "Unknown"
            pid = "???"
            username = "???"

        # Icon/Label Container
        info_frame = ctk.CTkFrame(self, fg_color="transparent")
        info_frame.pack(side="left", fill="both", expand=True, padx=10, pady=10)

        # Process Name
        ctk.CTkLabel(info_frame, text=f"{name} (PID: {pid})", font=("Consolas", 16, "bold"), text_color=CP_CYAN).pack(anchor="w")
        
        # User & Path Info
        ctk.CTkLabel(info_frame, text=f"User: {username}", font=("Consolas", 12), text_color=CP_SUBTEXT).pack(anchor="w")
        ctk.CTkLabel(info_frame, text=f"Locking: {file_path}", font=("Consolas", 12), text_color=CP_RED, wraplength=400).pack(anchor="w")

        # Action Button
        self.btn_kill = ctk.CTkButton(self, text="KILL", font=("Consolas", 12, "bold"), 
                                      fg_color=CP_DIM, hover_color=CP_RED, text_color="white",
                                      command=self.terminate_process, width=80, corner_radius=0)
        self.btn_kill.pack(side="right", padx=10, pady=10)

    def terminate_process(self):
        self.kill_callback(self.proc, self)

from tkinterdnd2 import DND_FILES, TkinterDnD

class LocksmithApp(ctk.CTk, TkinterDnD.DnDWrapper):
    def __init__(self):
        super().__init__()
        self.TkdndVersion = TkinterDnD._require(self)

        self.title("PyLocksmith - File Lock Manager")
        self.geometry("700x600")
        self.configure(fg_color=CP_BG)
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)

        # Enable Drag and Drop
        self.drop_target_register(DND_FILES)
        self.dnd_bind('<<Drop>>', self.drop_data)

        # Header
        self.header_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.header_frame.grid(row=0, column=0, padx=20, pady=(20, 10), sticky="ew")
        
        ctk.CTkLabel(self.header_frame, text="FILE LOCKSMITH", font=("Consolas", 28, "bold"), text_color=CP_YELLOW).pack(side="left")
        
        # Buttons Frame
        self.btn_frame = ctk.CTkFrame(self.header_frame, fg_color="transparent")
        self.btn_frame.pack(side="right")

        self.restart_btn = ctk.CTkButton(self.btn_frame, text="RESTART", font=("Consolas", 12, "bold"), 
                                        fg_color=CP_DIM, hover_color=CP_CYAN, text_color="white", 
                                        width=80, corner_radius=0, command=self.restart_app)
        self.restart_btn.pack(side="right", padx=5)

        if not self.is_admin():
            self.admin_btn = ctk.CTkButton(self.btn_frame, text="ADMIN RESTART", font=("Consolas", 12, "bold"),
                                          fg_color=CP_ORANGE, text_color="black", hover_color=CP_YELLOW, 
                                          width=120, corner_radius=0, command=self.restart_admin)
            self.admin_btn.pack(side="right", padx=5)

        # Search Area
        self.search_frame = ctk.CTkFrame(self, fg_color=CP_PANEL, corner_radius=0, border_width=1, border_color=CP_DIM)
        self.search_frame.grid(row=1, column=0, padx=20, pady=10, sticky="ew")

        self.path_entry = ctk.CTkEntry(self.search_frame, placeholder_text="Drag folder here or use Browse...", 
                                       height=40, border_width=1, border_color=CP_DIM, fg_color=CP_BG, 
                                       text_color=CP_CYAN, font=("Consolas", 12))
        self.path_entry.pack(side="left", fill="x", expand=True, padx=(15, 10), pady=10)
        
        self.btn_browse = ctk.CTkButton(self.search_frame, text="BROWSE", font=("Consolas", 12, "bold"), 
                                        width=80, command=self.browse_path, fg_color=CP_DIM, 
                                        hover_color=CP_CYAN, corner_radius=0)
        self.btn_browse.pack(side="left", padx=(0, 10), pady=10)

        self.btn_scan = ctk.CTkButton(self.search_frame, text="SCAN LOCKS", font=("Consolas", 12, "bold"), 
                                      width=100, command=self.start_scan, fg_color=CP_DIM, 
                                      hover_color=CP_GREEN, corner_radius=0)
        self.btn_scan.pack(side="left", padx=(0, 15), pady=10)

        # status
        self.status_label = ctk.CTkLabel(self, text="SYSTEM READY", font=("Consolas", 12), text_color=CP_SUBTEXT)
        self.status_label.grid(row=3, column=0, padx=20, pady=5, sticky="w")

        # Results Area
        self.results_scroll = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.results_scroll.grid(row=2, column=0, padx=20, pady=10, sticky="nsew")

    def drop_data(self, event):
        data = event.data
        if data.startswith('{') and data.endswith('}'):
            data = data[1:-1]
        self.path_entry.delete(0, "end")
        self.path_entry.insert(0, data)
        self.start_scan()

    def is_admin(self):
        try:
            return ctypes.windll.shell32.IsUserAnAdmin()
        except:
            return False

    def restart_admin(self):
        ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, " ".join(sys.argv), None, 1)
        sys.exit()

    def restart_app(self):
        python = sys.executable
        os.execl(python, python, *sys.argv)

    def browse_path(self):
        path = filedialog.askdirectory()
        if not path: # Check for file if directory not picked
            path = filedialog.askopenfilename()
        
        if path:
            self.path_entry.delete(0, "end")
            self.path_entry.insert(0, path)

    def start_scan(self):
        target_path = self.path_entry.get()
        if not target_path or not os.path.exists(target_path):
            self.status_label.configure(text="INVALID PATH", text_color=CP_RED)
            return

        self.status_label.configure(text="SCANNING PROCESSES...", text_color=CP_CYAN)
        for widget in self.results_scroll.winfo_children():
            widget.destroy()

        import queue
        self.scan_queue = queue.Queue()
        
        # Run scan in thread
        threading.Thread(target=self.run_scan_thread, args=(target_path, self.scan_queue), daemon=True).start()
        
        # Start monitoring
        self.check_scan_status()

    def check_scan_status(self):
        try:
            # Poll queue
            while True:
                msg_type, data = self.scan_queue.get_nowait()
                if msg_type == 'progress':
                    self.status_label.configure(text=data.upper())
                elif msg_type == 'done':
                    self.display_results(data)
                    return # Stop polling
        except:
            pass # Queue empty
        
        self.after(100, self.check_scan_status)

    def run_scan_thread(self, target_path, q):
        import time
        target_path = os.path.abspath(target_path).lower()
        found_locks = []
        
        # Get all PIDs first to have a total count
        all_pids = list(psutil.pids())
        total = len(all_pids)
        
        # Common system PIDs to skip (System Idle, System)
        skip_pids = {0, 4}

        for i, pid in enumerate(all_pids):
            if pid in skip_pids:
                continue

            # Update progress fewer times to avoid queue spam
            if i % 20 == 0: 
                q.put(('progress', f"Scanning process {i}/{total}..."))
                # minimal sleep just to be safe on CPU
                time.sleep(0.001)

            try:
                try:
                    proc = psutil.Process(pid)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
                
                # Check attributes lightweight first
                try:
                    name = proc.name()
                except:
                    name = "???"

                # Check CWD (Fast)
                matched_file = None
                try:
                    cwd = proc.cwd()
                    if cwd and self.is_subpath(cwd, target_path):
                        matched_file = cwd + " (Working Directory)"
                except (psutil.AccessDenied, psutil.NoSuchProcess):
                    pass

                # Check Open Files (Slow) - Only if not already found
                if not matched_file:
                    try:
                        open_files = proc.open_files()
                        for f in open_files:
                            if self.is_subpath(f.path, target_path):
                                matched_file = f.path
                                break
                    except (psutil.AccessDenied, psutil.NoSuchProcess):
                        pass
                
                if matched_file:
                    found_locks.append((proc, matched_file))

            except Exception:
                continue

        q.put(('done', found_locks))

    def is_subpath(self, path, target):
        path = os.path.abspath(path).lower()
        if path == target:
            return True
        if path.startswith(target + os.sep):
            return True
        return False

    def display_results(self, locks):
        if not locks:
            self.status_label.configure(text="NO LOCKS DETECTED", text_color=CP_RED)
            lbl = ctk.CTkLabel(self.results_scroll, text="No processes found locking this file/folder.", 
                               font=("Consolas", 16), text_color=CP_TEXT)
            lbl.pack(pady=20)
            return

        self.status_label.configure(text=f"DETECTED {len(locks)} BLOCKING PROCESSES", text_color=CP_GREEN)
        for proc, file_path in locks:
            item = ProcessItem(self.results_scroll, proc, file_path, self.confirm_kill)

    def confirm_kill(self, proc, item_widget):
        try:
             name = proc.name()
             proc.kill()
             item_widget.destroy()
             self.status_label.configure(text=f"TERMINATED {name.upper()}", text_color=CP_GREEN)
        except psutil.NoSuchProcess:
            item_widget.destroy()
        except psutil.AccessDenied:
            messagebox.showerror("Error", "Access Denied. Try running as Admin.")
        except Exception as e:
            messagebox.showerror("Error", str(e))

if __name__ == "__main__":
    try:
        print("Starting Locksmith App...")
        app = LocksmithApp()
        print("App initialized, entering mainloop...")
        app.mainloop()
    except Exception as e:
        import traceback
        traceback.print_exc()
        input("Press Enter to exit...")
