import urllib.request
from bs4 import BeautifulSoup

url = 'https://en.wikipedia.org/wiki/List_of_WWE_pay-per-view_and_WWE_Network_events'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req).read().decode('utf-8')
soup = BeautifulSoup(html, 'html.parser')

header = soup.find(id='Upcoming_event_schedule')
if header:
    for table in header.parent.find_all_next('table', class_='wikitable'):
        headers = [th.text.strip() for th in table.find_all('th')]
        if any('Event' in h for h in headers) and any('Date' in h for h in headers):
            for row in table.find_all('tr')[1:5]:
                cells = row.find_all(['td', 'th'])
                row_data = [c.text.strip() for c in cells]
                print(row_data)
            break
