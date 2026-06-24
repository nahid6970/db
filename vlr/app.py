import os
import json
import threading
import time
from flask import Flask, render_template, jsonify, request
import scraper

app = Flask(__name__)

SETTINGS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "settings.json")
IGNORELIST_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ignorelist.json")

_cached_settings = None
_cached_ignorelist = None
_settings_lock = threading.Lock()
_ignorelist_lock = threading.Lock()

def load_ignorelist(force_reload=False):
    global _cached_ignorelist
    if _cached_ignorelist is not None and not force_reload:
        return _cached_ignorelist
    with _ignorelist_lock:
        if _cached_ignorelist is not None and not force_reload:
            return _cached_ignorelist
        if not os.path.exists(IGNORELIST_PATH):
            _cached_ignorelist = []
            return _cached_ignorelist
        try:
            with open(IGNORELIST_PATH, "r", encoding="utf-8") as f:
                _cached_ignorelist = json.load(f)
        except:
            _cached_ignorelist = []
    return _cached_ignorelist

def save_ignorelist(lst):
    global _cached_ignorelist
    try:
        with _ignorelist_lock:
            _cached_ignorelist = lst
            tmp = IGNORELIST_PATH + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(lst, f, indent=4, ensure_ascii=False)
            # Atomic rename with retries for transient locks (Windows lock issues)
            for attempt in range(5):
                try:
                    os.replace(tmp, IGNORELIST_PATH)
                    break
                except PermissionError:
                    time.sleep(0.1)
            else:
                os.replace(tmp, IGNORELIST_PATH)
    except Exception as e:
        print(f"Error saving ignorelist: {e}")

def load_settings(force_reload=False):
    global _cached_settings
    if _cached_settings is not None and not force_reload:
        return _cached_settings
    with _settings_lock:
        if _cached_settings is not None and not force_reload:
            return _cached_settings
        if not os.path.exists(SETTINGS_PATH):
            _cached_settings = {"unchecked_tournaments": []}
            return _cached_settings
        try:
            with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
                _cached_settings = json.load(f)
        except:
            _cached_settings = {"unchecked_tournaments": []}
    return _cached_settings

def save_settings(settings):
    global _cached_settings
    try:
        with _settings_lock:
            _cached_settings = settings
            tmp_path = SETTINGS_PATH + ".tmp"
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(settings, f, indent=4, ensure_ascii=False)
            # Atomic rename with retries for transient locks (Windows lock issues)
            for attempt in range(5):
                try:
                    os.replace(tmp_path, SETTINGS_PATH)
                    break
                except PermissionError:
                    time.sleep(0.1)
            else:
                os.replace(tmp_path, SETTINGS_PATH)
    except Exception as e:
        print(f"Error saving settings: {e}")
        if os.path.exists(SETTINGS_PATH + ".tmp"):
            try:
                os.remove(SETTINGS_PATH + ".tmp")
            except:
                pass

def start_background_sync():
    pass  # Auto-sync disabled — sync only on manual button click

def _get_visible_matches():
    settings = load_settings()
    ignore_list = load_ignorelist()
    ignore_names = {t["name"] for t in ignore_list}
    unchecked_tournaments = settings.get("unchecked_tournaments", [])

    all_tournament_rows = scraper.load_tournament_overview()
    tournament_rows = [row for row in all_tournament_rows if row["tournament"] not in ignore_names]
    tournament_names = [row["tournament"] for row in tournament_rows]
    if unchecked_tournaments:
        visible_tournaments = [name for name in tournament_names if name not in unchecked_tournaments]
    else:
        visible_tournaments = tournament_names

    matches = scraper.get_matches_for_display(
        tournament_names=visible_tournaments if visible_tournaments else [],
    )
    return settings, ignore_list, tournament_rows, matches

