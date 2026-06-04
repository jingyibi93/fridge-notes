#!/usr/bin/env python3
from server import FridgeHandler
from http.server import HTTPServer
import os

port = int(os.environ.get('PORT', 9998))
server = HTTPServer(('0.0.0.0', port), FridgeHandler)
print(f'Fridge server running on http://localhost:{port}')
server.serve_forever()
