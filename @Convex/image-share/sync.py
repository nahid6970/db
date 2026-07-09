"""
sync.py — Download Convex gallery images to local backup folder
Source : https://modest-goose-860.convex.cloud (Convex DB)
Dest   : C:\\@delta\\msBackups\\@JOB\\Management

Run directly:  python sync.py
Or triggered via runsync: URI scheme through sync_handler.py
"""

import sys, os, json, re, time, requests
from pathlib import Path

# Force UTF-8 output on Windows console
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr.encoding != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# ── Config ────────────────────────────────────────────────────

CONVEX_URL = "https://modest-goose-860.convex.cloud"
DEST       = Path(r"C:\@delta\msBackups\@JOB\Management")
STATE_FILE = Path(r"C:\@delta\db\@Convex\image-share\sync_state.json")
LOCK_FILE  = Path(r"C:\@delta\db\@Convex\image-share\sync.lock")

# ── ANSI colors (Windows 10+ supports these in terminal) ──────

GRN  = "\033[92m"
CYN  = "\033[96m"
YEL  = "\033[93m"
RED  = "\033[91m"
MAG  = "\033[95m"
DIM  = "\033[2m"
RST  = "\033[0m"

# ── Helpers ───────────────────────────────────────────────────

def safe_filename(name: str) -> str:
    if not name or not name.strip():
        return "untitled"
    # Replace Windows-invalid filename chars (keep Unicode)
    clean = re.sub(r'[/:*?"<>|\\]', '_', name).strip('. ')
    return clean or "untitled"

def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}

def save_state(state: dict):
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")

def convex_query(path: str, args: dict = {}) -> list:
    resp = requests.post(
        f"{CONVEX_URL}/api/query",
        json={"path": path, "args": args},
        timeout=30
    )
    resp.raise_for_status()
    return resp.json()["value"]

def download_file(url: str, dest: Path) -> int:
    """Download url to dest, return bytes written. Raises on error."""
    with requests.get(url, stream=True, timeout=60) as r:
        r.raise_for_status()
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_suffix(dest.suffix + ".tmp")
        try:
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(chunk_size=65536):
                    f.write(chunk)
            # Atomic rename — avoids partial files
            if dest.exists():
                dest.unlink()
            tmp.rename(dest)
            return dest.stat().st_size
        except Exception:
            if tmp.exists():
                tmp.unlink()
            raise

def build_folder_map(folders: list) -> dict:
    """Returns {folder_id: "path\\to\\folder"} with parent nesting."""
    parent_map = {f["_id"]: f for f in folders}
    result = {}
    for f in folders:
        name = safe_filename(f["name"])
        parent_id = f.get("parentId")
        if parent_id and parent_id in parent_map:
            parent_name = safe_filename(parent_map[parent_id]["name"])
            name = f"{parent_name}\\{name}"
        result[f["_id"]] = name
    return result

# ── Main ──────────────────────────────────────────────────────

def main():
    # Enable ANSI in Windows terminal
    os.system("")

    # Lock to prevent duplicate runs
    if LOCK_FILE.exists():
        print(f"{RED}[ABORT] Another sync is already running. Delete {LOCK_FILE} if stuck.{RST}")
        sys.exit(1)

    LOCK_FILE.write_text("running")

    try:
        _run()
    finally:
        if LOCK_FILE.exists():
            LOCK_FILE.unlink()

