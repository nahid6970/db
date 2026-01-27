#!/usr/bin/env python3
"""
Chrome Extension Data Manager
Runs a local HTTP server that receives JSON data from Chrome extensions
and saves them to organized directories.
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
import json
import os
from datetime import datetime
from pathlib import Path
import logging
from urllib.parse import urlparse, parse_qs

# Configuration
HOST = 'localhost'
PORT = 8765
# Set DATA_DIR relative to the script's location
SCRIPT_DIR = Path(__file__).parent.absolute()
DATA_DIR = SCRIPT_DIR / 'extension_data'

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Handle requests in a separate thread."""
    daemon_threads = True

class ExtensionHandler(BaseHTTPRequestHandler):
    """Handle requests from Chrome extensions"""
    
    def _set_cors_headers(self):
        """Set CORS headers to allow extension communication"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
    
    def do_OPTIONS(self):
        """Handle preflight CORS requests"""
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()
    
    def do_POST(self):
        """Handle POST requests with JSON data"""
        try:
            # Read request body
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            # Extract extension info
            extension_name = data.get('extension_name', 'unknown')
            file_name = data.get('file_name', 'data.json')  # Custom filename
            save_data = data.get('data', {})
            
            # Ensure filename ends with .json
            if not file_name.endswith('.json'):
                file_name += '.json'
            
            # Create directory for this extension
            extension_dir = DATA_DIR / extension_name
            extension_dir.mkdir(parents=True, exist_ok=True)
            
            # Use custom filename
            filepath = extension_dir / file_name
            
            # Save the data
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(save_data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"✅ SAVED: '{extension_name}' -> {file_name}")
            
            # Send success response
            self.send_response(200)
            self._set_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            response = {
                'status': 'success',
                'success': True,
                'message': f'Data saved to {filepath}',
                'filepath': str(filepath)
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            logger.error(f"❌ POST Error: {e}")
            self.send_response(500)
            self._set_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            response = {
                'status': 'error',
                'success': False,
                'message': str(e)
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
    
    def do_GET(self):
        """Handle GET requests - health check and loading data"""
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query_params = parse_qs(parsed_url.query)
        
        if path == '/health':
            self.send_response(200)
            self._set_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            response = {
                'status': 'running',
                'message': 'Extension Manager is active'
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        elif path == '/load':
            try:
                extension_name = query_params.get('extension_name', ['unknown'])[0]
                file_name = query_params.get('file_name', ['data.json'])[0]
                
                if not file_name.endswith('.json'):
                    file_name += '.json'
                
                filepath = DATA_DIR / extension_name / file_name
                
                if filepath.exists():
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    logger.info(f"📂 LOADED: '{extension_name}' <- {file_name}")
                    
                    self.send_response(200)
                    self._set_cors_headers()
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    
                    response = {
                        'status': 'success',
                        'success': True,
                        'data': data
                    }
                    self.wfile.write(json.dumps(response).encode('utf-8'))
                else:
                    logger.warning(f"⚠️ NOT FOUND: '{extension_name}' / {file_name}")
                    self.send_response(404)
                    self._set_cors_headers()
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    
                    response = {
                        'status': 'error',
                        'success': False,
                        'message': 'Data file not found'
                    }
                    self.wfile.write(json.dumps(response).encode('utf-8'))
                    
            except Exception as e:
                logger.error(f"❌ LOAD Error: {e}")
                self.send_response(500)
                self._set_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                
                response = {
                    'status': 'error',
                    'success': False,
                    'message': str(e)
                }
                self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        """Silence default logging to use our custom logger"""
        pass

def main():
    """Start the extension manager server"""
    # Create data directory
    DATA_DIR.mkdir(exist_ok=True)
    
    # Start server
    server = ThreadedHTTPServer((HOST, PORT), ExtensionHandler)
    logger.info(f"Extension Manager running on http://{HOST}:{PORT}")
    logger.info(f"Data will be saved to: {DATA_DIR.absolute()}")
    logger.info("Press Ctrl+C to stop")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("\nShutting down server...")
        server.shutdown()


if __name__ == '__main__':
    main()
