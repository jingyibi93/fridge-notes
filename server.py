#!/usr/bin/env python3
"""冰箱便签 - 同步服务器（线程池 + 轻量version检查 + 文件锁防并发）"""
import json
import os
import time
import fcntl
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlparse, parse_qs

DATA_DIR = os.environ.get('RAILWAY_VOLUME_MOUNT_PATH', os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(DATA_DIR, 'fridge_data.json')
LOCK_FILE = os.path.join(DATA_DIR, 'fridge_data.lock')

# ===== 全局内存缓存 + 文件锁 =====
_data_cache = None
_data_loaded = False
_data_lock = threading.Lock()  # 内存缓存读写锁

def load_data():
    global _data_cache, _data_loaded
    with _data_lock:
        if _data_loaded and _data_cache is not None:
            return json.loads(json.dumps(_data_cache))
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        with _data_lock:
            _data_cache = data
            _data_loaded = True
            return json.loads(json.dumps(data))
    data = {"families": {}}
    with _data_lock:
        _data_cache = data
        _data_loaded = True
    return data

def save_data(data):
    global _data_cache, _data_loaded
    tmp_file = DATA_FILE + '.tmp'
    with open(tmp_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp_file, DATA_FILE)
    with _data_lock:
        _data_cache = data
        _data_loaded = True

def with_lock(fn):
    """装饰器：加文件锁执行写操作，防止并发覆盖"""
    def wrapper(*args, **kwargs):
        with open(LOCK_FILE, 'w') as lock_f:
            fcntl.flock(lock_f, fcntl.LOCK_EX)
            try:
                result = fn(*args, **kwargs)
                return result
            finally:
                fcntl.flock(lock_f, fcntl.LOCK_UN)
    return wrapper

# 线程池HTTPServer，限制最大并发线程数
class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    # 限制最大并发线程，防止资源耗尽
    max_threads = 20
    _thread_semaphore = threading.Semaphore(max_threads)

    def process_request(self, request, client_address):
        # 用信号量限制并发
        self._thread_semaphore.acquire()
        try:
            ThreadingMixIn.process_request(self, request, client_address)
        finally:
            self._thread_semaphore.release()

class FridgeHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

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

        if path == '/health':
            self.send_json({"ok": True})
            return

        # 轻量版本检查：只返回updatedAt时间戳，客户端用于判断是否需要完整同步
        if path == '/api/version':
            code = params.get('code', [''])[0].upper()
            data = load_data()
            family = data.get('families', {}).get(code, None)
            if not family:
                self.send_json({"ok": True, "updatedAt": 0, "serverTime": time.time()})
            else:
                self.send_json({"ok": True, "updatedAt": family.get('updatedAt', 0), "serverTime": time.time()})
            return

        if path == '/api/sync':
            code = params.get('code', [''])[0].upper()
            since = float(params.get('since', ['0'])[0])
            data = load_data()
            family = data.get('families', {}).get(code, None)
            if not family:
                self.send_json({"ok": True, "family": None, "serverTime": time.time()})
                return
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

        self.serve_static(path)

    @with_lock
    def _save_note(self, code, note_id, note):
        data = load_data()
        if code not in data['families']:
            data['families'][code] = {"members": {}, "notes": {}, "updatedAt": time.time()}
        server_now = time.time()
        note['updatedAt'] = server_now
        data['families'][code]['notes'][note_id] = note
        data['families'][code]['updatedAt'] = server_now
        save_data(data)
        return server_now

    @with_lock
    def _save_member(self, code, member_id, member):
        data = load_data()
        if code not in data['families']:
            data['families'][code] = {"members": {}, "notes": {}, "updatedAt": time.time()}
        data['families'][code]['members'][member_id] = member
        data['families'][code]['updatedAt'] = time.time()
        save_data(data)

    @with_lock
    def _delete_note(self, code, note_id):
        data = load_data()
        family = data.get('families', {}).get(code, None)
        if family and note_id in family.get('notes', {}):
            # 不直接删除，标记为_deleted，让其他客户端同步时能看到此note已被删除
            family['notes'][note_id]['_deleted'] = True
            family['notes'][note_id]['deletedAt'] = time.time()
            family['notes'][note_id]['updatedAt'] = time.time()
            family['updatedAt'] = time.time()
            # 清理超过1小时的已删除便签，释放存储
            now = time.time()
            to_purge = [nid for nid, n in family.get('notes', {}).items()
                        if n.get('_deleted') and now - n.get('deletedAt', 0) > 3600]
            for nid in to_purge:
                del family['notes'][nid]
            save_data(data)

    @with_lock
    def _delete_member(self, code, member_id):
        data = load_data()
        family = data.get('families', {}).get(code, None)
        if family and member_id in family.get('members', {}):
            del family['members'][member_id]
            family['updatedAt'] = time.time()
            save_data(data)

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

            updated_at = self._save_note(code, note_id, note)
            self.send_json({"ok": True, "updatedAt": updated_at})
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

            self._save_member(code, member_id, member)
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

            self._delete_note(code, note_id)
            self.send_json({"ok": True})
            return

        if path == '/api/member':
            code = params.get('code', [''])[0].upper()
            member_id = params.get('id', [''])[0]

            self._delete_member(code, member_id)
            self.send_json({"ok": True})
            return

        self.send_json({"ok": False, "error": "unknown endpoint"}, 404)

    def serve_static(self, path):
        if path == '/' or path == '':
            path = '/index.html'
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
    server = ThreadedHTTPServer(('0.0.0.0', port), FridgeHandler)
    print(f'Fridge server running on http://localhost:{port}')
    server.serve_forever()
