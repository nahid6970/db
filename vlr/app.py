import os
import json
import threading
import time
from flask import Flask, render_template, jsonify, request
import scraper

app = Flask(__name__)

SETTINGS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "settings.json")

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
    def sync_loop():
        print("Background sync thread started...")
        # Initial sync on startup if JSON is empty or doesn't exist
        db = scraper.load_json_matches()
        if not db:
            print("No cached matches found. Performing initial sync from VLR.gg...")
            scraper.fetch_and_update_matches()
            print("Initial sync complete.")
        
        while True:
            # Sync every 5 minutes (300 seconds)
            time.sleep(300)
            print("Background sync: Syncing from VLR.gg...")
            scraper.fetch_and_update_matches()
            print("Background sync: Sync complete.")
            
    # Prevent running twice in Flask debug reloader mode
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
        t = threading.Thread(target=sync_loop, daemon=True)
        t.start()

@app.route("/")
def index():
    # Load matches (reads from matches.json cache)
    matches = scraper.get_matches_for_display()
    
    # Load user settings
    settings = load_settings()
    unchecked_tournaments = settings.get("unchecked_tournaments", [])
    results_pages = settings.get("results_pages", 5)
    theme = settings.get("theme", "dark")
    
    # Get unique tournaments for the filter checklist
    tournaments = set()
    for m in matches:
        if m.get("tournament"):
            tournaments.add((m["tournament"], m.get("tournament_logo", "")))
            
    # Sort tournaments: checked first (not in unchecked_tournaments), then alphabetically
    sorted_tournaments = sorted(
        list(tournaments), 
        key=lambda x: (x[0] in unchecked_tournaments, x[0])
    )
    
    return render_template(
        "index.html", 
        matches=matches, 
        tournaments=sorted_tournaments,
        unchecked_tournaments=unchecked_tournaments,
        results_pages=results_pages,
        theme=theme
    )

@app.route("/api/matches")
def api_matches():
    pages = request.args.get("pages", 5, type=int)
    pages = max(1, min(pages, 50))  # clamp 1-50
    # Save pages to settings
    settings = load_settings()
    settings["results_pages"] = pages
    save_settings(settings)
    scraper.fetch_and_update_matches(pages=pages)
    matches = scraper.get_matches_for_display()
    return jsonify(matches)

@app.route("/api/settings", methods=["GET", "POST"])
def api_settings():
    if request.method == "POST":
        data = request.json or {}
        save_settings(data)
        return jsonify({"status": "success", "settings": data})
    else:
        return jsonify(load_settings())

if __name__ == "__main__":
    # Start the background sync thread
    start_background_sync()
    # Run server on port 5025
    app.run(host="0.0.0.0", port=5025, debug=True)
