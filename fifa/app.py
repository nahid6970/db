from __future__ import annotations

import json
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

from flask import Flask, Response, jsonify, send_from_directory


BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "groups.json"
ESPN_STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings"
REFRESH_SECONDS = 60

app = Flask(__name__)

_cache_lock = threading.Lock()
_cache_payload: dict | None = None
_cache_timestamp = 0.0

EMPTY_PAYLOAD = {"updated_at": None, "groups": []}


def _load_disk_payload() -> dict | None:
    if not DATA_FILE.exists():
        return None
    try:
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except Exception:
        return None


def _save_payload(payload: dict) -> None:
    DATA_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _normalize_payload(raw: dict) -> dict:
    groups: list[dict] = []
    for grp in raw.get("children", []):
        rows: list[dict] = []
        standings = grp.get("standings", {})
        for entry in standings.get("entries", []):
            stats = {stat.get("abbreviation"): stat.get("displayValue", "0") for stat in entry.get("stats", [])}
            team = entry.get("team", {})
            logos = team.get("logos") or [{}]
            rows.append(
                {
                    "name": team.get("displayName", "Unknown"),
                    "logo": logos[0].get("href", ""),
                    "P": stats.get("GP", "0"),
                    "W": stats.get("W", "0"),
                    "D": stats.get("D", "0"),
                    "L": stats.get("L", "0"),
                    "GD": stats.get("GD", "0"),
                    "Pts": stats.get("P", "0"),
                }
            )

        groups.append({"name": grp.get("name", "Group"), "teams": rows})

    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "groups": groups,
    }


def _refresh_from_espn() -> dict:
    request = Request(ESPN_STANDINGS_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=20) as response:
        raw = json.load(response)

    payload = _normalize_payload(raw)
    _save_payload(payload)

    global _cache_payload, _cache_timestamp
    with _cache_lock:
        _cache_payload = payload
        _cache_timestamp = time.time()

    return payload


def _get_groups(force: bool = False) -> dict:
    global _cache_payload, _cache_timestamp

    with _cache_lock:
        payload = _cache_payload
        age = time.time() - _cache_timestamp

    if not force and payload is not None and age < REFRESH_SECONDS:
        return payload

    try:
        return _refresh_from_espn()
    except Exception:
        fallback = payload or _load_disk_payload() or EMPTY_PAYLOAD
        with _cache_lock:
            _cache_payload = fallback
            _cache_timestamp = time.time()
        if not DATA_FILE.exists():
            _save_payload(fallback)
        return fallback


def _refresh_loop() -> None:
    while True:
        time.sleep(REFRESH_SECONDS)
        try:
            _refresh_from_espn()
        except Exception:
            pass


@app.route("/")
def index() -> Response:
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/groups.json")
def groups_json() -> Response:
    payload = _get_groups()
    response = jsonify(payload)
    response.headers["Cache-Control"] = "no-store"
    return response


@app.route("/api/groups")
def api_groups() -> Response:
    return groups_json()


@app.route("/api/wins")
def api_wins() -> Response:
    payload = _get_groups()
    teams = []
    for grp in payload.get("groups", []):
        for team in grp.get("teams", []):
            teams.append(
                {
                    "name": team.get("name", "Unknown"),
                    "logo": team.get("logo", ""),
                    "group": grp.get("name", "").replace("Group ", ""),
                    "played": int(team.get("P", "0") or 0),
                    "wins": int(team.get("W", "0") or 0),
                    "draws": int(team.get("D", "0") or 0),
                    "losses": int(team.get("L", "0") or 0),
                    "gd": int(team.get("GD", "0") or 0),
                    "pts": int(team.get("Pts", "0") or 0),
                }
            )
    teams.sort(key=lambda t: (-t["wins"], -t["gd"], -t["pts"], t["name"]))
    response = jsonify({"teams": teams, "updated_at": payload.get("updated_at")})
    response.headers["Cache-Control"] = "no-store"
    return response



def main() -> None:
    try:
        _get_groups(force=True)
    except Exception:
        fallback = _load_disk_payload() or EMPTY_PAYLOAD
        _save_payload(fallback)
        global _cache_payload, _cache_timestamp
        with _cache_lock:
            _cache_payload = fallback
            _cache_timestamp = time.time()

    thread = threading.Thread(target=_refresh_loop, daemon=True)
    thread.start()
    app.run(host="0.0.0.0", port=5152, debug=False, use_reloader=False)


if __name__ == "__main__":
    main()
