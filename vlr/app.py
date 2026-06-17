from flask import Flask, render_template, jsonify
import scraper

app = Flask(__name__)

@app.route("/")
def index():
    # Render the matches template
    # We will fetch matches on load. Since scraper caches them, it will be fast
    matches = scraper.get_matches_for_display()
    
    # Get unique tournaments for the filter checklist
    tournaments = set()
    for m in matches:
        if m.get("tournament"):
            tournaments.add((m["tournament"], m.get("tournament_logo", "")))
            
    # Sort tournaments by name
    sorted_tournaments = sorted(list(tournaments), key=lambda x: x[0])
    
    return render_template("index.html", matches=matches, tournaments=sorted_tournaments)

@app.route("/api/matches")
def api_matches():
    # Return matches as JSON for AJAX refresh
    matches = scraper.get_matches_for_display()
    return jsonify(matches)

if __name__ == "__main__":
    # Ensure database is initialized
    scraper.init_db()
    # Run server
    app.run(host="0.0.0.0", port=5025, debug=True)
