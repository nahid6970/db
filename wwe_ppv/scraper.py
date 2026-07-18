import urllib.request
from bs4 import BeautifulSoup
import sqlite3
import re
from datetime import datetime
import json
import os

DB_PATH = 'wwe.db'

PPV_LOGOS = {
    'wrestlemania': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/WrestleMania_logo.svg/1200px-WrestleMania_logo.svg.png',
    'royal rumble': 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/Royal_Rumble_logo.svg/1200px-Royal_Rumble_logo.svg.png',
    'summerslam': 'https://upload.wikimedia.org/wikipedia/en/thumb/2/22/SummerSlam_logo.svg/1200px-SummerSlam_logo.svg.png',
    'survivor series': 'https://upload.wikimedia.org/wikipedia/en/thumb/6/6b/Survivor_Series_logo.svg/1200px-Survivor_Series_logo.svg.png',
    'money in the bank': 'https://upload.wikimedia.org/wikipedia/en/thumb/1/1c/Money_in_the_Bank_logo.svg/1200px-Money_in_the_Bank_logo.svg.png',
    'backlash': 'https://upload.wikimedia.org/wikipedia/en/thumb/9/9f/WWE_Backlash_logo.svg/1200px-WWE_Backlash_logo.svg.png',
    'clash at the castle': 'https://upload.wikimedia.org/wikipedia/en/thumb/6/62/Clash_at_the_Castle_logo.svg/1200px-Clash_at_the_Castle_logo.svg.png',
    'elimination chamber': 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e8/Elimination_Chamber_logo.svg/1200px-Elimination_Chamber_logo.svg.png',
    'hell in a cell': 'https://upload.wikimedia.org/wikipedia/en/thumb/8/86/Hell_in_a_Cell_logo.svg/1200px-Hell_in_a_Cell_logo.svg.png',
    'payback': 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7b/WWE_Payback_logo.svg/1200px-WWE_Payback_logo.svg.png',
    'fastlane': 'https://upload.wikimedia.org/wikipedia/en/thumb/9/9d/WWE_Fastlane_logo.svg/1200px-WWE_Fastlane_logo.svg.png',
    'crown jewel': 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7b/WWE_Crown_Jewel_logo.svg/1200px-WWE_Crown_Jewel_logo.svg.png',
    'night of champions': 'https://upload.wikimedia.org/wikipedia/en/thumb/9/91/WWE_Night_of_Champions_logo.svg/1200px-WWE_Night_of_Champions_logo.svg.png',
    'nxt': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/WWE_NXT_logo_2019.svg/1200px-WWE_NXT_logo_2019.svg.png',
    "saturday night's main event": 'https://upload.wikimedia.org/wikipedia/en/thumb/9/9a/Saturday_Night%27s_Main_Event_logo.svg/1200px-Saturday_Night%27s_Main_Event_logo.svg.png'
}

def get_logo(name):
    lower_name = name.lower()
    for key, url in PPV_LOGOS.items():
        if key in lower_name:
            return url
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/WWE_Logo.svg/1200px-WWE_Logo.svg.png'

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                name TEXT,
                date_str TEXT,
                venue TEXT,
                location TEXT,
                notes TEXT,
                status TEXT,
                logo_url TEXT,
                seen INTEGER DEFAULT 0
            )
        ''')
        conn.commit()

def clean_text(text):
    return re.sub(r'\[\d+\]', '', text).strip()

def scrape_events():
    url = 'https://en.wikipedia.org/wiki/List_of_WWE_pay-per-view_and_WWE_Network_events'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    html = urllib.request.urlopen(req).read().decode('utf-8')
    soup = BeautifulSoup(html, 'html.parser')

    events_data = []

    # Get current year from system
    current_year = datetime.now().year

    # Helper to parse a table
    def parse_table(table, status):
        headers = [th.text.strip() for th in table.find_all('th')]
        if not any('Event' in h for h in headers) or not any('Date' in h for h in headers):
            return
            
        rows = table.find_all('tr')[1:]
        current_event = None
        current_venue = None
        current_loc = None
        current_notes = None
        
        for row in rows:
            cells = row.find_all(['td', 'th'])
            row_data = [clean_text(c.text.strip()) for c in cells]
            
            if len(row_data) >= 4:
                date_str = row_data[0]
                # Sometimes date is just the month and day, we might need to append year if missing
                if str(current_year) not in date_str:
                    date_str = f"{date_str} {current_year}"
                
                event_name = row_data[1]
                venue = row_data[2]
                loc = row_data[3]
                notes = row_data[4] if len(row_data) > 4 else ""
                
                current_event = event_name
                current_venue = venue
                current_loc = loc
                current_notes = notes
                
                events_data.append({
                    'id': f"{event_name}_{date_str}".replace(' ', '_').replace(',', ''),
                    'name': event_name,
                    'date_str': date_str,
                    'venue': venue,
                    'location': loc,
                    'notes': notes,
                    'status': status,
                    'logo_url': get_logo(event_name)
                })
            elif len(row_data) == 1 and current_event:
                # Rowspan continuation (e.g. 2nd day of Wrestlemania)
                date_str = row_data[0]
                if str(current_year) not in date_str:
                    date_str = f"{date_str} {current_year}"
                events_data.append({
                    'id': f"{current_event}_{date_str}".replace(' ', '_').replace(',', ''),
                    'name': f"{current_event} (Day 2)",
                    'date_str': date_str,
                    'venue': current_venue,
                    'location': current_loc,
                    'notes': current_notes,
                    'status': status,
                    'logo_url': get_logo(current_event)
                })

    # Find Past Events for current year
    past_id = f'Past_events_{current_year}'
    past_header = soup.find(id=past_id)
    if past_header:
        for table in past_header.parent.find_all_next('table', class_='wikitable'):
            # stop if we reached the next section
            if table.find_previous(['h2', 'h3']).find(id=lambda x: x and x != past_id and x.startswith('Past_events_')):
                break
            parse_table(table, 'Completed')

    # Find Upcoming Events
    upcoming_header = soup.find(id='Upcoming_event_schedule')
    if upcoming_header:
        for table in upcoming_header.parent.find_all_next('table', class_='wikitable'):
            if table.find_previous(['h2', 'h3']).find(id=lambda x: x and x != 'Upcoming_event_schedule' and x.startswith('Upcoming_events_')):
                break
            parse_table(table, 'Upcoming')
            
    # Upsert into DB
    with sqlite3.connect(DB_PATH) as conn:
        for e in events_data:
            conn.execute('''
                INSERT INTO events (id, name, date_str, venue, location, notes, status, logo_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name,
                    date_str=excluded.date_str,
                    venue=excluded.venue,
                    location=excluded.location,
                    notes=excluded.notes,
                    status=excluded.status,
                    logo_url=excluded.logo_url
            ''', (e['id'], e['name'], e['date_str'], e['venue'], e['location'], e['notes'], e['status'], e['logo_url']))
        conn.commit()
    
    return events_data

def get_events():
    init_db()
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute('SELECT * FROM events').fetchall()
        return [dict(r) for r in rows]

def toggle_seen(event_id, seen_val):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('UPDATE events SET seen = ? WHERE id = ?', (seen_val, event_id))
        conn.commit()

if __name__ == '__main__':
    init_db()
    scrape_events()
    print(f"Scraped {len(get_events())} events.")

