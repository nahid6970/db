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

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def load_json_matches():
    if not os.path.exists(JSON_PATH):
        return {}
    try:
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading JSON: {e}")
        return {}

def save_json_matches(matches):
    tmp_path = JSON_PATH + ".tmp"
    try:
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(matches, f, indent=4, ensure_ascii=False)
        # Atomic rename
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
                
        return {
            "team1_logo": local_team1_logo,
            "team2_logo": local_team2_logo,
            "unix_timestamp": unix_timestamp,
            "bst_time": bst_time_str
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
            
            if not has_details or not files_exist:
                pending_ids.append((mid, m["href"]))
                
        # Fetch detailed info in parallel
        if pending_ids:
            print(f"Background Sync: Fetching offline details for {len(pending_ids)} new matches...")
            with ThreadPoolExecutor(max_workers=5) as executor:
                future_to_id = {executor.submit(fetch_match_detail_page, href): mid for mid, href in pending_ids}
                for future in as_completed(future_to_id):
                    mid = future_to_id[future]
                    try:
                        details = future.result()
                        if details:
                            # Reload latest db state to prevent overwriting other concurrent writes
                            current_db = load_json_matches()
                            if mid in current_db:
                                current_db[mid]["team1_logo"] = details["team1_logo"]
                                current_db[mid]["team2_logo"] = details["team2_logo"]
                                current_db[mid]["unix_timestamp"] = details["unix_timestamp"]
                                current_db[mid]["bst_time"] = details["bst_time"]
                                current_db[mid]["last_updated"] = int(datetime.now().timestamp())
                                save_json_matches(current_db)
                                # update local db ref for log output print
                                db = current_db
                                print(f"Background Sync: Updated details/logos for match {mid}")
                    except Exception as e:
                        print(f"Background Sync: Exception fetching details for match {mid}: {e}")
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


RESULTS_PAGES = 5  # Number of result pages to fetch (each page ~20 matches)

def fetch_and_update_matches():
    """Fetch upcoming/live matches AND recent completed results from VLR.gg."""
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
        for page in range(1, RESULTS_PAGES + 1):
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
        
        # Dispatch slow detail fetches and image downloads to a separate background thread
        threading.Thread(target=fetch_details_in_background, args=(all_scraped,), daemon=True).start()
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
