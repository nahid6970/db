import os
import sys

# Add root folder to path so Python can find app.py and scraper.py
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