@app.route("/")
def index():
    settings, ignore_list, tournament_rows, matches = _get_visible_matches()
    unchecked_tournaments = settings.get("unchecked_tournaments", [])
    results_pages = settings.get("results_pages", 5)
    theme = settings.get("theme", "dark")
    per_page = settings.get("per_page", "50")

    # Build logo lookup from tournament summary rows
    logo_lookup = {
        row["tournament"]: row["tournament_logo"]
        for row in scraper.load_tournament_overview()
        if row.get("tournament") and row.get("tournament_logo")
    }

    # Enrich ignore list entries that are missing logos and persist if any updated
    updated = False
    for entry in ignore_list:
        if not entry.get("logo") and entry["name"] in logo_lookup:
            entry["logo"] = logo_lookup[entry["name"]]
            updated = True
    if updated:
        save_ignorelist(ignore_list)

    tournament_order = settings.get("tournament_order", {})
    sorted_tournaments = sorted(
        [(row["tournament"], row["tournament_logo"]) for row in tournament_rows],
        key=lambda x: (tournament_order.get(x[0], 9999), x[0] in unchecked_tournaments, x[0])
    )

    # Earliest match timestamp per tournament (for sidebar sort)
    tournament_first_match = {
        row["tournament"]: row["first_match"]
        for row in tournament_rows
        if row.get("tournament")
    }

    # Determine which tournaments have stats fully loaded
    fully_loaded_tournaments = {
        row["tournament"]: row["fully_loaded"]
        for row in tournament_rows
        if row.get("tournament")
    }

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
        tournament_first_match=tournament_first_match,
        fully_loaded_tournaments=fully_loaded_tournaments
    )

@app.route("/api/match/<match_id>")
def api_match_detail(match_id):
    match = scraper.load_match(match_id)
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
    missing_new_stats = any(
        "kd_diff" not in p
        for map_data in players.values() if isinstance(map_data, dict)
        for team in ("team1", "team2")
        for p in map_data.get(team, [])
    )
    if (force_refresh or not match.get("maps") or old_format or missing_all or missing_photos or missing_new_stats) and match.get("href"):
        details = scraper.fetch_match_detail_page(match["href"])
        if details:
            match.update(details)
            if details.get("status"):
                match["status"] = details["status"]
            scraper.upsert_match(match)
    return jsonify(match)

@app.route("/api/matches")
def api_matches():
    settings = load_settings()
    ignore_list = load_ignorelist()
    ignore_names = {t["name"] for t in ignore_list}
    saved_start = settings.get("scrape_start", 1)
    saved_end = settings.get("scrape_end", 5)
    start_page = request.args.get("start", saved_start, type=int)
    end_page = request.args.get("end", saved_end, type=int)
    start_page = max(1, start_page)
    end_page = max(start_page, end_page)
    scraper.fetch_and_update_matches(start_page=start_page, end_page=end_page)
    unchecked_tournaments = settings.get("unchecked_tournaments", [])
    tournament_rows = scraper.load_tournament_overview(exclude_tournaments=ignore_names)
    tournament_names = [row["tournament"] for row in tournament_rows]
    if unchecked_tournaments:
        visible_tournaments = [name for name in tournament_names if name not in unchecked_tournaments]
    else:
        visible_tournaments = tournament_names
    matches = scraper.get_matches_for_display(
        tournament_names=visible_tournaments if visible_tournaments else [],
        exclude_tournaments=ignore_names
    )
    return jsonify(matches)

@app.route("/api/matches/view")
def api_matches_view():
    settings = load_settings()
    ignore_list = load_ignorelist()
    ignore_names = {t["name"] for t in ignore_list}
    unchecked_tournaments = settings.get("unchecked_tournaments", [])
    tournament_rows = scraper.load_tournament_overview()
    tournament_rows = [row for row in tournament_rows if row["tournament"] not in ignore_names]
    tournament_names = [row["tournament"] for row in tournament_rows]
    if unchecked_tournaments:
        visible_tournaments = [name for name in tournament_names if name not in unchecked_tournaments]
    else:
        visible_tournaments = tournament_names
    matches = scraper.get_matches_for_display(
        tournament_names=visible_tournaments if visible_tournaments else [],
    )
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


if __name__ == "__main__":
    # Start the background sync thread
    start_background_sync()
    # Run server on port 5025
    app.run(host="0.0.0.0", port=5025, debug=True)
