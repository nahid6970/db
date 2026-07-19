import urllib.request
from bs4 import BeautifulSoup
from datetime import datetime
import os
from convex import ConvexClient

CONVEX_URL = os.environ.get('CONVEX_URL')

def get_client():
    if not CONVEX_URL:
        raise ValueError("CONVEX_URL environment variable is not set. Please set it in your environment or .env file.")
    return ConvexClient(CONVEX_URL)

def init_db():
    # Convex schema is defined in convex/schema.ts and managed by the Convex CLI.
    pass

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
            'eventId': f"{title}_{date_str}".replace(' ', '_').replace(',', ''),
            'name': title,
            'date_str': date_str,
            'venue': venue,
            'location': location,
            'notes': '',
            'status': status,
            'logo_url': img_src
        })
            
    client = get_client()
    for e in events_data:
        client.mutation("events:insertOrUpdate", {
            "eventId": e['eventId'],
            "name": e['name'],
            "date_str": e['date_str'],
            "venue": e['venue'],
            "location": e['location'],
            "notes": e['notes'],
            "status": e['status'],
            "logo_url": e['logo_url']
        })
    
    return events_data

def get_events():
    client = get_client()
    return client.query("events:get")

def toggle_seen(event_id, seen_val):
    client = get_client()
    client.mutation("events:toggleSeen", {"eventId": event_id, "seen": seen_val})

def toggle_hidden(event_id, hidden_val):
    client = get_client()
    client.mutation("events:toggleHidden", {"eventId": event_id, "hidden": hidden_val})

if __name__ == '__main__':
    scrape_events()
