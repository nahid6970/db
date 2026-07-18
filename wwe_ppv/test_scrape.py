import urllib.request
from bs4 import BeautifulSoup
from datetime import datetime

url = 'https://www.thesmackdownhotel.com/events-results/wwe-ppv-list-pay-per-views-special-events-schedule'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
html = urllib.request.urlopen(req).read().decode('utf-8')
soup = BeautifulSoup(html, 'html.parser')

items = soup.find_all('div', class_='items-row')
for item in items[:15]:
    h3 = item.find('h3', class_='contentheading')
    if not h3: continue
    
    title = h3.text.strip()
    
    img = item.find('img')
    img_src = img['src'] if img else ''
    if img_src.startswith('/'):
        img_src = 'https://www.thesmackdownhotel.com' + img_src
        
    date_el = item.find('span', class_='icon-calendar')
    date_str = ''
    if date_el and date_el.find_next('span', class_='field-value'):
        date_str = date_el.find_next('span', class_='field-value').text.strip()
        
    # Location usually comes in another article-info div
    # format: <dd><strong><span>Location</span></strong> - <span>Venue</span></dd>
    loc_strong = item.find('strong')
    location = loc_strong.text.strip() if loc_strong else ''
    
    venue = ''
    if loc_strong and loc_strong.next_sibling:
        # text after strong
        t = str(loc_strong.next_sibling).strip()
        if t.startswith('-'):
            t = t[1:].strip()
        
        # also check for next span if any
        ns = loc_strong.find_next_sibling('span')
        if ns:
            venue = ns.text.strip()
        else:
            venue = t
            
    # determine status by date
    status = 'Completed'
    try:
        dt = datetime.strptime(date_str, '%B %d, %Y')
        if dt > datetime.now():
            status = 'Upcoming'
    except:
        pass
        
    print(f"{title} | {date_str} | Loc: {location} | Venue: {venue} | Status: {status} | Img: {img_src}")
