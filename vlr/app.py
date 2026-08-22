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
    all_tournament_rows = scraper.load_tournament_overview()
    tournament_rows = [row for row in all_tournament_rows if row["tournament"] not in ignore_names]
    tournament_names = [row["tournament"] for row in tournament_rows]

    matches = scraper.get_matches_for_display(
        # Send all non-ignored matches to the client. The sidebar checkbox
        # controls visibility in JS; the missing-stats loader applies the
        # checked-tournament filter on the client before counting/loading.
        tournament_names=tournament_names if tournament_names else [],
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
    stats_only = request.args.get("stats_only") == "true"
    if (force_refresh or not scraper.has_complete_match_stats(match) or old_format or missing_all or (missing_photos and not stats_only) or missing_new_stats) and match.get("href"):
        details = scraper.fetch_match_detail_page(match["href"], include_player_photos=not stats_only)
        if details:
            match.update(details)
            if details.get("status"):
                match["status"] = details["status"]
            scraper.upsert_match(match)
    match["has_stats"] = scraper.has_complete_match_stats(match)
    match["has_details"] = scraper.has_complete_match_data(match)
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

    # Existing imported event pages can contain older Group Stage/Play-In
    # matches that are no longer present in VLR's recent-results feed.
    try:
        scraper.sync_existing_tournament_phases()
    except Exception as e:
        print(f"Error backfilling tournament phases: {e}")

    # Repair times and team logos for older event imports in small batches.
    try:
        scraper.backfill_match_metadata()
    except Exception as e:
        print(f"Error backfilling match metadata: {e}")
    
    # Fill logos for tournaments added before logos were stored (older adds)
    try:
        scraper.backfill_tournament_logos()
    except Exception as e:
        print(f"Error backfilling tournament logos: {e}")

    # Load missing stats for completed matches if requested
    if request.args.get("load_missing") == "true":
        scraper.load_missing_stats()
        
    tournament_rows = scraper.load_tournament_overview(exclude_tournaments=ignore_names)
    tournament_names = [row["tournament"] for row in tournament_rows]
    matches = scraper.get_matches_for_display(
        tournament_names=tournament_names if tournament_names else [],
        exclude_tournaments=ignore_names
    )
    return jsonify(matches)

@app.route("/api/matches/view")
def api_matches_view():
    settings = load_settings()
    ignore_list = load_ignorelist()
    ignore_names = {t["name"] for t in ignore_list}
    tournament_rows = scraper.load_tournament_overview()
    tournament_rows = [row for row in tournament_rows if row["tournament"] not in ignore_names]
    tournament_names = [row["tournament"] for row in tournament_rows]
    matches = scraper.get_matches_for_display(
        tournament_names=tournament_names if tournament_names else [],
    )
    return jsonify(matches)

@app.route("/api/matches/all")
def api_matches_all():
    """Return ALL matches from DB WITH full stats (leaderboard/standings).

    Heavier than /api/matches (slimmed list) — used only on demand by the
    player leaderboard, tournament standings and team history panels.
    """
    ignore_list = load_ignorelist()
    ignore_names = {t["name"] for t in ignore_list}
    tournament_rows = scraper.load_tournament_overview()
    tournament_rows = [row for row in tournament_rows if row["tournament"] not in ignore_names]
    tournament_names = [row["tournament"] for row in tournament_rows]
    matches = scraper.get_matches_for_display(
        tournament_names=tournament_names if tournament_names else [],
        include_stats=True,
    )
    return jsonify(matches)

def _name_matches(names, name):
    """Loose tournament-name match: exact, or containment either direction.

    The VLR.gg tournaments page and the match-list parser can name the same
    event slightly differently (e.g. "VCT 2026 — EMEA Stage 2" vs "Stage 2 W3"),
    so exact matches miss real hits. A minimum length avoids false positives
    on short shared substrings.
    """
    if not name:
        return False
    nl = name.strip().lower()
    for k in names:
        kl = k.strip().lower()
        if not kl:
            continue
        if kl == nl:
            return True
        if len(kl) >= 6 and len(nl) >= 6 and (kl in nl or nl in kl):
            return True
    return False

@app.route("/api/tournaments")
def api_tournaments():
    """Return the cached tournament list (fetched from VLR.gg at most once/day).

    ?refresh=true forces a re-fetch from page 1. ?pages=N makes N pages of the
    /events listing available (missing pages are fetched on demand and cached).
    Each item gets `added`/`ignored` flags so the UI can mark tournaments that
    are already in the DB / ignore list.
    """
    refresh = request.args.get("refresh") == "true"
    try:
        pages = max(1, int(request.args.get("pages") or 1))
    except (TypeError, ValueError):
        pages = 1
    result = scraper.get_tournaments(refresh=refresh, pages=pages)
    known = scraper.get_known_tournament_names()
    ignored = {t["name"] for t in load_ignorelist()}
    for t in result["tournaments"]:
        t["added"] = _name_matches(known, t["name"])
        t["ignored"] = _name_matches(ignored, t["name"])
    return jsonify({
        "tournaments": result["tournaments"],
        "fetched_at": result["fetched_at"],
        "error": result["error"],
        "total_pages": result["total_pages"],
        "pages_fetched": result["pages_fetched"],
    })

@app.route("/api/tournaments/progress")
def api_tournaments_progress():
    """Live progress of an in-flight tournament-list refresh, for the UI."""
    return jsonify(scraper.get_refresh_progress())

@app.route("/api/tournaments/add", methods=["POST"])
def api_tournaments_add():
    """Add one or more tournaments: un-ignore them, un-hide them, and fetch
    their matches from the VLR.gg event page into the DB.

    Accepts {"tournament": {...}} or {"tournaments": [{...}, ...]}. Items are
    processed one at a time with a small delay to avoid rate limits.
    """
    data = request.json or {}
    items = data.get("tournaments") or ([data["tournament"]] if data.get("tournament") else [])
    items = [t for t in items if isinstance(t, dict) and t.get("href")]
    if not items:
        return jsonify({"status": "error", "message": "No tournaments provided."}), 400

    results = []
    for i, t in enumerate(items):
        name = t.get("name", "")
        # 1. Un-ignore (in case it was previously ignored) and restore matches to main DB
        if name:
            lst = load_ignorelist()
            was_ignored = any(x["name"] == name for x in lst)
            if was_ignored:
                save_ignorelist([x for x in lst if x["name"] != name])
                try:
                    scraper.move_tournament_from_ignored(name)
                except Exception as e:
                    print(f"Warning: move_tournament_from_ignored failed for '{name}': {e}")
            # 2. Un-hide (remove from unchecked_tournaments so it shows in the sidebar)
            settings = load_settings()
            unchecked = settings.get("unchecked_tournaments", [])
            if name in unchecked:
                settings["unchecked_tournaments"] = [u for u in unchecked if u != name]
                save_settings(settings)
        # 3. Fetch the event page matches (light listing only, no player stats)
        added, error = scraper.add_tournament(t)
        results.append({"name": name, "added": added, "error": error})
        if i < len(items) - 1:
            time.sleep(1.2)

    return jsonify({"status": "success", "results": results, "total_added": sum(r["added"] for r in results)})

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
            scraper.move_tournament_to_ignored(t["name"])
    save_ignorelist(lst)
    return jsonify({"status": "success", "ignorelist": lst})

@app.route("/api/ignorelist/remove", methods=["POST"])
def api_ignorelist_remove():
    tournament = (request.json or {}).get("tournament", "")
    lst = [t for t in load_ignorelist() if t["name"] != tournament]
    save_ignorelist(lst)
    try:
        scraper.move_tournament_from_ignored(tournament)
    except Exception as e:
        print(f"Warning: move_tournament_from_ignored failed for '{tournament}': {e}")
    return jsonify({"status": "success", "ignorelist": lst})


if __name__ == "__main__":
    # Start the background sync thread
    start_background_sync()
    # Run server on port 5025
    app.run(host="0.0.0.0", port=5025, debug=True, threaded=True)  # threaded so /api/tournaments/progress answers while a refresh runs
