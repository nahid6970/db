import urllib.request
from bs4 import BeautifulSoup
import re
from datetime import datetime

url = 'https://en.wikipedia.org/wiki/List_of_WWE_pay-per-view_and_WWE_Network_events'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req).read().decode('utf-8')
soup = BeautifulSoup(html, 'html.parser')

tables = soup.find_all('table', class_='wikitable')
events = []

for table in tables:
    headers = [th.text.strip() for th in table.find_all('th')]
    
    # Typical columns: Date, Event, Venue, Location, Main event
    # Sometimes 'Date', 'Event name', etc.
    if not any('Event' in h for h in headers) or not any('Date' in h for h in headers):
        continue
        
    for row in table.find_all('tr')[1:]:
        cells = row.find_all(['td', 'th'])
        if len(cells) < 3:
            continue
            
        row_data = [c.text.strip() for c in cells]
        print(row_data)
        break

