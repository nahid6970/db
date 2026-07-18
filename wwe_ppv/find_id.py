import urllib.request, re
html = urllib.request.urlopen(urllib.request.Request('https://en.wikipedia.org/wiki/List_of_WWE_pay-per-view_and_WWE_Network_events', headers={'User-Agent': 'Mozilla/5.0'})).read().decode('utf-8')
print([m for m in re.findall(r'id=\"([^\"]*)\"', html) if 'upcoming' in m.lower()])