def _run():
    DEST.mkdir(parents=True, exist_ok=True)

    print()
    print(f"{CYN}{'='*50}{RST}")
    print(f"{CYN}   CONVEX GALLERY  ->  LOCAL BACKUP SYNC{RST}")
    print(f"{CYN}{'='*50}{RST}")
    print(f"   Dest : {DEST}")
    print()

    state     = load_state()
    new_state = {}
    downloaded = 0
    skipped    = 0
    deleted    = 0
    errors     = 0
    start      = time.time()

    # ── Fetch folders ─────────────────────────────────────────
    print(f"{DIM}  Fetching folders...{RST}")
    try:
        folders    = convex_query("images:listFolders")
        folder_map = build_folder_map(folders)
        print(f"{DIM}  Found {len(folders)} folder(s){RST}")
    except Exception as e:
        print(f"{RED}  [ERROR] Could not fetch folders: {e}{RST}")
        folder_map = {}

    # ── Fetch images ──────────────────────────────────────────
    print(f"{DIM}  Fetching image list...{RST}")
    try:
        all_images = convex_query("images:list")
    except Exception as e:
        print(f"{RED}  [ERROR] Could not fetch images: {e}{RST}")
        return

    # Only Convex-stored images
    convex_images = [
        img for img in all_images
        if img.get("storageId")
        and img.get("url")
        and "mega.nz" not in img["url"]
        and "cloudinary" not in img["url"]
    ]
    print(f"{DIM}  Found {len(convex_images)} Convex image(s) of {len(all_images)} total{RST}")
    print()

    # ── Download loop ─────────────────────────────────────────
    total = len(convex_images)
    done  = 0

    for img in convex_images:
        img_id    = img["_id"]
        raw_name  = img.get("filename") or f"file_{img_id}"
        filename  = safe_filename(raw_name)
        timestamp = str(img.get("timestamp", ""))
        url       = img["url"]

        folder_id = img.get("folderId")
        if folder_id and folder_id in folder_map:
            subfolder = folder_map[folder_id]
        else:
            subfolder = "_unfiled"

        rel_path  = f"{subfolder}\\{filename}"
        dest_file = DEST / subfolder / filename

        new_state[img_id] = {"sig": timestamp, "path": rel_path}

        prev       = state.get(img_id, {})
        prev_sig   = prev.get("sig") if isinstance(prev, dict) else str(prev)
        prev_path  = prev.get("path") if isinstance(prev, dict) else None

        # Handle move: file was in a different folder before
        if prev_path and prev_path != rel_path:
            old_file = DEST / prev_path
            if old_file.is_file():
                old_file.unlink(missing_ok=True)
                print(f"{MAG}  [MOVED]    {prev_path}{RST}")
                print(f"{MAG}         ->  {rel_path}{RST}")

        # Skip if unchanged and file already exists
        if prev_sig == timestamp and dest_file.exists():
            skipped += 1
            done += 1
            pct = int(done / total * 100)
            sys.stdout.write(f"\r  {GRN}{pct}% {done}/{total}{RST}  {DIM}Skipped ({skipped}){RST}   ")
            sys.stdout.flush()
            continue

        # Download
        try:
            size = download_file(url, dest_file)
            size_str_val = f"{size/1024:.0f}KB" if size < 1024*1024 else f"{size/1024/1024:.1f}MB"
            done += 1
            pct = int(done / total * 100)
            tag = "[NEW]    " if not prev_sig else "[UPDATED]"
            col = GRN if not prev_sig else CYN
            sys.stdout.write("\r" + " " * 60 + "\r")
            print(f"{col}  {tag} {rel_path}  ({size_str_val}){RST}")
            sys.stdout.write(f"  {GRN}{pct}% {done}/{total}{RST}  {DIM}Skipped ({skipped}){RST}   ")
            sys.stdout.flush()
            downloaded += 1
        except Exception as e:
            done += 1
            pct = int(done / total * 100)
            sys.stdout.write("\r" + " " * 60 + "\r")
            print(f"{RED}  [ERROR]    {rel_path}  ->  {e}{RST}")
            sys.stdout.write(f"  {GRN}{pct}% {done}/{total}{RST}  {DIM}Skipped ({skipped}){RST}   ")
            sys.stdout.flush()
            errors += 1

    print()  # newline after final progress line

    # ── Remove deleted images ─────────────────────────────────
    current_ids = {img["_id"] for img in convex_images}
    for old_id, old_entry in state.items():
        if old_id not in current_ids:
            old_path = old_entry.get("path") if isinstance(old_entry, dict) else None
            if old_path:
                old_file = DEST / old_path
                if old_file.is_file():
                    old_file.unlink(missing_ok=True)
                    print(f"{YEL}  [DELETED]  {old_path}{RST}")
                    deleted += 1

    # ── Remove empty folders ──────────────────────────────────
    for folder in sorted(DEST.rglob("*"), reverse=True):
        if folder.is_dir() and not any(folder.iterdir()):
            folder.rmdir()

    # ── Save state ────────────────────────────────────────────
    save_state(new_state)

    elapsed = round(time.time() - start, 1)

    print()
    print(f"{CYN}{'='*50}{RST}")
    print(f"{GRN}  DONE  ({elapsed}s){RST}")
    print(f"{DIM}  {'─'*46}{RST}")
    print(f"{GRN}  Downloaded / Updated : {downloaded}{RST}")
    print(f"{DIM}  Skipped (no change)  : {skipped}{RST}")
    if deleted:
        print(f"{YEL}  Deleted from dest   : {deleted}{RST}")
    if errors:
        print(f"{RED}  Errors               : {errors}{RST}")
    print(f"{CYN}{'='*50}{RST}")
    print()

if __name__ == "__main__":
    main()
