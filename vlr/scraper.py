import os
import re
import json
import requests
import threading
from bs4 import BeautifulSoup
from datetime import datetime, timezone, timedelta
import zoneinfo
from concurrent.futures import ThreadPoolExecutor, as_completed

JSON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "matches.json")
IMAGE_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "images_cache")

# Ensure image cache directory exists
os.makedirs(IMAGE_CACHE_DIR, exist_ok=True)

# Locks to prevent concurrent sync issues
sync_lock = threading.Lock()
details_lock = threading.Lock()
_cache_lock = threading.Lock()
_cached_matches = None

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def load_json_matches(force_reload=False):
    global _cached_matches
    if _cached_matches is not None and not force_reload:
        return _cached_matches
        
    with _cache_lock:
        if _cached_matches is not None and not force_reload:
            return _cached_matches
            
        if not os.path.exists(JSON_PATH):
            _cached_matches = {}
            return _cached_matches
        try:
            with open(JSON_PATH, "r", encoding="utf-8") as f:
                _cached_matches = json.load(f)
        except Exception as e:
            print(f"Error loading JSON: {e}")
            _cached_matches = {}
            
    return _cached_matches

def save_json_matches(matches):
    global _cached_matches
    with _cache_lock:
        _cached_matches = matches
        
    tmp_path = JSON_PATH + ".tmp"
    try:
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(matches, f, indent=4, ensure_ascii=False)
        # Atomic rename with retries for transient locks (common on Windows)
        for attempt in range(5):
            try:
                os.replace(tmp_path, JSON_PATH)
                break
            except PermissionError:
                time.sleep(0.1)
        else:
            os.replace(tmp_path, JSON_PATH)
    except Exception as e:
        print(f"Error saving JSON: {e}")
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except:
                pass

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
            tables = game_div.find_all("table")
            for t_idx, table in enumerate(tables[:2]):
                team_key = "team1" if t_idx == 0 else "team2"
                for row in table.find_all("tr")[1:]:
                    tds = row.find_all("td")
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
                    # Multiple agents
                    agent_td = tds[1]
                    agents = []
                    for img in agent_td.find_all("img"):
                        aname = img.get("alt", "")
                        src = img.get("src", "")
                        if src.startswith("//"): src = "https:" + src
                        elif src.startswith("/"): src = "https://www.vlr.gg" + src
                        agents.append({"name": aname, "icon": download_image(src) if src else ""})
                    def stat(td):
                        if not td:
                            return ""
                        s = td.find("span", class_="mod-both")
                        if s:
                            return s.text.strip()
                        return td.text.strip()
                    
                    rating = stat(tds[2]) if len(tds) > 2 else ""
                    kd_diff = stat(tds[7]) if len(tds) > 7 else ""
                    fk = stat(tds[11]) if len(tds) > 11 else ""
                    fd = stat(tds[12]) if len(tds) > 12 else ""
                    fk_diff = stat(tds[13]) if len(tds) > 13 else ""

                    result[team_key].append({
                        "name": player_name,
                        "href": player_href,
                        "photo": "",  # filled in after parallel fetch
                        "agents": agents,
                        "rating": rating,
                        "acs": stat(tds[3]),
                        "k": stat(tds[4]),
                        "d": stat(tds[5]),
                        "a": stat(tds[6]),
                        "kd_diff": kd_diff,
                        "kast": stat(tds[8]),
                        "adr": stat(tds[9]),
                        "hs": stat(tds[10]),
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

        # Fetch photos in parallel (max 5 workers)
        if unique_players:
            with ThreadPoolExecutor(max_workers=5) as executor:
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
            score_spans = vs_score_div.find_all("span")
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
            overall_score1 = str(s1)
            overall_score2 = str(s2)

        # Determine status
        status = "Upcoming"
        vs_note = soup.find(class_="match-header-vs-note")
        vs_note_text = vs_note.text.strip().lower() if vs_note else ""
        if "live" in vs_note_text or soup.find(class_="match-header-vs-note-live"):
            status = "Live"
        elif overall_score1.isdigit() and overall_score2.isdigit():
            status = "Completed"

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
        db = load_json_matches()
        
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
                
            t1_logo = db.get(mid, {}).get("team1_logo", "")
            t2_logo = db.get(mid, {}).get("team2_logo", "")
            unix_ts = db.get(mid, {}).get("unix_timestamp")
            
            has_details = t1_logo and t2_logo and unix_ts
            files_exist = file_exists(t1_logo) and file_exists(t2_logo)
            existing_players = db.get(mid, {}).get("players", {})
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
            has_stats = bool(db.get(mid, {}).get("maps")) and not old_format and not missing_all and not missing_photos and not missing_new_stats

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
                current_db = load_json_matches()
                for mid, details in results.items():
                    if mid in current_db:
                        current_db[mid]["team1_logo"] = details["team1_logo"]
                        current_db[mid]["team2_logo"] = details["team2_logo"]
                        current_db[mid]["unix_timestamp"] = details["unix_timestamp"]
                        current_db[mid]["bst_time"] = details["bst_time"]
                        current_db[mid]["maps"] = details.get("maps", [])
                        current_db[mid]["players"] = details.get("players", {})
                        current_db[mid]["status"] = details.get("status", current_db[mid].get("status", "Completed"))
                        current_db[mid]["last_updated"] = int(datetime.now().timestamp())
                save_json_matches(current_db)
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


def _fetch_page(url):
    """Fetch a page and return a BeautifulSoup object, or None on failure."""
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.encoding = 'utf-8'
        if response.status_code != 200:
            print(f"Failed to fetch {url}. Server returned status: {response.status_code}")
            return None
        return BeautifulSoup(response.text, "html.parser")
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None


def _upsert_matches_to_db(db, scraped_matches):
    """Insert or update scraped matches into the database dict.
    Downloads tournament logos and sets basic match info.
    Returns the updated db dict."""
    
    # Download tournament logos locally
    for m in scraped_matches:
        if m["tournament_logo"]:
            m["tournament_logo"] = download_image(m["tournament_logo"])
            
    # Insert/Update basic info for each scraped match
    for m in scraped_matches:
        mid = m["id"]
        if mid not in db:
            db[mid] = {
                "id": mid,
                "href": m["href"],
                "team1": m["team1"],
                "team2": m["team2"],
                "team1_logo": "",
                "team2_logo": "",
                "tournament": m["tournament"],
                "tournament_logo": m["tournament_logo"],
                "series": m["series"],
                "unix_timestamp": 0,
                "bst_time": "",
                "status": m["status"],
                "score1": m["score1"],
                "score2": m["score2"],
                "last_updated": int(datetime.now().timestamp())
            }
        else:
            # Update variable data from matches list
            db[mid]["team1"] = m["team1"]
            db[mid]["team2"] = m["team2"]
            db[mid]["tournament"] = m["tournament"]
            db[mid]["tournament_logo"] = m["tournament_logo"]
            db[mid]["series"] = m["series"]
            db[mid]["status"] = m["status"]
            db[mid]["score1"] = m["score1"]
            db[mid]["score2"] = m["score2"]
            db[mid]["last_updated"] = int(datetime.now().timestamp())
    
    return db


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
        
        # Load existing matches from JSON cache
        db = load_json_matches()
        
        # Upsert all scraped matches into db
        db = _upsert_matches_to_db(db, all_scraped)
                
        # Save basic info IMMEDIATELY (takes ~150-200ms) to ensure instant web responses
        save_json_matches(db)
        return True
    except Exception as e:
        print(f"Offline sync failed: {e}")
        return False
    finally:
        sync_lock.release()

def get_matches_for_display():
    # Read directly from local JSON cache (super fast, non-blocking)
    db = load_json_matches()
    
    # Sort matches
    matches_list = list(db.values())
    
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
