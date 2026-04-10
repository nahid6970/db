from flask import Flask, request, jsonify, send_from_directory
import json
import os

app = Flask(__name__)
MAPS_FILE = 'maps.json'

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def send_static(path):
    return send_from_directory('.', path)

@app.route('/api/maps', methods=['GET'])
def get_maps():
    if not os.path.exists(MAPS_FILE):
        return jsonify({})
    with open(MAPS_FILE, 'r') as f:
        data = json.load(f)
    return jsonify(data)

@app.route('/api/save_map', methods=['POST'])
def save_map():
    new_map = request.json
    name = new_map.get('name')
    data = new_map.get('data')

    if not name or not data:
        return jsonify({"error": "Missing name or data"}), 400

    maps = {}
    if os.path.exists(MAPS_FILE):
        with open(MAPS_FILE, 'r') as f:
            maps = json.load(f)

    maps[name] = data

    with open(MAPS_FILE, 'w') as f:
        json.dump(maps, f, indent=4)

    return jsonify({"status": "success", "message": f"Map '{name}' saved to disk."})

@app.route('/api/delete_map', methods=['POST'])
def delete_map():
    name = request.json.get('name')
    if not name:
        return jsonify({"error": "Missing name"}), 400

    if os.path.exists(MAPS_FILE):
        with open(MAPS_FILE, 'r') as f:
            maps = json.load(f)
        
        if name in maps:
            del maps[name]
            with open(MAPS_FILE, 'w') as f:
                json.dump(maps, f, indent=4)
            return jsonify({"status": "success", "message": f"Map '{name}' deleted."})
    
    return jsonify({"error": "Map not found"}), 404

if __name__ == '__main__':
    print("Sierra Tactical Server running at http://localhost:5684")
    app.run(debug=True, port=5684)
