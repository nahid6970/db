import urllib.request
from bs4 import BeautifulSoup
import sqlite3
import re
from datetime import datetime
import os

DB_PATH = 'wwe.db'

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
                seen INTEGER DEFAULT 0,
                hidden INTEGER DEFAULT 0
            )
        ''')
        # Try to add hidden column if it doesn't exist (for migration)
        try:
            conn.execute('ALTER TABLE events ADD COLUMN hidden INTEGER DEFAULT 0')
        except sqlite3.OperationalError:
            pass
        conn.commit()

def scrape_events():
    url = 'https://www.thesmackdownhotel.com/events-results/wwe-ppv-list-pay-per-views-special-events-schedule'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    html = urllib.request.urlopen(req).read().decode('utf-8')
    soup = BeautifulSoup(html, 'html.parser')

    events_data = []
    items = soup.find_all('div', class_='items-row')
    
    current_year = str(datetime.now().year)

    for item in items:
        h3 = item.find('h3', class_='contentheading')
        if not h3: continue
        
        title = h3.text.strip()
        
        # Only want events for the current year
        date_el = item.find('span', class_='icon-calendar')
        date_str = ''
        if date_el and date_el.find_next('span', class_='field-value'):
            date_str = date_el.find_next('span', class_='field-value').text.strip()
            
        if current_year not in date_str:
            continue
            
        img = item.find('img')
        img_src = img['src'] if img else ''
        if img_src.startswith('/'):
            img_src = 'https://www.thesmackdownhotel.com' + img_src
            
        loc_strong = item.find('strong')
        location = loc_strong.text.strip() if loc_strong else ''
        
        venue = ''
        if loc_strong and loc_strong.next_sibling:
            t = str(loc_strong.next_sibling).strip()
            if t.startswith('-'):
                t = t[1:].strip()
            
            ns = loc_strong.find_next_sibling('span')
            if ns:
                venue = ns.text.strip()
            else:
                venue = t
                
        status = 'Completed'
        try:
            # e.g., "January 31, 2026"
            dt = datetime.strptime(date_str, '%B %d, %Y')
            if dt > datetime.now():
                status = 'Upcoming'
        except:
            pass
            
        events_data.append({
            'id': f"{title}_{date_str}".replace(' ', '_').replace(',', ''),
            'name': title,
            'date_str': date_str,
            'venue': venue,
            'location': location,
            'notes': '',
            'status': status,
            'logo_url': img_src
        })
            
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

def toggle_hidden(event_id, hidden_val):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('UPDATE events SET hidden = ? WHERE id = ?', (hidden_val, event_id))
        conn.commit()

if __name__ == '__main__':
    init_db()
    scrape_events()
