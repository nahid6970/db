"""
opendir: URI scheme handler for Windows.

SETUP (run once as normal user, no admin needed):
    python open-folder-handler.py --register

USAGE after registration:
    Clicking opendir:C:/some/folder in the browser opens that folder in Explorer.

UNINSTALL:
    python open-folder-handler.py --unregister
"""

import sys
import os
import subprocess
import winreg

PROTOCOL = "opendir"
SCRIPT_PATH = os.path.abspath(__file__)
PYTHON_EXE = sys.executable


def register():
    """Register opendir: URI scheme under HKCU (no admin needed)."""
    base = rf"Software\Classes\{PROTOCOL}"
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, base) as key:
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, f"URL:{PROTOCOL} Protocol")
        winreg.SetValueEx(key, "URL Protocol", 0, winreg.REG_SZ, "")
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, rf"{base}\shell\open\command") as key:
        cmd = f'"{PYTHON_EXE}" "{SCRIPT_PATH}" "%1"'
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, cmd)
    print(f"Registered: {PROTOCOL}: -> {cmd}")


def unregister():
    """Remove the opendir: URI scheme registration."""
    import shutil
    try:
        winreg.DeleteKey(winreg.HKEY_CURRENT_USER,
                         rf"Software\Classes\{PROTOCOL}\shell\open\command")
        winreg.DeleteKey(winreg.HKEY_CURRENT_USER,
                         rf"Software\Classes\{PROTOCOL}\shell\open")
        winreg.DeleteKey(winreg.HKEY_CURRENT_USER,
                         rf"Software\Classes\{PROTOCOL}\shell")
        winreg.DeleteKey(winreg.HKEY_CURRENT_USER,
                         rf"Software\Classes\{PROTOCOL}")
        print(f"Unregistered: {PROTOCOL}:")
    except FileNotFoundError:
        print("Not registered.")


def open_folder(uri):
    """Handle opendir:C:/path/to/folder"""
    # Strip the protocol prefix
    path = uri
    if path.lower().startswith(f"{PROTOCOL}:"):
        path = path[len(PROTOCOL) + 1:]
    # Remove leading slashes (browsers may add opendir:///path)
    path = path.lstrip("/")
    # Decode %20 etc.
    from urllib.parse import unquote
    path = unquote(path)
    if os.path.exists(path):
        subprocess.Popen(["explorer.exe", path])
    else:
        # Try to open parent if path doesn't exist
        parent = os.path.dirname(path)
        if os.path.exists(parent):
            subprocess.Popen(["explorer.exe", parent])


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)
    arg = sys.argv[1]
    if arg == "--register":
        register()
    elif arg == "--unregister":
        unregister()
    else:
        open_folder(arg)
