import os
import sys

# Add the api-server directory to sys.path to resolve local imports on Vercel
api_server_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../artifacts/api-server"))
sys.path.insert(0, api_server_path)

# Import the FastAPI application
from main import app
