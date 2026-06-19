import os
import json
import threading
import time
from flask import Flask, render_template, jsonify, request
import scraper

app = Flask(__name__)

SETTINGS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "settings.json")
IGNORELIST_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ignorelist.json")
MATCHES_BACKUP_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "matches.backup.json")

def load_ignorelist():
    if not os.path.exists(IGNORELIST_PATH):
        return []
    try:
        with open(IGNORELIST_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def save_ignorelist(lst):
    tmp = IGNORELIST_PATH + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(lst, f, indent=4, ensure_ascii=False)
        os.replace(tmp, IGNORELIST_PATH)
    except Exception as e:
        print(f"Error saving ignorelist: {e}")

def load_settings():
    if not os.path.exists(SETTINGS_PATH):
        return {"unchecked_tournaments": []}
    try:
        with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {"unchecked_tournaments": []}

def save_settings(settings):
    tmp_path = SETTINGS_PATH + ".tmp"
    try:
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=4, ensure_ascii=False)
        # Atomic rename
        os.replace(tmp_path, SETTINGS_PATH)
    except Exception as e:
        print(f"Error saving settings: {e}")
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except:
                pass

def start_background_sync():
    pass  # Auto-sync disabled — sync only on manual button click

@app.route("/")
def index():
    all_matches = scraper.get_matches_for_display()
    settings = load_settings()
    ignore_list = load_ignorelist()
    unchecked_tournaments = settings.get("unchecked_tournaments", [])
    results_pages = settings.get("results_pages", 5)
    theme = settings.get("theme", "dark")
    per_page = settings.get("per_page", "50")

    # Build logo lookup from all matches
    logo_lookup = {}
    for m in all_matches:
        t = m.get("tournament")
        if t and t not in logo_lookup and m.get("tournament_logo"):
            logo_lookup[t] = m["tournament_logo"]

    # Enrich ignore list entries that are missing logos and persist if any updated
    updated = False
    for entry in ignore_list:
        if not entry.get("logo") and entry["name"] in logo_lookup:
            entry["logo"] = logo_lookup[entry["name"]]
            updated = True
    if updated:
        save_ignorelist(ignore_list)

    # Filter out ignored tournaments
    ignore_names = {t["name"] for t in ignore_list}
    matches = [m for m in all_matches if m.get("tournament") not in ignore_names]

    tournaments = set()
    for m in matches:
        if m.get("tournament"):
            tournaments.add((m["tournament"], m.get("tournament_logo", "")))

    tournament_order = settings.get("tournament_order", {})
    sorted_tournaments = sorted(
        list(tournaments),
        key=lambda x: (tournament_order.get(x[0], 9999), x[0] in unchecked_tournaments, x[0])
    )

    # Earliest match timestamp per tournament (for sidebar sort)
    tournament_first_match = {}
    for m in matches:
        t = m.get("tournament")
        ts = m.get("unix_timestamp") or 0
        if t and ts:
            if t not in tournament_first_match or ts < tournament_first_match[t]:
                tournament_first_match[t] = ts

    return render_template(
        "index.html",
        matches=matches,
        tournaments=sorted_tournaments,
        unchecked_tournaments=unchecked_tournaments,
        results_pages=results_pages,
        theme=theme,
        ignore_list=ignore_list,
        settings=settings,
        per_page=per_page,
        tournament_first_match=tournament_first_match
    )

@app.route("/api/match/<match_id>")
def api_match_detail(match_id):
    db = scraper.load_json_matches()
    match = db.get(match_id)
    if not match:
        return jsonify({"error": "not found"}), 404
    
    force_refresh = request.args.get("refresh") == "true"
    
    # Re-fetch if no stats, or if players is old format (has team1/team2 keys directly)
    players = match.get("players", {})
    old_format = isinstance(players, dict) and ("team1" in players or "team2" in players) and "all" not in players and "0" not in players
    missing_all = isinstance(players, dict) and "all" not in players
    # Check if any player is missing a photo
    missing_photos = any(
        not p.get("photo")
        for map_data in players.values() if isinstance(map_data, dict)
        for team in ("team1", "team2")
        for p in map_data.get(team, [])
    )
    if (force_refresh or not match.get("maps") or old_format or missing_all or missing_photos) and match.get("href"):
        details = scraper.fetch_match_detail_page(match["href"])
        if details:
            match.update(details)
            db[match_id] = match
            scraper.save_json_matches(db)
    return jsonify(match)

@app.route("/api/matches")
def api_matches():
    settings = load_settings()
    saved_start = settings.get("scrape_start", 1)
    saved_end = settings.get("scrape_end", 5)
    start_page = request.args.get("start", saved_start, type=int)
    end_page = request.args.get("end", saved_end, type=int)
    start_page = max(1, start_page)
    end_page = max(start_page, end_page)
    scraper.fetch_and_update_matches(start_page=start_page, end_page=end_page)
    ignore_list = load_ignorelist()
    ignore_names = {t["name"] for t in ignore_list}
    matches = [m for m in scraper.get_matches_for_display() if m.get("tournament") not in ignore_names]
    return jsonify(matches)

@app.route("/api/settings", methods=["GET", "POST"])
def api_settings():
    if request.method == "POST":
        data = request.json or {}
        save_settings(data)
        return jsonify({"status": "success", "settings": data})
    else:
        return jsonify(load_settings())

@app.route("/api/ignorelist", methods=["GET"])
def api_ignorelist_get():
    return jsonify(load_ignorelist())

@app.route("/api/ignorelist/add", methods=["POST"])
def api_ignorelist_add():
    tournaments = request.json or []  # [{name, logo}, ...]
    lst = load_ignorelist()
    existing_names = {t["name"] for t in lst}
    for t in tournaments:
        if t.get("name") and t["name"] not in existing_names:
            lst.append({"name": t["name"], "logo": t.get("logo", "")})
            existing_names.add(t["name"])
    save_ignorelist(lst)
    return jsonify({"status": "success", "ignorelist": lst})

@app.route("/api/ignorelist/remove", methods=["POST"])
def api_ignorelist_remove():
    tournament = (request.json or {}).get("tournament", "")
    lst = [t for t in load_ignorelist() if t["name"] != tournament]
    save_ignorelist(lst)
    return jsonify({"status": "success", "ignorelist": lst})

@app.route("/api/backup", methods=["POST"])
def api_backup():
    import shutil
    if os.path.exists(scraper.JSON_PATH):
        shutil.copy2(scraper.JSON_PATH, MATCHES_BACKUP_PATH)
        size = os.path.getsize(MATCHES_BACKUP_PATH)
        return jsonify({"status": "success", "size": size})
    return jsonify({"status": "error", "message": "No matches.json found"}), 404

@app.route("/api/restore", methods=["POST"])
def api_restore():
    import shutil
    if os.path.exists(MATCHES_BACKUP_PATH):
        shutil.copy2(MATCHES_BACKUP_PATH, scraper.JSON_PATH)
        return jsonify({"status": "success"})
    return jsonify({"status": "error", "message": "No backup found"}), 404

@app.route("/api/backup/exists")
def api_backup_exists():
    if os.path.exists(MATCHES_BACKUP_PATH):
        size = os.path.getsize(MATCHES_BACKUP_PATH)
        mtime = os.path.getmtime(MATCHES_BACKUP_PATH)
        return jsonify({"exists": True, "size": size, "mtime": mtime})
    return jsonify({"exists": False})

if __name__ == "__main__":
    # Start the background sync thread
    start_background_sync()
    # Run server on port 5025
    app.run(host="0.0.0.0", port=5025, debug=True)
