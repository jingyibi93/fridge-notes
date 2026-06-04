#!/usr/bin/env python3
"""冰箱便签 - 同步服务器"""
import json
import os
import time
import hashlib
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

DATA_DIR = os.environ.get('RAILWAY_VOLUME_MOUNT_PATH', os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(DATA_DIR, 'fridge_data.json')

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"families": {}}

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

class FridgeHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # silence logs

    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def send_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if path == '/api/sync':
            code = params.get('code', [''])[0].upper()
            since = float(params.get('since', ['0'])[0])
            data = load_data()
            family = data.get('families', {}).get(code, None)
            if not family:
                self.send_json({"ok": True, "family": None, "serverTime": time.time()})
                return
            # 只返回 since 之后有变化的便签
            notes = {}
            for nid, n in family.get('notes', {}).items():
                updated_at = n.get('updatedAt', 0)
                if updated_at == 0:
                    t = n.get('time', 0)
                    updated_at = t / 1000 if t > 1e12 else t
                if updated_at >= since:
                    notes[nid] = n
            members = family.get('members', {})
            self.send_json({
                "ok": True,
                "family": {
                    "code": code,
                    "members": members,
                    "notes": notes,
                    "updatedAt": family.get('updatedAt', 0)
                },
                "serverTime": time.time()
            })
            return

        if path == '/api/family':
            code = params.get('code', [''])[0].upper()
            data = load_data()
            family = data.get('families', {}).get(code, None)
            self.send_json({"ok": True, "exists": family is not None})
            return

        # 默认：serve静态文件
        self.serve_static(path)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/api/note':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                req = json.loads(body)
            except:
                self.send_json({"ok": False, "error": "invalid json"}, 400)
                return

            code = req.get('code', '').upper()
            note = req.get('note', {})
            note_id = req.get('id', '')

            if not code or not note_id:
                self.send_json({"ok": False, "error": "missing code or id"}, 400)
                return

            data = load_data()
            if code not in data['families']:
                data['families'][code] = {"members": {}, "notes": {}, "updatedAt": time.time()}

            note['updatedAt'] = time.time()
            data['families'][code]['notes'][note_id] = note
            data['families'][code]['updatedAt'] = time.time()
            save_data(data)
            self.send_json({"ok": True})
            return

        if path == '/api/member':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                req = json.loads(body)
            except:
                self.send_json({"ok": False, "error": "invalid json"}, 400)
                return

            code = req.get('code', '').upper()
            member_id = req.get('id', '')
            member = req.get('member', {})

            if not code or not member_id:
                self.send_json({"ok": False, "error": "missing code or id"}, 400)
                return

            data = load_data()
            if code not in data['families']:
                data['families'][code] = {"members": {}, "notes": {}, "updatedAt": time.time()}

            data['families'][code]['members'][member_id] = member
            data['families'][code]['updatedAt'] = time.time()
            save_data(data)
            self.send_json({"ok": True})
            return

        self.send_json({"ok": False, "error": "unknown endpoint"}, 404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if path == '/api/note':
            code = params.get('code', [''])[0].upper()
            note_id = params.get('id', [''])[0]

            if not code or not note_id:
                self.send_json({"ok": False, "error": "missing code or id"}, 400)
                return

            data = load_data()
            family = data.get('families', {}).get(code, None)
            if family and note_id in family.get('notes', {}):
                del family['notes'][note_id]
                family['updatedAt'] = time.time()
                save_data(data)
            self.send_json({"ok": True})
            return

        if path == '/api/member':
            code = params.get('code', [''])[0].upper()
            member_id = params.get('id', [''])[0]

            data = load_data()
            family = data.get('families', {}).get(code, None)
            if family and member_id in family.get('members', {}):
                del family['members'][member_id]
                family['updatedAt'] = time.time()
                save_data(data)
            self.send_json({"ok": True})
            return

        self.send_json({"ok": False, "error": "unknown endpoint"}, 404)

    def serve_static(self, path):
        if path == '/' or path == '':
            path = '/index.html'
        # 安全检查
        if '..' in path:
            self.send_response(403)
            self.end_headers()
            return
        filepath = os.path.join(os.path.dirname(os.path.abspath(__file__)), path.lstrip('/'))
        if not os.path.isfile(filepath):
            self.send_response(404)
            self.end_headers()
            return
        ext = os.path.splitext(filepath)[1].lower()
        types = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.ico': 'image/x-icon',
        }
        ctype = types.get(ext, 'application/octet-stream')
        with open(filepath, 'rb') as f:
            content = f.read()
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', len(content))
        self.end_headers()
        self.wfile.write(content)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 9998))
    server = HTTPServer(('0.0.0.0', port), FridgeHandler)
    print(f'Fridge server running on http://localhost:{port}')
    server.serve_forever()
