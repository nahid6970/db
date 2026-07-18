import re

with open('scraper.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace /thumb/ with /
# and remove /1200px-... prefix entirely
# e.g. https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/WrestleMania_logo.svg/1200px-WrestleMania_logo.svg.png
# to https://upload.wikimedia.org/wikipedia/commons/1/1a/WrestleMania_logo.svg

def fix_url(m):
    url = m.group(0)
    url = url.replace('/thumb/', '/')
    url = re.sub(r'/[0-9]+px-[^/]+$', '', url)
    return url

content = re.sub(r'https://upload\.wikimedia\.org/wikipedia/[^\']+', fix_url, content)

with open('scraper.py', 'w', encoding='utf-8') as f:
    f.write(content)

