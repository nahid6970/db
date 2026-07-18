from flask import Flask, render_template, jsonify, request
from pathlib import Path
import scraper

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/export-static', methods=['POST'])
def api_export_static():
    events = scraper.get_events()
    output_path = Path(__file__).resolve().parent / 'index.html'
    html = render_template('index.html', static_events=events)
    output_path.write_text('<!DOCTYPE html>\n' + html, encoding='utf-8')
    return jsonify({'status': 'success', 'path': str(output_path)})

@app.route('/api/events')
def api_events():
    events = scraper.get_events()
    # Sort events by date if possible, but they are generally already in order
    return jsonify(events)

@app.route('/api/events/<event_id>/toggle', methods=['POST'])
def api_toggle_seen(event_id):
    data = request.json
    seen = 1 if data.get('seen') else 0
    scraper.toggle_seen(event_id, seen)
    return jsonify({'status': 'success', 'seen': seen})

@app.route('/api/events/<event_id>/toggle_hidden', methods=['POST'])
def api_toggle_hidden(event_id):
    data = request.json
    hidden = 1 if data.get('hidden') else 0
    scraper.toggle_hidden(event_id, hidden)
    return jsonify({'status': 'success', 'hidden': hidden})

@app.route('/api/scrape', methods=['POST'])
def api_scrape():
    scraper.scrape_events()
    return jsonify({'status': 'success'})

if __name__ == '__main__':
    app.run(debug=True, port=5001)
