import os
import re
import json
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

STATUS_FILE = os.path.join(os.path.dirname(__file__), 'model_status.json')
MD_FILE = os.path.join(os.path.dirname(__file__), 'ai_models.md')

def load_status():
    if os.path.exists(STATUS_FILE):
        try:
            with open(STATUS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_status(status_data):
    with open(STATUS_FILE, 'w', encoding='utf-8') as f:
        json.dump(status_data, f, indent=4, ensure_ascii=False)

def parse_md():
    if not os.path.exists(MD_FILE):
        return []

    with open(MD_FILE, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    sections = []
    current_section = None
    current_category = None
    headers = []

    # Simple state machine to parse markdown sections, categories, and tables
    for line in lines:
        line_str = line.strip()
        if not line_str:
            continue

        # Section match: ## Section Name
        sec_match = re.match(r'^##\s+(.+)$', line_str)
        if sec_match:
            name = sec_match.group(1).strip()
            # Exclude Leaderboards/Contributing as main sections if desired, or include them
            current_section = {
                'name': name,
                'categories': []
            }
            sections.append(current_section)
            current_category = None
            continue

        # Category match: ### Category Name
        cat_match = re.match(r'^###\s+(.+)$', line_str)
        if cat_match:
            if current_section is None:
                current_section = {
                    'name': 'General',
                    'categories': []
                }
                sections.append(current_section)
            name = cat_match.group(1).strip()
            current_category = {
                'name': name,
                'items': []
            }
            current_section['categories'].append(current_category)
            headers = []
            continue

        # Subsection/description or table
        if line_str.startswith('|'):
            # It's a table row
            parts = [p.strip() for p in line_str.split('|')[1:-1]]
            if not parts:
                continue
            
            # Check if it's separator row (e.g. | --- | --- |)
            if all(re.match(r'^:?-+:?$', p) for p in parts):
                continue

            # If headers are not set yet, this is the header row
            if not headers:
                headers = parts
                continue

            # Parse item row
            # Link cell is usually parts[0], check if it contains markdown link [Name](URL)
            link_cell = parts[0]
            link_match = re.search(r'\[([^\]]+)\]\(([^)]+)\)', link_cell)
            
            name = ""
            url = ""
            if link_match:
                name = link_match.group(1).strip()
                url = link_match.group(2).strip()
            else:
                # Fallback if it's plain text link or just text
                name = link_cell.replace('`', '').strip()
                url = name if name.startswith('http') else ''

            if not name:
                continue

            # Get remaining columns
            extra_info = {}
            for idx, h in enumerate(headers[1:]):
                val = parts[idx + 1] if idx + 1 < len(parts) else ""
                # Clean up markdown styling like backticks
                val = val.strip().strip('`')
                extra_info[h] = val

            item = {
                'name': name,
                'url': url,
                'extra': extra_info
            }

            if current_category:
                current_category['items'].append(item)
            elif current_section:
                # If no category, create a default one
                if not current_section['categories']:
                    current_section['categories'].append({
                        'name': 'General',
                        'items': []
                    })
                current_section['categories'][0]['items'].append(item)

    return sections

@app.route('/')
def index():
    sections = parse_md()
    status_db = load_status()
    
    # Merge status info into items
    for sec in sections:
        for cat in sec['categories']:
            for item in cat['items']:
                # Use URL + Name as a unique key
                key = f"{item['name']}|{item['url']}"
                status = status_db.get(key, {})
                item['status'] = status.get('status', 'untested') # untested, working, broken
                item['favorite'] = status.get('favorite', False)
                item['notes'] = status.get('notes', '')

    return render_template('index.html', sections=sections)

@app.route('/api/status', methods=['POST'])
def update_status():
    data = request.json
    name = data.get('name')
    url = data.get('url')
    status_val = data.get('status') # untested, working, broken
    favorite = data.get('favorite') # boolean
    notes = data.get('notes') # string

    if not name:
        return jsonify({'error': 'Name is required'}), 400

    key = f"{name}|{url}"
    status_db = load_status()
    
    if key not in status_db:
        status_db[key] = {}

    if status_val is not None:
        status_db[key]['status'] = status_val
    if favorite is not None:
        status_db[key]['favorite'] = favorite
    if notes is not None:
        status_db[key]['notes'] = notes

    save_status(status_db)
    return jsonify({'success': True, 'data': status_db[key]})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
