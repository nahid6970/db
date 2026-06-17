import os
import re
import sqlite3
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timezone, timedelta
import zoneinfo
from concurrent.futures import ThreadPoolExecutor, as_completed

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vlr_cache.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS matches (
            id TEXT PRIMARY KEY,
            href TEXT,
            team1 TEXT,
            team2 TEXT,
            team1_logo TEXT,
            team2_logo TEXT,
            tournament TEXT,
            tournament_logo TEXT,
            series TEXT,
            unix_timestamp INTEGER,
            bst_time TEXT,
            status TEXT,
            score1 TEXT,
            score2 TEXT,
            last_updated INTEGER
        )
    """)
    conn.commit()
    conn.close()

def get_cached_matches():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM matches")
    rows = cursor.fetchall()
    conn.close()
    return {row["id"]: dict(row) for row in rows}

def save_match_details(match_id, details):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE matches 
        SET team1_logo = ?, team2_logo = ?, unix_timestamp = ?, bst_time = ?, last_updated = ?
        WHERE id = ?
    """, (
        details["team1_logo"],
        details["team2_logo"],
        details["unix_timestamp"],
        details["bst_time"],
        int(datetime.now().timestamp()),
        match_id
    ))
    conn.commit()
    conn.close()

def insert_or_update_basic_match(match):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # We use INSERT OR IGNORE, then UPDATE the fields that change from the main page
    cursor.execute("""
        INSERT OR IGNORE INTO matches (
            id, href, team1, team2, tournament, tournament_logo, series, status, score1, score2, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        match["id"],
        match["href"],
        match["team1"],
        match["team2"],
        match["tournament"],
        match["tournament_logo"],
        match["series"],
        match["status"],
        match["score1"],
        match["score2"],
        int(datetime.now().timestamp())
    ))
    
    # Update status, scores, series, tournament, team names, tournament_logo in case they change
    cursor.execute("""
        UPDATE matches
        SET team1 = ?, team2 = ?, tournament = ?, tournament_logo = ?, series = ?, status = ?, score1 = ?, score2 = ?
        WHERE id = ?
    """, (
        match["team1"],
        match["team2"],
        match["tournament"],
        match["tournament_logo"],
        match["series"],
        match["status"],
        match["score1"],
        match["score2"],
        match["id"]
    ))
    
    conn.commit()
    conn.close()

def fetch_match_detail_page(href):
    url = f"https://www.vlr.gg{href}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
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
                
        return {
            "team1_logo": team1_logo,
            "team2_logo": team2_logo,
            "unix_timestamp": unix_timestamp,
            "bst_time": bst_time_str
        }
    except Exception as e:
        print(f"Error fetching detail page {url}: {e}")
        return None

def fetch_and_update_matches():
    url = "https://www.vlr.gg/matches"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.encoding = 'utf-8'
        if response.status_code != 200:
            print(f"Failed to fetch matches. Status code: {response.status_code}")
            return False
            
        soup = BeautifulSoup(response.text, "html.parser")
        
        container = soup.find("div", class_="col")
        if not container:
            container = soup
            
        elements = container.find_all(class_=["wf-label", "wf-card"])
        
        current_date = "Unknown Date"
        scraped_matches = []
        
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
                    
                    is_live = False
                    if "live" in eta_text.lower() or "live" in status_text.lower():
                        status = "Live"
                    elif "upcoming" in status_text.lower():
                        status = "Upcoming"
                    else:
                        status = "Completed" if not eta_text else "Upcoming"
                    
                    scraped_matches.append({
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
        
        # Save basic details into the database
        for m in scraped_matches:
            insert_or_update_basic_match(m)
            
        # Check which matches need detailed info (logos and exact timestamps)
        cached = get_cached_matches()
        pending_ids = []
        for m in scraped_matches:
            c_match = cached.get(m["id"])
            if not c_match or not c_match.get("team1_logo") or not c_match.get("unix_timestamp"):
                pending_ids.append((m["id"], m["href"]))
        
        # Fetch detailed info in parallel if there are any
        if pending_ids:
            print(f"Fetching details for {len(pending_ids)} new matches...")
            with ThreadPoolExecutor(max_workers=5) as executor:
                future_to_id = {executor.submit(fetch_match_detail_page, href): mid for mid, href in pending_ids}
                for future in as_completed(future_to_id):
                    mid = future_to_id[future]
                    try:
                        details = future.result()
                        if details:
                            save_match_details(mid, details)
                            print(f"Updated details for match {mid}")
                    except Exception as e:
                        print(f"Exception fetching details for match {mid}: {e}")
        
        return True
    except Exception as e:
        print(f"Error in fetch_and_update_matches: {e}")
        return False

def get_matches_for_display():
    # Fetch latest list from VLR.gg (updates basic status/scores)
    # Then pull details from local cache
    # First, run the updater
    fetch_and_update_matches()
    
    # Load all matches from cache
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    # We can filter to get only recent matches or all matches.
    # Usually, we want upcoming matches first, then live, then completed of today.
    # Sorting: Live matches first, then Upcoming matches (by unix_timestamp asc), then Completed matches (by unix_timestamp desc).
    cursor.execute("""
        SELECT * FROM matches 
        ORDER BY 
            CASE status 
                WHEN 'Live' THEN 1 
                WHEN 'Upcoming' THEN 2 
                ELSE 3 
            END ASC,
            unix_timestamp ASC
    """)
    rows = cursor.fetchall()
    conn.close()
    
    # Convert to list of dicts
    matches_list = []
    for r in rows:
        m = dict(r)
        # Add human readable bst string if unix_timestamp is present
        if m["unix_timestamp"]:
            bst_tz = timezone(timedelta(hours=6))
            dt_bst = datetime.fromtimestamp(m["unix_timestamp"], tz=timezone.utc).astimezone(bst_tz)
            m["formatted_bst"] = dt_bst.strftime("%b %d, %Y - %I:%M %p")
            m["js_timestamp"] = m["unix_timestamp"] * 1000 # JS expects milliseconds
        else:
            m["formatted_bst"] = "N/A"
            m["js_timestamp"] = 0
        matches_list.append(m)
        
    return matches_list

# Initialize DB when this module is imported
init_db()
