"""
sync.py — Download Convex gallery images to local backup folder
Source : https://modest-goose-860.convex.cloud (Convex DB)
Dest   : C:\\@delta\\msBackups\\@JOB\\Management
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

# ── ANSI ──────────────────────────────────────────────────────

GRN  = "\033[92m"
CYN  = "\033[96m"
YEL  = "\033[93m"
RED  = "\033[91m"
MAG  = "\033[95m"
DIM  = "\033[2m"
BLD  = "\033[1m"
RST  = "\033[0m"

# ── Helpers ───────────────────────────────────────────────────

def safe_filename(name: str) -> str:
    if not name or not name.strip():
        return "untitled"
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

def file_type_icon(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    icons = {
        ".pdf": "📄", ".png": "🖼", ".jpg": "🖼", ".jpeg": "🖼",
        ".gif": "🖼", ".webp": "🖼", ".svg": "🖼", ".bmp": "🖼",
        ".mp4": "🎬", ".mp3": "🎵", ".zip": "📦", ".docx": "📝",
        ".xlsx": "📊", ".txt": "📃",
    }
    return icons.get(ext, "📁")

def size_str(n: int) -> str:
    if n < 1024:        return f"{n}B"
    if n < 1024**2:     return f"{n/1024:.0f}KB"
    if n < 1024**3:     return f"{n/1024**2:.1f}MB"
    return f"{n/1024**3:.2f}GB"

def progress_bar(done: int, total: int, width: int = 36) -> str:
    pct   = done / total if total else 0
    filled = int(width * pct)
    bar   = "█" * filled + "░" * (width - filled)
    return f"{GRN}[{bar}]{RST} {GRN}{done}/{total}{RST} {DIM}({pct*100:.0f}%){RST}"

def print_progress(done: int, total: int, current: str):
    bar  = progress_bar(done, total)
    # Truncate long filename for the status line
    name = current[-42:] if len(current) > 42 else current
    line = f"\r  {bar}  {DIM}{name:<44}{RST}"
    sys.stdout.write(line)
    sys.stdout.flush()

def download_file(url: str, dest: Path) -> int:
    with requests.get(url, stream=True, timeout=60) as r:
        r.raise_for_status()
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_suffix(dest.suffix + ".tmp")
        try:
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(chunk_size=65536):
                    f.write(chunk)
            if dest.exists():
                dest.unlink()
            tmp.rename(dest)
            return dest.stat().st_size
        except Exception:
            if tmp.exists():
                tmp.unlink()
            raise

def build_folder_map(folders: list) -> dict:
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
    os.system("")  # enable ANSI on Windows

    if LOCK_FILE.exists():
        print(f"\n{RED}[ABORT] Another sync is already running.")
        print(f"Delete {LOCK_FILE} if stuck.{RST}\n")
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
    print(f"{GRN}{'='*52}{RST}")
    print(f"{GRN}{BLD}   CONVEX GALLERY  ->  LOCAL BACKUP SYNC{RST}")
    print(f"{GRN}{'='*52}{RST}")
    print(f"{GRN}   Dest  : {DEST}{RST}")
    print()

    state      = load_state()
    new_state  = {}
    downloaded = 0
    skipped    = 0
    deleted    = 0
    errors     = 0
    start      = time.time()

    # ── Fetch folders ─────────────────────────────────────────
    print(f"{GRN}  Fetching folders...{RST}")
    try:
        folders    = convex_query("images:listFolders")
        folder_map = build_folder_map(folders)
        print(f"{GRN}  Found {len(folders)} folder(s){RST}")
    except Exception as e:
        print(f"{RED}  [ERROR] Could not fetch folders: {e}{RST}")
        folder_map = {}

    # ── Fetch images ──────────────────────────────────────────
    print(f"{GRN}  Fetching file list...{RST}")
    try:
        all_images = convex_query("images:list")
    except Exception as e:
        print(f"{RED}  [ERROR] Could not fetch files: {e}{RST}")
        return

    convex_images = [
        img for img in all_images
        if img.get("storageId")
        and img.get("url")
        and "mega.nz"    not in img["url"]
        and "cloudinary" not in img["url"]
    ]

    total = len(convex_images)
    print(f"{GRN}  Found {total} file(s) in Convex storage (of {len(all_images)} total){RST}")
    print()

    # Figure out how many actually need downloading
    to_download = []
    to_skip     = []
    for img in convex_images:
        img_id    = img["_id"]
        raw_name  = img.get("filename") or f"file_{img_id}"
        filename  = safe_filename(raw_name)
        timestamp = str(img.get("timestamp", ""))
        folder_id = img.get("folderId")
        subfolder = folder_map.get(folder_id, "_unfiled") if folder_id else "_unfiled"
        rel_path  = f"{subfolder}\\{filename}"
        dest_file = DEST / subfolder / filename
        prev      = state.get(img_id, {})
        prev_sig  = prev.get("sig") if isinstance(prev, dict) else str(prev)
        if prev_sig == timestamp and dest_file.exists():
            to_skip.append(img)
        else:
            to_download.append(img)

    print(f"{GRN}  To download : {len(to_download)}   Skipping (unchanged) : {len(to_skip)}{RST}")
    print()

    # ── Download loop ─────────────────────────────────────────
    done = 0
    log_lines = []  # collect per-file results to print after progress bar

    for img in convex_images:
        img_id    = img["_id"]
        raw_name  = img.get("filename") or f"file_{img_id}"
        filename  = safe_filename(raw_name)
        timestamp = str(img.get("timestamp", ""))
        url       = img["url"]
        folder_id = img.get("folderId")
        subfolder = folder_map.get(folder_id, "_unfiled") if folder_id else "_unfiled"
        rel_path  = f"{subfolder}\\{filename}"
        dest_file = DEST / subfolder / filename
        icon      = file_type_icon(filename)

        new_state[img_id] = {"sig": timestamp, "path": rel_path}

        prev      = state.get(img_id, {})
        prev_sig  = prev.get("sig") if isinstance(prev, dict) else str(prev)
        prev_path = prev.get("path") if isinstance(prev, dict) else None

        # Handle moved file
        if prev_path and prev_path != rel_path:
            old_file = DEST / prev_path
            if old_file.is_file():
                old_file.unlink(missing_ok=True)
                log_lines.append(f"{MAG}  [MOVED]  {icon} {prev_path} -> {rel_path}{RST}")

        # Skip unchanged
        if prev_sig == timestamp and dest_file.exists():
            skipped += 1
            done += 1
            print_progress(done, total, filename)
            continue

        # Show progress bar before download
        print_progress(done, total, filename)

        try:
            sz   = download_file(url, dest_file)
            done += 1
            print_progress(done, total, filename)
            tag  = "[NEW]    " if not prev_sig else "[UPDATED]"
            col  = GRN if not prev_sig else CYN
            log_lines.append(f"{col}  {tag} {icon} {rel_path}  {DIM}({size_str(sz)}){RST}")
            downloaded += 1
        except Exception as e:
            done += 1
            print_progress(done, total, filename)
            log_lines.append(f"{RED}  [ERROR]   {icon} {rel_path}  -> {e}{RST}")
            errors += 1

    # Clear progress line, print file log
    sys.stdout.write("\r" + " " * 90 + "\r")
    sys.stdout.flush()
    for line in log_lines:
        print(line)

    # ── Remove deleted images ─────────────────────────────────
    current_ids = {img["_id"] for img in convex_images}
    for old_id, old_entry in state.items():
        if old_id not in current_ids:
            old_path = old_entry.get("path") if isinstance(old_entry, dict) else None
            if old_path and Path(old_path).name:
                old_file = DEST / old_path
                if old_file.is_file():
                    old_file.unlink(missing_ok=True)
                    print(f"{YEL}  [DELETED]  {old_path}{RST}")
                    deleted += 1

    # ── Remove empty folders ──────────────────────────────────
    for folder in sorted(DEST.rglob("*"), reverse=True):
        if folder.is_dir() and not any(folder.iterdir()):
            folder.rmdir()

    save_state(new_state)

    elapsed = round(time.time() - start, 1)

    print()
    print(f"{GRN}{'='*52}{RST}")
    print(f"{GRN}{BLD}  DONE  ({elapsed}s){RST}")
    print(f"{DIM}  {'─'*48}{RST}")
    print(f"{GRN}  Downloaded / Updated : {downloaded}{RST}")
    print(f"{DIM}  Skipped (no change)  : {skipped}{RST}")
    if deleted:
        print(f"{YEL}  Deleted from dest   : {deleted}{RST}")
    if errors:
        print(f"{RED}  Errors              : {errors}{RST}")
    print(f"{GRN}{'='*52}{RST}")
    print()

if __name__ == "__main__":
    main()
