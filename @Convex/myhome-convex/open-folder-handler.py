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
PROTOCOL_FILE = "openfile"
SCRIPT_PATH = os.path.abspath(__file__)
# Use pythonw.exe (no console window) if available, else fall back to python.exe
PYTHON_EXE = sys.executable.replace("python.exe", "pythonw.exe").replace("python3.exe", "pythonw.exe")


def _register_protocol(protocol):
    base = rf"Software\Classes\{protocol}"
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, base) as key:
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, f"URL:{protocol} Protocol")
        winreg.SetValueEx(key, "URL Protocol", 0, winreg.REG_SZ, "")
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, rf"{base}\shell\open\command") as key:
        cmd = f'"{PYTHON_EXE}" "{SCRIPT_PATH}" "%1"'
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, cmd)
    print(f"Registered: {protocol}: -> {cmd}")


def _unregister_protocol(protocol):
    base = rf"Software\Classes\{protocol}"
    for sub in [r"\shell\open\command", r"\shell\open", r"\shell", ""]:
        try:
            winreg.DeleteKey(winreg.HKEY_CURRENT_USER, base + sub)
        except FileNotFoundError:
            pass
    print(f"Unregistered: {protocol}:")


def register():
    _register_protocol(PROTOCOL)
    _register_protocol(PROTOCOL_FILE)


def unregister():
    _unregister_protocol(PROTOCOL)
    _unregister_protocol(PROTOCOL_FILE)


def _decode_uri_path(uri, protocol):
    from urllib.parse import unquote
    path = uri
    if path.lower().startswith(f"{protocol}:"):
        path = path[len(protocol) + 1:]
    path = path.lstrip("/")
    path = unquote(path)
    # Convert forward slashes to backslashes
    path = path.replace("/", "\\")
    return path


def open_folder(uri):
    path = _decode_uri_path(uri, PROTOCOL)
    if os.path.exists(path):
        subprocess.Popen(["explorer.exe", path])
    else:
        parent = os.path.dirname(path)
        if os.path.exists(parent):
            subprocess.Popen(["explorer.exe", parent])


def open_file(uri):
    path = _decode_uri_path(uri, PROTOCOL_FILE)
    if os.path.exists(path):
        os.startfile(path)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)
    arg = sys.argv[1]
    if arg == "--register":
        register()
    elif arg == "--unregister":
        unregister()
    elif arg.lower().startswith(f"{PROTOCOL_FILE}:"):
        open_file(arg)
    else:
        open_folder(arg)
