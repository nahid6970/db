"""
sync_handler.py — Custom URI scheme handler for runsync:
Registers the runsync: protocol in Windows Registry and runs sync.ps1
when the protocol is triggered from any HTML page.

Usage:
  python sync_handler.py --register     # run once to register
  python sync_handler.py --unregister   # remove from registry
  (called automatically by Windows when runsync: is triggered)
"""

import sys
import os
import subprocess
import winreg

PROTOCOL     = "runsync"
SCRIPT_PATH  = os.path.abspath(__file__)
SCRIPT_DIR   = os.path.dirname(SCRIPT_PATH)
SYNC_SCRIPT  = os.path.join(SCRIPT_DIR, "sync.py")

# Use pythonw.exe so no console flash when Windows spawns the handler,
# but we want a visible terminal for the actual sync — so we open a new
# cmd/powershell window explicitly inside handle().
PYTHON_EXE   = sys.executable
PYTHONW_EXE  = PYTHON_EXE.replace("python.exe", "pythonw.exe").replace("Python.exe", "pythonw.exe")
if not os.path.exists(PYTHONW_EXE):
    PYTHONW_EXE = PYTHON_EXE  # fallback to regular python


# ── Registry helpers ──────────────────────────────────────────

def register():
    base = rf"Software\Classes\{PROTOCOL}"
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, base) as k:
        winreg.SetValueEx(k, "",            0, winreg.REG_SZ, f"URL:{PROTOCOL} Protocol")
        winreg.SetValueEx(k, "URL Protocol",0, winreg.REG_SZ, "")
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, rf"{base}\shell\open\command") as k:
        cmd = f'"{PYTHONW_EXE}" "{SCRIPT_PATH}" "%1"'
        winreg.SetValueEx(k, "", 0, winreg.REG_SZ, cmd)
    print(f"[OK] Registered protocol:  {PROTOCOL}:")
    print(f"     Handler script:        {SCRIPT_PATH}")
    print(f"     Python executable:     {PYTHONW_EXE}")
    print()
    print("You can now trigger it from any HTML page with:")
    print(f'  window.location.href = "{PROTOCOL}:"')


def unregister():
    base = rf"Software\Classes\{PROTOCOL}"
    for sub in [r"\shell\open\command", r"\shell\open", r"\shell", ""]:
        try:
            winreg.DeleteKey(winreg.HKEY_CURRENT_USER, base + sub)
        except FileNotFoundError:
            pass
    print(f"[OK] Unregistered protocol: {PROTOCOL}:")


# ── Handle the runsync: call ──────────────────────────────────

def handle():
    bat = os.path.join(SCRIPT_DIR, "sync_run.bat")
    if not os.path.exists(bat):
        subprocess.Popen(
            ["cmd.exe", "/k", "echo ERROR: sync_run.bat not found"],
            creationflags=subprocess.CREATE_NEW_CONSOLE
        )
        return
    subprocess.Popen(
        ["cmd.exe", "/k", bat],
        creationflags=subprocess.CREATE_NEW_CONSOLE
    )


# ── Entry point ───────────────────────────────────────────────

if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else ""

    if arg == "--register":
        register()
    elif arg == "--unregister":
        unregister()
    elif arg.startswith(f"{PROTOCOL}:"):
        handle()
    else:
        print("Usage:")
        print("  python sync_handler.py --register     # register runsync: protocol (run once)")
        print("  python sync_handler.py --unregister   # remove from registry")
        print()
        print(f"  Once registered, navigate to  {PROTOCOL}:  from any browser to trigger sync.")
