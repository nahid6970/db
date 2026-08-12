import os
import re
import json
import sqlite3
import requests
import threading
import time
from bs4 import BeautifulSoup
from datetime import datetime, timezone, timedelta
import zoneinfo
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(BASE_DIR, "matches.json")
DB_PATH = os.path.join(BASE_DIR, "matches.db")
IGNORED_DB_PATH = os.path.join(BASE_DIR, "ignored_matches.db")
IMAGE_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "images_cache")

# Ensure image cache directory exists
os.makedirs(IMAGE_CACHE_DIR, exist_ok=True)

# Locks to prevent concurrent sync issues
sync_lock = threading.Lock()
details_lock = threading.Lock()
_cache_lock = threading.Lock()
_cached_matches = None
_db_init_lock = threading.Lock()
_db_initialized = False

MATCH_COLUMNS = [
    "id",
    "href",
    "date",
    "time",
    "team1",
    "team2",
    "score1",
    "score2",
    "tournament",
    "series",
    "tournament_logo",
    "eta",
    "status",
    "team1_logo",
    "team2_logo",
    "unix_timestamp",
    "bst_time",
    "maps_json",
    "players_json",
    "last_updated",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def _get_conn():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn

def _ensure_db():
    global _db_initialized
    if _db_initialized:
        return
    with _db_init_lock:
        if _db_initialized:
            return
        with _get_conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS matches (
                    id TEXT PRIMARY KEY,
                    href TEXT,
                    date TEXT,
                    time TEXT,
                    team1 TEXT,
                    team2 TEXT,
                    score1 TEXT,
                    score2 TEXT,
                    tournament TEXT,
                    series TEXT,
                    tournament_logo TEXT,
                    eta TEXT,
                    status TEXT,
                    team1_logo TEXT,
                    team2_logo TEXT,
                    unix_timestamp INTEGER,
                    bst_time TEXT,
                    maps_json TEXT,
                    players_json TEXT,
                    last_updated INTEGER
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_matches_unix_timestamp ON matches(unix_timestamp)")
            conn.commit()
        _migrate_json_to_sqlite()
        _migrate_ignored_tournaments_to_db()
        _db_initialized = True

_ignored_db_initialized = False
_ignored_db_init_lock = threading.Lock()
IGNORELIST_PATH = os.path.join(BASE_DIR, "ignorelist.json")

def _ensure_ignored_db():
    global _ignored_db_initialized
    if _ignored_db_initialized:
        return
    with _ignored_db_init_lock:
        if _ignored_db_initialized:
            return
        with sqlite3.connect(IGNORED_DB_PATH, timeout=30) as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS matches (
                    id TEXT PRIMARY KEY,
                    href TEXT,
                    date TEXT,
                    time TEXT,
                    team1 TEXT,
                    team2 TEXT,
                    score1 TEXT,
                    score2 TEXT,
                    tournament TEXT,
                    series TEXT,
                    tournament_logo TEXT,
                    eta TEXT,
                    status TEXT,
                    team1_logo TEXT,
                    team2_logo TEXT,
                    unix_timestamp INTEGER,
                    bst_time TEXT,
                    maps_json TEXT,
                    players_json TEXT,
                    last_updated INTEGER
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_matches_unix_timestamp ON matches(unix_timestamp)")
            conn.commit()
        _ignored_db_initialized = True

def _load_ignore_names():
    if not os.path.exists(IGNORELIST_PATH):
        return set()
    try:
        with open(IGNORELIST_PATH, "r", encoding="utf-8") as f:
            lst = json.load(f)
            return {t["name"] for t in lst if isinstance(t, dict) and "name" in t}
    except Exception:
        return set()

def move_tournament_to_ignored(tournament_name):
    _ensure_db()
    _ensure_ignored_db()
    with _get_conn() as conn:
        conn.execute("ATTACH DATABASE ? AS ignored_db", (IGNORED_DB_PATH,))
        # Move matches to ignored DB
        conn.execute("""
            INSERT OR REPLACE INTO ignored_db.matches
            SELECT * FROM main.matches WHERE tournament = ?
        """, (tournament_name,))
        # Delete from main DB
        conn.execute("DELETE FROM main.matches WHERE tournament = ?", (tournament_name,))
        conn.commit()
    with _get_conn() as conn:
        conn.execute("VACUUM")

def move_tournament_from_ignored(tournament_name):
    _ensure_db()
    _ensure_ignored_db()
    with _get_conn() as conn:
        conn.execute("ATTACH DATABASE ? AS ignored_db", (IGNORED_DB_PATH,))
        # Move matches to main DB
        conn.execute("""
            INSERT OR REPLACE INTO main.matches
            SELECT * FROM ignored_db.matches WHERE tournament = ?
        """, (tournament_name,))
        # Delete from ignored DB
        conn.execute("DELETE FROM ignored_db.matches WHERE tournament = ?", (tournament_name,))
        conn.commit()
    with sqlite3.connect(IGNORED_DB_PATH, timeout=30) as conn:
        conn.execute("VACUUM")

def _migrate_ignored_tournaments_to_db():
    ignore_names = _load_ignore_names()
    if not ignore_names:
        return
    _ensure_ignored_db()
    migrated = False
    with _get_conn() as conn:
        placeholders = ",".join("?" for _ in ignore_names)
        cur = conn.execute(f"SELECT COUNT(*) AS count FROM matches WHERE tournament IN ({placeholders})", list(ignore_names))
        row = cur.fetchone()
        if row and row["count"] > 0:
            print(f"Migrating {row['count']} matches of ignored tournaments to ignored DB...")
            conn.execute("ATTACH DATABASE ? AS ignored_db", (IGNORED_DB_PATH,))
            conn.execute(f"""
                INSERT OR REPLACE INTO ignored_db.matches
                SELECT * FROM main.matches WHERE tournament IN ({placeholders})
            """, list(ignore_names))
            conn.execute(f"DELETE FROM main.matches WHERE tournament IN ({placeholders})", list(ignore_names))
            conn.commit()
            migrated = True
    if migrated:
        with _get_conn() as conn:
            conn.execute("VACUUM")



def _migrate_json_to_sqlite():
    if not os.path.exists(JSON_PATH):
        return
    with _get_conn() as conn:
        cur = conn.execute("SELECT COUNT(*) AS count FROM matches")
        row = cur.fetchone()
        if row and row["count"]:
            return
        try:
            with open(JSON_PATH, "r", encoding="utf-8") as f:
                raw = json.load(f)
        except Exception as e:
            print(f"Error migrating JSON to SQLite: {e}")
            return
        if not isinstance(raw, dict) or not raw:
            return
        rows = []
        for mid, m in raw.items():
            if not isinstance(m, dict):
                continue
            rows.append(_match_to_row_dict(m, fallback_id=mid))
        if rows:
            _bulk_upsert_rows(conn, rows)
            print(f"Migrated {len(rows)} matches from JSON to SQLite.")

def _json_dumps(value):
    return json.dumps(value if value is not None else {}, ensure_ascii=False)

def _json_loads(value, default):
    if not value:
        return default
    try:
        return json.loads(value)
    except Exception:
        return default

def _match_to_row_dict(match, fallback_id=None):
    mid = str(match.get("id") or fallback_id or "")
    if not mid:
        return None
    return {
        "id": mid,
        "href": match.get("href", ""),
        "date": match.get("date", ""),
        "time": match.get("time", ""),
        "team1": match.get("team1", ""),
        "team2": match.get("team2", ""),
        "score1": match.get("score1", ""),
        "score2": match.get("score2", ""),
        "tournament": match.get("tournament", ""),
        "series": match.get("series", ""),
        "tournament_logo": match.get("tournament_logo", ""),
        "eta": match.get("eta", ""),
        "status": match.get("status", ""),
        "team1_logo": match.get("team1_logo", ""),
        "team2_logo": match.get("team2_logo", ""),
        "unix_timestamp": int(match.get("unix_timestamp") or 0),
        "bst_time": match.get("bst_time", ""),
        "maps_json": _json_dumps(match.get("maps", [])),
        "players_json": _json_dumps(match.get("players", {})),
        "last_updated": int(match.get("last_updated") or int(datetime.now().timestamp())),
    }

def _row_to_match(row):
    match = dict(row)
    match["unix_timestamp"] = int(match.get("unix_timestamp") or 0)
    match["last_updated"] = int(match.get("last_updated") or 0)
    match["maps"] = _json_loads(match.pop("maps_json", ""), [])
    match["players"] = _json_loads(match.pop("players_json", ""), {})
    return match

def _bulk_upsert_rows(conn, rows):
    if not rows:
        return 0
    conn.executemany(
        """
        INSERT INTO matches (
            id, href, date, time, team1, team2, score1, score2, tournament, series,
            tournament_logo, eta, status, team1_logo, team2_logo, unix_timestamp,
            bst_time, maps_json, players_json, last_updated
        ) VALUES (
            :id, :href, :date, :time, :team1, :team2, :score1, :score2, :tournament, :series,
            :tournament_logo, :eta, :status, :team1_logo, :team2_logo, :unix_timestamp,
            :bst_time, :maps_json, :players_json, :last_updated
        )
        ON CONFLICT(id) DO UPDATE SET
            href=excluded.href,
            date=excluded.date,
            time=excluded.time,
            team1=excluded.team1,
            team2=excluded.team2,
            score1=excluded.score1,
            score2=excluded.score2,
            tournament=excluded.tournament,
            series=excluded.series,
            tournament_logo=CASE WHEN COALESCE(excluded.tournament_logo, '') != '' THEN excluded.tournament_logo ELSE matches.tournament_logo END,
            eta=excluded.eta,
            status=excluded.status,
            team1_logo=CASE WHEN COALESCE(excluded.team1_logo, '') != '' THEN excluded.team1_logo ELSE matches.team1_logo END,
            team2_logo=CASE WHEN COALESCE(excluded.team2_logo, '') != '' THEN excluded.team2_logo ELSE matches.team2_logo END,
            unix_timestamp=CASE WHEN excluded.unix_timestamp != 0 THEN excluded.unix_timestamp ELSE matches.unix_timestamp END,
            bst_time=CASE WHEN COALESCE(excluded.bst_time, '') != '' THEN excluded.bst_time ELSE matches.bst_time END,
            maps_json=CASE WHEN COALESCE(excluded.maps_json, '[]') != '[]' AND COALESCE(excluded.maps_json, '') != '' THEN excluded.maps_json ELSE matches.maps_json END,
            players_json=CASE WHEN COALESCE(excluded.players_json, '{}') != '{}' AND COALESCE(excluded.players_json, '') != '' THEN excluded.players_json ELSE matches.players_json END,
            last_updated=excluded.last_updated
        """,
        rows,
    )
    return len(rows)

def load_json_matches(force_reload=False):
    global _cached_matches
    if _cached_matches is not None and not force_reload:
        return _cached_matches
        
    with _cache_lock:
        if _cached_matches is not None and not force_reload:
            return _cached_matches
        try:
            _ensure_db()
            with _get_conn() as conn:
                rows = conn.execute("SELECT * FROM matches").fetchall()
                _cached_matches = {row["id"]: _row_to_match(row) for row in rows}
        except Exception as e:
            print(f"Error loading matches DB: {e}")
            _cached_matches = {}
            
    return _cached_matches

def save_json_matches(matches):
    global _cached_matches
    try:
        _ensure_db()
        if isinstance(matches, dict) and ("id" in matches or "href" in matches):
            rows = [_match_to_row_dict(matches)]
        elif isinstance(matches, dict):
            rows = []
            for mid, match in matches.items():
                if isinstance(match, dict):
                    rows.append(_match_to_row_dict(match, fallback_id=mid))
        elif isinstance(matches, list):
            rows = [_match_to_row_dict(match) for match in matches if isinstance(match, dict)]
        else:
            rows = []

        rows = [r for r in rows if r]
        with _get_conn() as conn:
            _bulk_upsert_rows(conn, rows)
            conn.commit()
        with _cache_lock:
            _cached_matches = None
    except Exception as e:
        print(f"Error saving matches DB: {e}")

def upsert_match(match):
    save_json_matches(match)

def load_match(match_id):
    _ensure_db()
    with _get_conn() as conn:
        row = conn.execute("SELECT * FROM matches WHERE id = ?", (str(match_id),)).fetchone()
        return _row_to_match(row) if row else None

def load_matches(tournament_names=None, exclude_tournaments=None):
    _ensure_db()
    clauses = []
    params = []
    if tournament_names is not None:
        names = [str(t) for t in tournament_names if t]
        if names:
            placeholders = ",".join("?" for _ in names)
            clauses.append(f"tournament IN ({placeholders})")
            params.extend(names)
        else:
            return []
    if exclude_tournaments:
        names = [str(t) for t in exclude_tournaments if t]
        if names:
            placeholders = ",".join("?" for _ in names)
            clauses.append(f"tournament NOT IN ({placeholders})")
            params.extend(names)
    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    query = f"SELECT * FROM matches {where_sql}"
    with _get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return [_row_to_match(row) for row in rows]

def load_tournament_overview(exclude_tournaments=None):
    _ensure_db()
    clauses = []
    params = []
    if exclude_tournaments:
        names = [str(t) for t in exclude_tournaments if t]
        if names:
            placeholders = ",".join("?" for _ in names)
            clauses.append(f"tournament NOT IN ({placeholders})")
            params.extend(names)
    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    import time as _time
    now_ts = int(_time.time())
    query = f"""
        SELECT
            tournament,
            MAX(tournament_logo) AS tournament_logo,
            MIN(unix_timestamp) AS first_match,
            SUM(CASE
                -- Completed matches with no map data are missing stats
                WHEN LOWER(status) = 'completed' AND (maps_json IS NULL OR maps_json = '[]') THEN 1
                -- Completed matches with maps but no player stats (players_json has no "all" key data)
                WHEN LOWER(status) = 'completed' AND maps_json IS NOT NULL AND maps_json != '[]'
                     AND (players_json IS NULL OR players_json = '{{}}' OR players_json NOT LIKE '%"all"%') THEN 1
                -- Non-completed matches whose scheduled time has already passed need a re-scan
                WHEN LOWER(status) IN ('upcoming', 'live') AND unix_timestamp IS NOT NULL AND unix_timestamp > 0 AND unix_timestamp <= ? THEN 1
                -- Non-completed matches with no timestamp at all need a scan too
                WHEN LOWER(status) IN ('upcoming', 'live') AND (unix_timestamp IS NULL OR unix_timestamp = 0) THEN 1
                ELSE 0
            END) AS missing_stats
        FROM matches
        {where_sql}
        GROUP BY tournament
        ORDER BY tournament
    """
    params_with_ts = [now_ts] + params
    with _get_conn() as conn:
        rows = conn.execute(query, params_with_ts).fetchall()
    return [
        {
            "tournament": row["tournament"],
            "tournament_logo": row["tournament_logo"] or "",
            "first_match": int(row["first_match"] or 0),
            "fully_loaded": int(row["missing_stats"] or 0) == 0,
        }
        for row in rows
        if row["tournament"]
    ]

def download_image(url):
    if not url:
        return ""
    
    # Handle relative URLs (e.g. /img/vlr/tmp/vlr.png)
    if url.startswith("/") and not url.startswith("//"):
        url = "https://www.vlr.gg" + url
    
    # Ensure directory exists in case it was deleted by user while server is running
    os.makedirs(IMAGE_CACHE_DIR, exist_ok=True)
    
    # Get image filename from URL
    filename = url.split("/")[-1]
    if not filename:
        return url
        
    local_path = os.path.join(IMAGE_CACHE_DIR, filename)
    local_url = f"/static/images_cache/{filename}"
    
    if os.path.exists(local_path):
        return local_url
        
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        if response.status_code == 200:
            with open(local_path, "wb") as f:
                f.write(response.content)
            return local_url
    except Exception as e:
        print(f"Failed to download image {url}: {e}")
        
    return url

def fetch_match_detail_page(href):
    url = f"https://www.vlr.gg{href}"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.encoding = 'utf-8'
        if response.status_code != 200:
            return None
        
        soup = BeautifulSoup(response.text, "html.parser")
        
        team1_logo = ""
        team2_logo = ""
        
        match_header = soup.find("div", class_="match-header")
        if match_header:
            t1_link = match_header.find("a", class_="mod-1")
            if t1_link:
                img = t1_link.find("img")
                if img:
                    team1_logo = img.get("src") or ""
                    if team1_logo.startswith("//"):
                        team1_logo = "https:" + team1_logo
                        
            t2_link = match_header.find("a", class_="mod-2")
            if t2_link:
                img = t2_link.find("img")
                if img:
                    team2_logo = img.get("src") or ""
                    if team2_logo.startswith("//"):
                        team2_logo = "https:" + team2_logo
                        
            utc_div = match_header.find(class_="moment-tz-convert")
            data_utc_ts = utc_div.get("data-utc-ts") if utc_div else None
        else:
            t_logos = soup.find_all("img", alt=re.compile("team logo", re.I))
            if len(t_logos) >= 2:
                team1_logo = t_logos[0].get("src") or ""
                team2_logo = t_logos[1].get("src") or ""
                if team1_logo.startswith("//"): team1_logo = "https:" + team1_logo
                if team2_logo.startswith("//"): team2_logo = "https:" + team2_logo
                
            utc_div = soup.find(class_="moment-tz-convert")
            data_utc_ts = utc_div.get("data-utc-ts") if utc_div else None

        unix_timestamp = 0
        bst_time_str = "N/A"
        if data_utc_ts:
            try:
                # We know data-utc-ts is America/New_York time
                ny_tz = zoneinfo.ZoneInfo("America/New_York")
                dt_raw = datetime.strptime(data_utc_ts, "%Y-%m-%d %H:%M:%S")
                dt_ny = dt_raw.replace(tzinfo=ny_tz)
                dt_utc = dt_ny.astimezone(timezone.utc)
                unix_timestamp = int(dt_utc.timestamp())
                
                # Convert to BST (UTC+6)
                bst_tz = timezone(timedelta(hours=6))
                dt_bst = dt_utc.astimezone(bst_tz)
                bst_time_str = dt_bst.strftime("%Y-%m-%d %I:%M %p")
            except Exception as e:
                print(f"Error parsing date {data_utc_ts}: {e}")
                
        # Download team logos locally
        local_team1_logo = download_image(team1_logo) if team1_logo else ""
        local_team2_logo = download_image(team2_logo) if team2_logo else ""

        # Parse maps and player stats (completed matches only)
        maps = []
        # players_by_map: {"all": {team1:[], team2:[]}, "0": {...}, "1": {...}, ...}
        players_by_map = {}

        game_divs = soup.find_all("div", class_="vm-stats-game")
        map_index = 0

        def fetch_player_photo(player_href):
            """Fetch and cache a player's profile photo. Returns local URL or ''."""
            if not player_href:
                return ""
            try:
                r = requests.get(f"https://www.vlr.gg{player_href}", headers=HEADERS, timeout=8)
                if r.status_code != 200:
                    return ""
                ps = BeautifulSoup(r.text, "html.parser")
                avatar = ps.find("div", class_="wf-avatar")
                if not avatar:
                    return ""
                img = avatar.find("img")
                if not img:
                    return ""
                src = img.get("src", "")
                if src.startswith("//"): src = "https:" + src
                elif src.startswith("/"): src = "https://www.vlr.gg" + src
                return download_image(src) if src else ""
            except Exception:
                return ""

        def parse_player_tables(game_div):
            result = {"team1": [], "team2": []}
            # Find the new ovw-table divs first, fallback to tables if any
            tables = game_div.find_all("div", class_="ovw-table")
            is_div_table = True
            if not tables:
                tables = game_div.find_all("table")
                is_div_table = False
                
            for t_idx, table in enumerate(tables[:2]):
                team_key = "team1" if t_idx == 0 else "team2"
                
                if is_div_table:
                    rows = table.find_all("div", class_="ovw-row")
                    data_rows = [r for r in rows if "mod-head" not in r.get("class", [])]
                else:
                    data_rows = table.find_all("tr")[1:]
                    
                for row in data_rows:
                    if is_div_table:
                        tds = row.find_all("div", class_="ovw-cell")
                    else:
                        tds = row.find_all("td")
                        
                    if not tds:
                        continue
                        
                    def stat(td):
                        if not td:
                            return ""
                        s = td.find("span", class_="mod-both")
                        if s:
                            return s.text.strip()
                        return td.text.strip()
                        
                    if is_div_table:
                        player_td = tds[0]
                        a_tag = player_td.find("a")
                        player_name = ""
                        player_href = ""
                        if a_tag:
                            player_href = a_tag.get("href", "")
                            name_div = a_tag.find("div", class_="ovw-player-name")
                            if not name_div:
                                name_div = a_tag.find("div", class_="text-of")
                            player_name = name_div.text.strip() if name_div else a_tag.text.strip()
                        
                        agents = []
                        agents_container = player_td.find("div", class_="ovw-agents")
                        if agents_container:
                            for img in agents_container.find_all("img"):
                                aname = img.get("alt", "")
                                src = img.get("src", "")
                                if src.startswith("//"): src = "https:" + src
                                elif src.startswith("/"): src = "https://www.vlr.gg" + src
                                agents.append({"name": aname, "icon": download_image(src) if src else ""})
                        
                        def get_by_col(col_name, default_idx):
                            for cell in tds:
                                if cell.get("data-col") == col_name:
                                    return stat(cell)
                            if default_idx < len(tds):
                                return stat(tds[default_idx])
                            return ""
                            
                        rating = get_by_col("rating2", 1)
                        acs = get_by_col("acs", 2)
                        
                        k = ""
                        d = ""
                        a = ""
                        kda_cell = None
                        for cell in tds:
                            if "mod-kda" in cell.get("class", []):
                                kda_cell = cell
                                break
                        if not kda_cell and len(tds) > 3:
                            kda_cell = tds[3]
                            
                        if kda_cell:
                            kills_span = kda_cell.find("span", {"data-col": "kills"})
                            if kills_span:
                                k = stat(kills_span)
                            deaths_span = kda_cell.find("span", {"data-col": "deaths"})
                            if deaths_span:
                                d = stat(deaths_span)
                            assists_span = kda_cell.find("span", {"data-col": "assists"})
                            if assists_span:
                                a = stat(assists_span)
                            
                            if not k or not d or not a:
                                parts = [p.strip() for p in kda_cell.text.split("/") if p.strip()]
                                if len(parts) >= 3:
                                    k, d, a = parts[0], parts[1], parts[2]
                                    
                        kd_diff = get_by_col("kd-diff", 4)
                        kast = get_by_col("kast", 5)
                        adr = get_by_col("adr", 6)
                        hs = get_by_col("hsp", 7)
                        fk = get_by_col("fb", 8)
                        fd = get_by_col("fd", 9)
                        fk_diff = get_by_col("fk-diff", 10)
                    else:
                        if len(tds) < 10:
                            continue
                        player_td = tds[0]
                        a_tag = player_td.find("a")
                        player_name = ""
                        player_href = ""
                        if a_tag:
                            player_href = a_tag.get("href", "")
                            name_div = a_tag.find("div", class_="text-of")
                            player_name = name_div.text.strip() if name_div else a_tag.text.strip()
                        
                        agent_td = tds[1]
                        agents = []
                        for img in agent_td.find_all("img"):
                            aname = img.get("alt", "")
                            src = img.get("src", "")
                            if src.startswith("//"): src = "https:" + src
                            elif src.startswith("/"): src = "https://www.vlr.gg" + src
                            agents.append({"name": aname, "icon": download_image(src) if src else ""})
                            
                        rating = stat(tds[2]) if len(tds) > 2 else ""
                        acs = stat(tds[3]) if len(tds) > 3 else ""
                        k = stat(tds[4]) if len(tds) > 4 else ""
                        d = stat(tds[5]) if len(tds) > 5 else ""
                        a = stat(tds[6]) if len(tds) > 6 else ""
                        kd_diff = stat(tds[7]) if len(tds) > 7 else ""
                        kast = stat(tds[8]) if len(tds) > 8 else ""
                        adr = stat(tds[9]) if len(tds) > 9 else ""
                        hs = stat(tds[10]) if len(tds) > 10 else ""
                        fk = stat(tds[11]) if len(tds) > 11 else ""
                        fd = stat(tds[12]) if len(tds) > 12 else ""
                        fk_diff = stat(tds[13]) if len(tds) > 13 else ""

                    result[team_key].append({
                        "name": player_name,
                        "href": player_href,
                        "photo": "",
                        "agents": agents,
                        "rating": rating,
                        "acs": acs,
                        "k": k,
                        "d": d,
                        "a": a,
                        "kd_diff": kd_diff,
                        "kast": kast,
                        "adr": adr,
                        "hs": hs,
                        "fk": fk,
                        "fd": fd,
                        "fk_diff": fk_diff,
                    })
            return result

        for game_div in game_divs:
            game_id = game_div.get("data-game-id", "")
            if game_id == "all":
                players_by_map["all"] = parse_player_tables(game_div)
                continue

            header = game_div.find("div", class_="vm-stats-game-header")
            if not header:
                continue

            map_div = header.find("div", class_="map")
            map_name = ""
            if map_div:
                span = map_div.find("span")
                map_name = span.text.strip() if span else ""

            team_divs = header.find_all("div", class_="team")
            map_scores = []
            map_winner = None
            for i, td in enumerate(team_divs):
                score_div = td.find("div", class_="score")
                score = score_div.text.strip() if score_div else "0"
                won = "mod-win" in (score_div.get("class", []) if score_div else [])
                map_scores.append(score)
                if won:
                    map_winner = i

            maps.append({
                "name": map_name,
                "score1": map_scores[0] if len(map_scores) > 0 else "0",
                "score2": map_scores[1] if len(map_scores) > 1 else "0",
                "winner": map_winner
            })
            players_by_map[str(map_index)] = parse_player_tables(game_div)
            map_index += 1

        # Collect unique player hrefs across all map keys
        unique_players = {}  # href -> list of player dicts that need photo filled
        for map_data in players_by_map.values():
            for team_key in ("team1", "team2"):
                for p in map_data.get(team_key, []):
                    if p["href"] and not p.get("photo"):
                        unique_players.setdefault(p["href"], []).append(p)

        # Fetch photos in parallel (max 2 workers to avoid hammering vlr.gg)
        if unique_players:
            with ThreadPoolExecutor(max_workers=2) as executor:
                future_to_href = {executor.submit(fetch_player_photo, href): href
                                  for href in unique_players}
                for future in as_completed(future_to_href):
                    href = future_to_href[future]
                    try:
                        photo = future.result()
                        for p in unique_players[href]:
                            p["photo"] = photo
                    except Exception:
                        pass

        # Parse overall scores from match header
        overall_score1 = ""
        overall_score2 = ""
        vs_score_div = soup.find(class_="match-header-vs-score")
        if vs_score_div:
            # Filter spans to only those containing actual digits to bypass separator dashes/spans
            score_spans = [s for s in vs_score_div.find_all("span") if s.text.strip().isdigit()]
            if len(score_spans) >= 2:
                overall_score1 = score_spans[0].text.strip()
                overall_score2 = score_spans[1].text.strip()
            else:
                txt = vs_score_div.text.strip()
                parts = [p.strip() for p in re.split(r'[-\s–:\n]+', txt) if p.strip().isdigit()]
                if len(parts) >= 2:
                    overall_score1 = parts[0]
                    overall_score2 = parts[1]

        # Fall back to map wins if scores not found
        if (not overall_score1 or not overall_score2) and maps:
            s1 = 0
            s2 = 0
            for mp in maps:
                if mp.get("winner") == 0:
                    s1 += 1
                elif mp.get("winner") == 1:
                    s2 += 1
            if s1 > 0 or s2 > 0:
                overall_score1 = str(s1)
                overall_score2 = str(s2)

        # Determine status
        status = "Upcoming"
        vs_note = soup.find(class_="match-header-vs-note")
        vs_note_text = vs_note.text.strip().lower() if vs_note else ""
        if "live" in vs_note_text or soup.find(class_="match-header-vs-note-live"):
            status = "Live"
        elif overall_score1.isdigit() and overall_score2.isdigit():
            # If both scores are 0 and no maps are actually won, the match is upcoming
            if overall_score1 == "0" and overall_score2 == "0" and not any(mp.get("winner") is not None for mp in maps):
                status = "Upcoming"
            else:
                status = "Completed"
        else:
            status = "Upcoming"

        return {
            "team1_logo": local_team1_logo,
            "team2_logo": local_team2_logo,
            "unix_timestamp": unix_timestamp,
            "bst_time": bst_time_str,
            "maps": maps,
            "players": players_by_map,
            "score1": overall_score1,
            "score2": overall_score2,
            "status": status
        }
    except Exception as e:
        print(f"Error fetching detail page {url}: {e}")
        return None

def fetch_details_in_background(scraped_matches):
    # Acquire details lock to prevent concurrent details fetching threads
    if not details_lock.acquire(blocking=False):
        print("Details fetch already in progress. Skipping concurrent run.")
        return
        
    try:
        print("Background details thread started...")
        # Check which matches need detailed info (logos and exact timestamps)
        pending_ids = []
        for m in scraped_matches:
            mid = m["id"]
            
            # Helper to check if a cached image URL points to a file that actually exists
            def file_exists(local_url):
                if not local_url or not local_url.startswith("/static/images_cache/"):
                    return False
                filename = local_url.split("/")[-1]
                path = os.path.join(IMAGE_CACHE_DIR, filename)
                return os.path.exists(path)
                
            current = load_match(mid) or {}
            t1_logo = current.get("team1_logo", "")
            t2_logo = current.get("team2_logo", "")
            unix_ts = current.get("unix_timestamp")
            
            has_details = t1_logo and t2_logo and unix_ts
            files_exist = file_exists(t1_logo) and file_exists(t2_logo)
            existing_players = current.get("players", {})
            old_format = isinstance(existing_players, dict) and ("team1" in existing_players or "team2" in existing_players) and "all" not in existing_players and "0" not in existing_players
            missing_all = isinstance(existing_players, dict) and "all" not in existing_players
            missing_photos = any(
                not p.get("photo")
                for map_data in existing_players.values() if isinstance(map_data, dict)
                for team in ("team1", "team2")
                for p in map_data.get(team, [])
            )
            missing_new_stats = any(
                "kd_diff" not in p
                for map_data in existing_players.values() if isinstance(map_data, dict)
                for team in ("team1", "team2")
                for p in map_data.get(team, [])
            )
            has_stats = bool(current.get("maps")) and not old_format and not missing_all and not missing_photos and not missing_new_stats

            if not has_details or not files_exist or not has_stats:
                pending_ids.append((mid, m["href"]))
                
        # Fetch detailed info in parallel
        if pending_ids:
            print(f"Background Sync: Fetching offline details for {len(pending_ids)} new matches...")
            results = {}
            with ThreadPoolExecutor(max_workers=5) as executor:
                future_to_id = {executor.submit(fetch_match_detail_page, href): mid for mid, href in pending_ids}
                for future in as_completed(future_to_id):
                    mid = future_to_id[future]
                    try:
                        details = future.result()
                        if details:
                            results[mid] = details
                            print(f"Background Sync: Updated details/logos for match {mid}")
                    except Exception as e:
                        print(f"Background Sync: Exception fetching details for match {mid}: {e}")

            # Single save after all fetches complete
            if results:
                for mid, details in results.items():
                    current = load_match(mid) or {"id": mid}
                    current.update(details)
                    current["id"] = mid
                    current["last_updated"] = int(datetime.now().timestamp())
                    upsert_match(current)
        print("Background details thread finished.")
    finally:
        details_lock.release()


def _parse_matches_from_soup(soup, force_status=None):
    """Parse match items from a BeautifulSoup page object.
    
    Works for both /matches (upcoming/live) and /matches/results (completed).
    The HTML structure is identical on both pages.
    
    Args:
        soup: BeautifulSoup object of the page
        force_status: If set (e.g. "Completed"), override detected status for all matches.
                      Used for the results page where all matches are completed.
    
    Returns:
        List of match dicts with keys: id, href, date, time, team1, team2, 
        score1, score2, tournament, series, tournament_logo, eta, status
    """
    container = soup.find("div", class_="col")
    if not container:
        container = soup
        
    elements = container.find_all(class_=["wf-label", "wf-card"])
    
    current_date = "Unknown Date"
    parsed_matches = []
    
    for elem in elements:
        classes = elem.get("class", [])
        if "wf-label" in classes and "mod-large" in classes:
            current_date = elem.text.strip()
            current_date = " ".join(current_date.split())
        elif "wf-card" in classes:
            match_items = elem.find_all("a", class_="match-item")
            for match in match_items:
                href = match.get("href")
                match_id = re.search(r"/(\d+)/", href)
                if not match_id:
                    continue
                match_id = match_id.group(1)
                
                time_div = match.find("div", class_="match-item-time")
                time_text = time_div.text.strip() if time_div else "N/A"
                
                teams_divs = match.find_all("div", class_="match-item-vs-team")
                team_names = []
                team_scores = []
                for t_div in teams_divs:
                    name_div = t_div.find("div", class_="match-item-vs-team-name")
                    name = name_div.text.strip() if name_div else "TBD"
                    name = " ".join(name.split())
                    team_names.append(name)
                    
                    score_div = t_div.find("div", class_="match-item-vs-team-score")
                    score = score_div.text.strip() if score_div else ""
                    team_scores.append(score)
                
                tourney_div = match.find("div", class_="match-item-event")
                tourney_name = ""
                tourney_series = ""
                if tourney_div:
                    series_div = tourney_div.find("div", class_="match-item-event-series")
                    if series_div:
                        tourney_series = series_div.text.strip()
                        series_text = series_div.text
                        event_text = tourney_div.text
                        tourney_name = event_text.replace(series_text, "").strip()
                    else:
                        tourney_name = tourney_div.text.strip()
                
                tourney_name = " ".join(tourney_name.split())
                tourney_series = " ".join(tourney_series.split())
                
                logo_div = match.find("div", class_="match-item-icon")
                tourney_logo = ""
                if logo_div:
                    img = logo_div.find("img")
                    if img:
                        tourney_logo = img.get("src") or img.get("data-src") or ""
                        if tourney_logo.startswith("//"):
                            tourney_logo = "https:" + tourney_logo
                
                eta_div = match.find("div", class_="ml-eta")
                eta_text = eta_div.text.strip() if eta_div else ""
                
                status_div = match.find("div", class_="ml-status")
                status_text = status_div.text.strip() if status_div else ""
                
                # Determine status
                if force_status:
                    status = force_status
                elif "live" in eta_text.lower() or "live" in status_text.lower():
                    status = "Live"
                elif "completed" in status_text.lower():
                    status = "Completed"
                elif "upcoming" in status_text.lower():
                    status = "Upcoming"
                else:
                    status = "Completed" if not eta_text else "Upcoming"
                
                parsed_matches.append({
                    "id": match_id,
                    "href": href,
                    "date": current_date,
                    "time": time_text,
                    "team1": team_names[0] if len(team_names) > 0 else "TBD",
                    "team2": team_names[1] if len(team_names) > 1 else "TBD",
                    "score1": team_scores[0] if len(team_scores) > 0 else "",
                    "score2": team_scores[1] if len(team_scores) > 1 else "",
                    "tournament": tourney_name,
                    "series": tourney_series,
                    "tournament_logo": tourney_logo,
                    "eta": eta_text,
                    "status": status
                })
                
    return parsed_matches


def _fetch_page(url, timeout=10):
    """Fetch a page and return a BeautifulSoup object, or None on failure."""
    try:
        response = requests.get(url, headers=HEADERS, timeout=timeout)
        response.encoding = 'utf-8'
        if response.status_code != 200:
            print(f"Failed to fetch {url}. Server returned status: {response.status_code}")
            return None
        return BeautifulSoup(response.text, "html.parser")
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None


def _upsert_matches_to_db(scraped_matches):
    """Insert or update scraped matches into SQLite."""
    
    # Download tournament logos locally
    for m in scraped_matches:
        if m["tournament_logo"]:
            m["tournament_logo"] = download_image(m["tournament_logo"])

    # Load ignore list
    ignore_names = _load_ignore_names()

    main_rows = []
    ignored_rows = []
    now_ts = int(datetime.now().timestamp())
    for m in scraped_matches:
        row = {
            "id": m["id"],
            "href": m["href"],
            "date": m.get("date", ""),
            "time": m.get("time", ""),
            "team1": m.get("team1", ""),
            "team2": m.get("team2", ""),
            "score1": m.get("score1", ""),
            "score2": m.get("score2", ""),
            "tournament": m.get("tournament", ""),
            "series": m.get("series", ""),
            "tournament_logo": m.get("tournament_logo", ""),
            "eta": m.get("eta", ""),
            "status": m.get("status", ""),
            "team1_logo": "",
            "team2_logo": "",
            "unix_timestamp": int(m.get("unix_timestamp") or 0),
            "bst_time": "",
            "maps_json": _json_dumps([]),
            "players_json": _json_dumps({}),
            "last_updated": now_ts,
        }
        if m.get("tournament") in ignore_names:
            ignored_rows.append(row)
        else:
            main_rows.append(row)

    _ensure_db()
    if main_rows:
        with _get_conn() as conn:
            _bulk_upsert_rows(conn, main_rows)
            conn.commit()

    if ignored_rows:
        _ensure_ignored_db()
        with sqlite3.connect(IGNORED_DB_PATH, timeout=30) as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            _bulk_upsert_rows(conn, ignored_rows)
            conn.commit()


RESULTS_PAGES = 5  # Default number of result pages to fetch (each page ~20 matches)

def fetch_and_update_matches(pages=None, start_page=1, end_page=None):
    """Fetch upcoming/live matches AND recent completed results from VLR.gg."""
    if end_page is None:
        end_page = pages if pages is not None else RESULTS_PAGES
    if start_page < 1:
        start_page = 1
    if end_page < start_page:
        end_page = start_page
    # Acquire sync lock to prevent concurrent main page fetches
    if not sync_lock.acquire(blocking=False):
        print("Sync already in progress. Skipping.")
        return False
    
    try:
        all_scraped = []
        
        # 1. Fetch upcoming/live matches from /matches
        soup_upcoming = _fetch_page("https://www.vlr.gg/matches")
        if soup_upcoming:
            upcoming_matches = _parse_matches_from_soup(soup_upcoming)
            all_scraped.extend(upcoming_matches)
            print(f"Scraped {len(upcoming_matches)} upcoming/live matches from /matches")
        else:
            print("Warning: Could not fetch upcoming matches page")
        
        # 2. Fetch multiple pages of completed results from /matches/results
        for page in range(start_page, end_page + 1):
            url = f"https://www.vlr.gg/matches/results?page={page}"
            soup_results = _fetch_page(url)
            if soup_results:
                completed_matches = _parse_matches_from_soup(soup_results, force_status="Completed")
                all_scraped.extend(completed_matches)
                print(f"Scraped {len(completed_matches)} completed matches from /matches/results?page={page}")
            else:
                print(f"Warning: Could not fetch results page {page}")
        
        if not all_scraped:
            print("No matches scraped from either page.")
            return False
        
        # Upsert all scraped matches into SQLite
        _upsert_matches_to_db(all_scraped)

        return True
    except Exception as e:
        print(f"Offline sync failed: {e}")
        return False
    finally:
        sync_lock.release()

def get_matches_for_display(tournament_names=None, exclude_tournaments=None):
    matches_list = load_matches(tournament_names=tournament_names, exclude_tournaments=exclude_tournaments)
    
    # Sort: Live matches first, then Upcoming matches (by unix_timestamp asc), then Completed matches (by unix_timestamp desc).
    def sort_key(m):
        status = m.get("status", "Upcoming")
        if status == "Live":
            status_order = 1
        elif status == "Upcoming":
            status_order = 2
        else:
            status_order = 3
            
        unix_ts = m.get("unix_timestamp", 0) or 0
        
        if status_order == 3:
            return (status_order, -unix_ts)
        else:
            return (status_order, unix_ts)
            
    matches_list.sort(key=sort_key)
    
    # Process for template rendering
    for m in matches_list:
        if m.get("unix_timestamp"):
            bst_tz = timezone(timedelta(hours=6))
            dt_bst = datetime.fromtimestamp(m["unix_timestamp"], tz=timezone.utc).astimezone(bst_tz)
            m["formatted_bst"] = dt_bst.strftime("%b %d, %Y - %I:%M %p")
            m["js_timestamp"] = m["unix_timestamp"] * 1000
        else:
            m["formatted_bst"] = "N/A"
            m["js_timestamp"] = 0
            
    return matches_list


def load_missing_stats(delay=1.5):
    """Find all completed matches that are missing stats, and load their details.

    Fetches ONE match at a time with a small delay between requests instead of
    fetching many in parallel. Fetching everything at once made vlr.gg rate-limit
    / temporarily block this IP (connection timeouts). If several requests fail in
    a row, we stop early — that usually means we're blocked — and the user can run
    it again later.
    """
    _ensure_db()
    # Query completed matches with missing maps or players stats
    query = """
        SELECT id, href FROM matches 
        WHERE LOWER(status) = 'completed' 
          AND (
            maps_json IS NULL OR maps_json = '[]' OR maps_json = ''
            OR players_json IS NULL OR players_json = '{}' OR players_json = '' OR players_json NOT LIKE '%"all"%'
          )
    """
    with _get_conn() as conn:
        rows = conn.execute(query).fetchall()
    
    if not rows:
        print("No completed matches missing stats.")
        return
        
    pending = [(row["id"], row["href"]) for row in rows if row["href"]]
    if not pending:
        return
        
    print(f"Loading missing stats for {len(pending)} completed matches...")
    results = {}
    consecutive_failures = 0
    for mid, href in pending:
        details = fetch_match_detail_page(href)
        if details:
            results[mid] = details
            print(f"Loaded missing stats for match {mid}")
            consecutive_failures = 0
            time.sleep(delay)
        else:
            consecutive_failures += 1
            print(f"Failed to load missing stats for match {mid} (consecutive failures: {consecutive_failures})")
            if consecutive_failures >= 3:
                print("Too many consecutive failures — vlr.gg may be rate-limiting. Stopping; run again later.")
                break
            # Back off longer after a failure to give vlr.gg time to recover
            time.sleep(delay * 3)

    if results:
        with _get_conn() as conn:
            for mid, details in results.items():
                current = load_match(mid) or {"id": mid}
                current.update(details)
                current["id"] = mid
                current["last_updated"] = int(datetime.now().timestamp())
                row_dict = _match_to_row_dict(current)
                if row_dict:
                    _bulk_upsert_rows(conn, [row_dict])
            conn.commit()
        global _cached_matches
        with _cache_lock:
            _cached_matches = None


# ============================================================================
# Tournament Browser (browse VLR.gg tournaments and add them to the sidebar)
# ============================================================================

TOURNAMENTS_CACHE_PATH = os.path.join(BASE_DIR, "tournaments_cache.json")
TOURNAMENTS_CACHE_TTL = 24 * 60 * 60  # seconds — re-fetch from VLR.gg at most once per day
tournaments_cache_lock = threading.Lock()


# Flag codes used on the /events page's `mod-location` items, mapped to region names.
# `un` = international/mixed regions (VLR.gg's flag for events spanning multiple regions).
FLAG_TO_REGION = {
    "us": "United States", "ca": "Canada", "br": "Brazil", "mx": "Mexico",
    "gb": "United Kingdom", "fr": "France", "de": "Germany", "es": "Spain",
    "eu": "Europe", "au": "Australia", "cn": "China", "kr": "Korea",
    "jp": "Japan", "tw": "Taiwan", "in": "India", "id": "Indonesia",
    "vn": "Vietnam", "sa": "Saudi Arabia", "un": "International",
}


def _parse_tournament_items(soup):
    """Parse tournament cards from the VLR.gg /events page (formerly /tournaments).

    Resilient parser: accepts the current item shape (`a.wf-card.event-item` with
    `event-item-title` / `event-item-desc-item-status` / `event-item-desc-item`
    blocks and a flag icon), the older shapes (`event-item-name`,
    `event-item-status`, `event-item-date`, region from a `wf-card` header), or any
    anchor pointing at an /event/ page as a last resort. Unknown markup degrades
    gracefully instead of aborting.
    """
    tournaments = []
    seen = set()

    items = soup.select("a.event-item, div.event-item")
    if not items:
        # Last resort: any anchor whose href points at an event page
        items = [a for a in soup.find_all("a", href=True)
                 if re.search(r"/event/\d+/", a.get("href", ""))]

    for item in items:
        a_tag = item if item.name == "a" else item.find("a", href=True)
        if a_tag is None:
            continue
        href = a_tag.get("href", "") or ""
        m = re.search(r"/event/(\d+)/", href)
        if not m:
            continue
        tid = m.group(1)
        if tid in seen:
            continue
        seen.add(tid)

        # Logo (any img inside the item — current markup puts it in event-item-thumb)
        logo = ""
        img = item.find("img")
        if img:
            logo = img.get("src") or img.get("data-src") or ""
            if logo.startswith("//"):
                logo = "https:" + logo
            elif logo.startswith("/"):
                logo = "https://www.vlr.gg" + logo

        # Name — current `event-item-title` first, then older fallbacks
        name = ""
        name_div = item.find("div", class_="event-item-title")
        if not name_div:
            name_div = item.find("div", class_="event-item-name")
        if name_div:
            name = name_div.get_text(" ", strip=True)
        if not name:
            h4 = item.find("h4")
            if h4:
                name = h4.get_text(" ", strip=True)
        if not name:
            info_div = item.find("div", class_="event-item-info")
            if info_div:
                name = info_div.get_text(" ", strip=True)
        if not name:
            name = item.get("title") or item.get("aria-label") or ""
        if not name and img:
            name = img.get("alt") or ""
        name = " ".join(name.split())
        if not name:
            continue

        desc = ""
        desc_div = item.find("div", class_="event-item-desc")
        if desc_div:
            desc = " ".join(desc_div.get_text(" ", strip=True).split())

        # Status — current: span.event-item-desc-item-status (text: ongoing/upcoming/...)
        status = ""
        status_span = item.find("span", class_="event-item-desc-item-status")
        if status_span:
            status = " ".join(status_span.get_text(" ", strip=True).split())
        if not status:
            status_div = item.find("div", class_="event-item-status")
            if status_div:
                status_txt = status_div.find("span", class_="event-item-status-text")
                raw = status_txt.get_text(" ", strip=True) if status_txt else status_div.get_text(" ", strip=True)
                status = " ".join(raw.split())
        if status:
            status = status.capitalize()

        # Dates — current: div.event-item-desc-item.mod-dates (drop the "Dates" label)
        date = ""
        date_div = item.find("div", class_="event-item-desc-item mod-dates")
        if date_div:
            label = date_div.find("div", class_="event-item-desc-item-label")
            if label:
                label.extract()
            date = " ".join(date_div.get_text(" ", strip=True).split())
        if not date:
            date_div = item.find("div", class_="event-item-date")
            if date_div:
                date = " ".join(date_div.get_text(" ", strip=True).split())

        # Region — current: flag icon in the mod-location block; older: wf-card header
        region = ""
        flag_icon = item.find("i", class_="flag")
        if flag_icon:
            flag_cls = [c for c in (flag_icon.get("class") or []) if c.startswith("mod-")]
            if flag_cls:
                region = FLAG_TO_REGION.get(flag_cls[0][4:], "") or flag_cls[0][4:].upper()
        if not region:
            card = item.find_parent("div", class_="wf-card")
            if card:
                header = card.find(class_="wf-card-header") or card.find(class_="wf-title") or card.find("h4")
                if header:
                    region = " ".join(header.get_text(" ", strip=True).split())

        tournaments.append({
            "id": tid,
            "name": name,
            "logo": logo,
            "href": href,
            "region": region,
            "desc": desc,
            "status": status,
            "date": date,
        })
    return tournaments


def get_tournaments(refresh=False, pages=1):
    """Return a dict with the VLR.gg tournament list and fetch metadata.

    The /events listing is paginated (~50 tournaments per page, ~59 pages
    total). `pages` is how many pages should be available: a fresh cache that
    already covers that many pages is returned untouched; otherwise only the
    *missing* pages are fetched (page 1 is re-fetched only on refresh=True) and
    merged into the cache. Fetching is sequential with a short pause between
    pages so we never hammer vlr.gg.

    Returns {"tournaments": [...], "fetched_at": int, "error": str|None,
             "total_pages": int, "pages_fetched": int}. `error` is None on a
    clean load; set to a short user-facing message when something failed
    (partial load, fallback to cache, etc.) so the UI can explain it.
    """
    try:
        pages = max(1, int(pages))
    except (TypeError, ValueError):
        pages = 1

    with tournaments_cache_lock:
        cache = {}
        if os.path.exists(TOURNAMENTS_CACHE_PATH):
            try:
                with open(TOURNAMENTS_CACHE_PATH, "r", encoding="utf-8") as f:
                    cache = json.load(f)
            except Exception:
                cache = {}

        fetched_at = int(cache.get("fetched_at") or 0)
        cached_list = cache.get("tournaments") or []
        cached_pages = int(cache.get("pages") or (1 if cached_list else 0))
        cached_total = int(cache.get("total_pages") or 1)
        now = int(time.time())
        fresh = bool(cached_list) and (now - fetched_at) < TOURNAMENTS_CACHE_TTL

        if not refresh and fresh and cached_pages >= pages:
            # Cache already covers the requested pages. If it was written before
            # the total page count was known (old format), learn it from page 1
            # once and store it so the UI can show "page X of Y".
            if "total_pages" not in cache:
                try:
                    soup, _ = _fetch_tournaments_page(1)
                    if soup is not None:
                        cached_total = max(_get_total_pages(soup), cached_pages)
                        cache["total_pages"] = cached_total
                        with open(TOURNAMENTS_CACHE_PATH, "w", encoding="utf-8") as f:
                            json.dump(cache, f, ensure_ascii=False, indent=2)
                except Exception as e:
                    print(f"Could not learn total tournament pages: {e}")
            return {
                "tournaments": cached_list,
                "fetched_at": fetched_at,
                "error": None,
                "total_pages": cached_total,
                "pages_fetched": cached_pages,
            }

        if not refresh and fresh:
            # Normal "load more": keep the cached list, fetch only missing pages
            all_tournaments = list(cached_list)
            seen = {t.get("id") for t in all_tournaments}
            start_page = cached_pages + 1
            total_pages = cached_total
        else:
            all_tournaments = []
            seen = set()
            start_page = 1
            total_pages = 1
            fetched_at = now

        highest_ok = start_page - 1
        last_error = None
        for page in range(start_page, pages + 1):
            soup, fetch_error = _fetch_tournaments_page(page)
            if soup is None:
                last_error = fetch_error
                print(f"Could not fetch tournaments page {page} ({fetch_error}); stopping.")
                break
            if page == 1:
                total_pages = _get_total_pages(soup)
            parsed = _parse_tournament_items(soup)
            added = 0
            for t in parsed:
                tid = t.get("id")
                if tid and tid not in seen:
                    seen.add(tid)
                    all_tournaments.append(t)
                    added += 1
            highest_ok = page
            if added == 0 and page > 1:
                print(f"No new tournaments on page {page}; reached the end of the list.")
                break
            if page < pages:
                time.sleep(1)  # gentle pacing between pages

        if all_tournaments:
            pages_loaded = highest_ok if refresh else max(highest_ok, cached_pages)
            cache_total = max(total_pages, pages_loaded)
            # Only reset the freshness clock when something new was actually
            # loaded (a no-op load-more retry shouldn't extend the 24h TTL)
            saved_at = now if (refresh or pages_loaded > cached_pages) else fetched_at
            try:
                with open(TOURNAMENTS_CACHE_PATH, "w", encoding="utf-8") as f:
                    json.dump({
                        "fetched_at": saved_at,
                        "pages": pages_loaded,
                        "total_pages": cache_total,
                        "tournaments": all_tournaments,
                    }, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print(f"Error saving tournaments cache: {e}")
            if last_error:
                msg = f"Loaded {pages_loaded} page(s); couldn't fetch more ({last_error})."
            else:
                msg = None
            print(f"Loaded {len(all_tournaments)} tournaments ({pages_loaded} page(s)) from VLR.gg")
            return {
                "tournaments": all_tournaments,
                "fetched_at": saved_at,
                "error": msg,
                "total_pages": cache_total,
                "pages_fetched": pages_loaded,
            }

        # Nothing fetched/parsed — fall back to any cached list, then give up
        if cached_list:
            print("Could not fetch tournaments; using cached list.")
            return {
                "tournaments": cached_list,
                "fetched_at": fetched_at,
                "error": f"Couldn't reach VLR.gg ({last_error or 'unknown error'}) — showing the cached list.",
                "total_pages": cached_total,
                "pages_fetched": cached_pages,
            }
        return {
            "tournaments": [],
            "fetched_at": 0,
            "error": f"Couldn't reach VLR.gg ({last_error or 'unknown error'}).",
            "total_pages": total_pages,
            "pages_fetched": 0,
        }


def _fetch_with_retry(url, timeout=25, attempts=3):
    """Fetch a page with browser-like headers, retries and backoff.

    vlr.gg sometimes drops a single connection (especially right after it has
    been throttling an IP), so one-shot requests are fragile. This retries a
    few times with increasing delays and returns (soup_or_None, error_detail)
    where error_detail is a short human-readable reason (HTTP status, timeout,
    connection failure, exception) for the UI.
    """
    headers = dict(HEADERS)
    headers.setdefault("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
    headers.setdefault("Accept-Language", "en-US,en;q=0.9")

    last_error = None
    for attempt in range(1, attempts + 1):
        try:
            response = requests.get(url, headers=headers, timeout=timeout)
            if response.status_code == 200:
                response.encoding = "utf-8"
                return BeautifulSoup(response.text, "html.parser"), None
            last_error = f"HTTP {response.status_code}"
            print(f"Failed to fetch {url}. Server returned status: {response.status_code} (attempt {attempt}/{attempts})")
        except requests.exceptions.Timeout:
            last_error = f"timed out after {timeout}s"
            print(f"Timeout fetching {url} (attempt {attempt}/{attempts})")
        except requests.exceptions.SSLError:
            last_error = "SSL error"
            print(f"SSL error fetching {url} (attempt {attempt}/{attempts})")
        except requests.exceptions.ConnectionError:
            last_error = "connection failed"
            print(f"Connection error fetching {url} (attempt {attempt}/{attempts})")
        except Exception as e:
            # Keep the detail short — a raw urllib3 message is a wall of text in the UI
            last_error = (f"{type(e).__name__}: {e}")[:80]
            print(f"Error fetching {url}: {e} (attempt {attempt}/{attempts})")
        if attempt < attempts:
            time.sleep(2 * attempt)  # 2s, then 4s backoff
    return None, last_error or "unknown error"


def _fetch_tournaments_page(page=1):
    """Fetch one page of the VLR.gg /events listing (the tournaments page).

    The listing is paginated — roughly 50 tournaments per page, ~59 pages total.
    Page 1 is the bare /events URL; later pages are /events/?page=N. Every page
    is large, so each gets a long timeout plus retries with backoff; a single
    dropped/timeout request must not kill the fetch (see _fetch_with_retry).

    Returns (soup_or_None, error_detail_or_None).
    """
    url = "https://www.vlr.gg/events" if page <= 1 else f"https://www.vlr.gg/events/?page={page}"
    return _fetch_with_retry(url)


def _get_total_pages(soup):
    """Best-effort count of /events listing pages from its pagination links."""
    if soup is None:
        return 1
    try:
        nums = []
        for a in soup.find_all("a", href=True):
            m = re.search(r"/events/?\?page=(\d+)", a.get("href", "") or "")
            if m:
                nums.append(int(m.group(1)))
        return max(nums) if nums else 1
    except Exception:
        return 1


def get_known_tournament_names():
    """Set of tournament names that already exist in the main matches DB."""
    _ensure_db()
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT DISTINCT tournament FROM matches WHERE tournament IS NOT NULL AND tournament != ''"
        ).fetchall()
    return {row["tournament"] for row in rows}


def _parse_event_matches_from_soup(soup):
    """Parse match items from a VLR.gg event page.

    Event pages use a different layout from /matches: completed/live bracket
    matches are `a.bracket-item` (scores + a `data-utc-ts` unix timestamp on the
    status div), while upcoming matches appear as `a.wf-module-item` sidebar
    entries (team names + an eta countdown, no timestamp).

    Returns a list of match dicts with the same keys as `_parse_matches_from_soup`.
    """
    parsed = []
    seen = set()
    # Only match-page links (href like /729664/slug) — NOT /team/.., /player/..,
    # /event/.. or other internal links that also contain digits
    links = [a for a in soup.find_all("a", href=True)
             if re.match(r"^/(\d+)/", a.get("href", ""))]
    for a in links:
        href = a.get("href", "")
        m = re.match(r"^/(\d+)/", href)
        if not m:
            continue
        mid = m.group(1)
        if mid in seen:
            continue
        seen.add(mid)
        classes = a.get("class", []) or []

        team_names = []
        team_scores = []
        series = ""
        eta = ""
        unix_ts = 0
        status = ""

        if "bracket-item" in classes:
            # Completed / live bracket match
            for tdiv in a.find_all("div", class_="bracket-item-team"):
                name_div = tdiv.find("div", class_="bracket-item-team-name")
                if name_div:
                    span = name_div.find("span")
                    name = span.get_text(" ", strip=True) if span else name_div.get_text(" ", strip=True)
                    team_names.append(" ".join(name.split()))
                score_div = tdiv.find("div", class_="bracket-item-team-score")
                team_scores.append(score_div.get_text(" ", strip=True) if score_div else "")
            st_div = a.find("div", class_="bracket-item-status")
            if st_div:
                ts = st_div.get("data-utc-ts") or ""
                if ts.isdigit():
                    unix_ts = int(ts)
                eta = " ".join(st_div.get_text(" ", strip=True).split())
                if "live" in " ".join(st_div.get("class", []) or []).lower():
                    status = "Live"
        else:
            # Upcoming sidebar match (wf-module-item)
            series_div = a.find("div", class_="event-sidebar-matches-series")
            if series_div:
                series = " ".join(series_div.get_text(" ", strip=True).split())
            for tdiv in a.find_all("div", class_="event-sidebar-matches-team"):
                name_div = tdiv.find("div", class_="name")
                if name_div:
                    span = name_div.find("span")
                    name = span.get_text(" ", strip=True) if span else name_div.get_text(" ", strip=True)
                    team_names.append(" ".join(name.split()))
                score_div = tdiv.find("div", class_="score")
                team_scores.append(score_div.get_text(" ", strip=True) if score_div else "")
                if not eta:
                    eta_div = tdiv.find("div", class_="eta")
                    if eta_div:
                        eta = " ".join(eta_div.get_text(" ", strip=True).split())

        if not team_names:
            continue

        # Normalize placeholder scores ("–", "—") to empty; TBD teams to "TBD"
        scores = ["" if s in ("–", "—", "-") else s for s in team_scores]
        scores = (scores + ["", ""])[:2]
        team_names = ["TBD" if not n else n for n in team_names]
        team_names = (team_names + ["TBD", "TBD"])[:2]

        # Status: Live if flagged, else Completed if any numeric score, else Upcoming
        if not status:
            if any(s.isdigit() for s in scores):
                status = "Completed"
            else:
                status = "Upcoming"

        parsed.append({
            "id": mid,
            "href": href,
            "date": "",
            "time": "",
            "team1": team_names[0],
            "team2": team_names[1],
            "score1": scores[0],
            "score2": scores[1],
            "tournament": "",
            "series": series,
            "tournament_logo": "",
            "eta": eta,
            "status": status,
            "unix_timestamp": unix_ts,
        })
    return parsed


def add_tournament(tournament):
    """Fetch all matches of a tournament from its VLR.gg event page and upsert them.

    `tournament` is one item from get_tournaments() (has href/name). Returns
    (added_count, error_or_None). Uses the same lightweight listing parse as the
    sync button — player stats are NOT fetched here.

    Matches are stored under the FULL event name (e.g. "VCT 2026 — EMEA Stage 2")
    rather than the page parser's series-stripped stage name, so the sidebar shows
    the same name the user selected and the "added" badge / un-hide / un-ignore
    logic all key off that name consistently.
    """
    href = (tournament or {}).get("href", "")
    if not href:
        return 0, "No event link for this tournament."
    url = f"https://www.vlr.gg{href}" if href.startswith("/") else href
    # Event pages can be large (100+ matches) — long timeout plus retries.
    soup, fetch_error = _fetch_with_retry(url, timeout=25)
    if soup is None:
        print(f"Failed to fetch event page {url}: {fetch_error}")
        return 0, f"Could not reach the tournament page ({fetch_error})."
    matches = _parse_matches_from_soup(soup) or _parse_event_matches_from_soup(soup)
    if not matches:
        print(f"No matches parsed from event page {url}")
        return 0, "No matches found on the tournament page."
    event_name = (tournament.get("name") or "").strip()
    if event_name:
        for m in matches:
            m["tournament"] = event_name
    # Event logo: prefer the one from the /events list item; fall back to the
    # event page header so the sidebar shows a logo even for legacy callers
    # that don't send one.
    logo = (tournament.get("logo") or "").strip()
    if not logo:
        header_img = soup.select_one("div.event-header img")
        if header_img:
            logo = header_img.get("src") or header_img.get("data-src") or ""
    if logo:
        if logo.startswith("//"):
            logo = "https:" + logo
        elif logo.startswith("/"):
            logo = "https://www.vlr.gg" + logo
        for m in matches:
            m["tournament_logo"] = logo
    _upsert_matches_to_db(matches)
    print(f"Added {len(matches)} matches for tournament '{event_name}'")
    return len(matches), None


def _loose_name_match(a, b):
    """Loose tournament-name match: exact, or containment either direction.

    Names can differ slightly between the /events list and the DB (e.g. "VCT
    2026: EMEA Stage 2" vs "Stage 2 W3"); a minimum length avoids false
    positives on short shared substrings.
    """
    if not a or not b:
        return False
    a = a.strip().lower()
    b = b.strip().lower()
    if a == b:
        return True
    return len(a) >= 8 and len(b) >= 8 and (a in b or b in a)


def backfill_tournament_logos():
    """Fill empty tournament_logo values using the cached /events tournament list.

    Tournaments added before logos were stored (or whose matches never carried
    an icon) have an empty tournament_logo in the DB, so the sidebar shows a
    placeholder instead of the real logo. This matches each such tournament
    against the cached /events list and stores the logo locally, without
    re-adding anything or hitting VLR.gg for every tournament.

    Called after each sync so pressing the sync button eventually fills all
    missing logos. Returns the number of tournaments filled.
    """
    _ensure_db()
    with _get_conn() as conn:
        rows = conn.execute(
            """
            SELECT tournament
            FROM matches
            WHERE tournament IS NOT NULL AND tournament != ''
            GROUP BY tournament
            HAVING MAX(CASE WHEN tournament_logo IS NOT NULL AND tournament_logo != '' THEN 1 ELSE 0 END) = 0
            """
        ).fetchall()
    names = [r["tournament"] for r in rows]
    if not names:
        return 0

    result = get_tournaments(pages=1)
    tournaments = result["tournaments"]
    if not tournaments:
        return 0

    # Prefer the most specific (longest) cache name so generic DB names like
    # "VCT 2026" don't grab an arbitrary league's logo.
    updates = []
    for name in names:
        hits = [t for t in tournaments if _loose_name_match(name, t.get("name", ""))]
        if not hits:
            continue
        hit = max(hits, key=lambda t: len(t.get("name", "")))
        if not hit.get("logo"):
            continue
        local = download_image(hit["logo"])
        if not local or not local.startswith("/static/images_cache/"):
            continue
        updates.append((local, name))
    if updates:
        with _get_conn() as conn:
            conn.executemany(
                "UPDATE matches SET tournament_logo = ? WHERE tournament = ? AND (tournament_logo IS NULL OR tournament_logo = '')",
                updates,
            )
            conn.commit()
        for _, name in updates:
            print(f"Backfilled tournament logo for '{name}'")
    return len(updates)

