#!/usr/bin/env python3
"""冰箱便签 - 同步服务器（单线程稳定版 + version轻量检查 + 文件锁）"""
import json
import os
import time
import fcntl
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

DATA_DIR = os.environ.get('RAILWAY_VOLUME_MOUNT_PATH', os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(DATA_DIR, 'fridge_data.json')
LOCK_FILE = os.path.join(DATA_DIR, 'fridge_data.lock')

# ===== 全局内存缓存 + 文件锁 =====
_data_cache = None
_data_loaded = False

def load_data():
    global _data_cache, _data_loaded
    if _data_loaded and _data_cache is not None:
        return json.loads(json.dumps(_data_cache))
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            _data_cache = json.load(f)
            _data_loaded = True
            return json.loads(json.dumps(_data_cache))
    _data_cache = {"families": {}}
    _data_loaded = True
    return json.loads(json.dumps(_data_cache))

def save_data(data):
    global _data_cache, _data_loaded
    tmp_file = DATA_FILE + '.tmp'
    with open(tmp_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp_file, DATA_FILE)
    _data_cache = data
    _data_loaded = True

def invalidate_cache():
    """使内存缓存失效，下次load_data时重新从文件读取"""
    global _data_loaded
    _data_loaded = False

def with_lock(fn):
    """装饰器：加文件锁执行写操作，防止并发覆盖"""
    def wrapper(*args, **kwargs):
        with open(LOCK_FILE, 'w') as lock_f:
            fcntl.flock(lock_f, fcntl.LOCK_EX)
            try:
                invalidate_cache()  # 写前失效缓存，确保读到最新
                result = fn(*args, **kwargs)
                return result
            finally:
                fcntl.flock(lock_f, fcntl.LOCK_UN)
    return wrapper

class FridgeHandler(BaseHTTPRequestHandler):
    timeout = 10  # 单请求超时10秒，防挂死

    def log_message(self, format, *args):
        pass

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except Exception:
            try:
                self.send_error(500)
            except Exception:
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

    def do_HEAD(self):
        """HEAD请求：只返回头部，不返回正文"""
        parsed = urlparse(self.path)
        path = parsed.path
        if path == '/' or path == '':
            path = '/index.html'
        if '..' in path:
            self.send_response(403)
            self.end_headers()
            return
        filepath = os.path.join(os.path.dirname(os.path.abspath(__file__)), path.lstrip('/'))
        if os.path.isfile(filepath):
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
            size = os.path.getsize(filepath)
            self.send_response(200)
            self.send_cors()
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', size)
            self.end_headers()
        elif path.startswith('/api/'):
            self.send_response(200)
            self.send_cors()
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if path == '/health':
            self.send_json({"ok": True})
            return

        # Debug: 列出所有家庭（临时，排查用）
        if path == '/api/debug_families':
            data = load_data()
            families = data.get('families', {})
            result = {}
            for code, fam in families.items():
                members = fam.get('members', {})
                notes = fam.get('notes', {})
                active_members = {mid: m for mid, m in members.items() if not m.get('_left', False)}
                result[code] = {
                    "member_count": len(members),
                    "active_member_count": len(active_members),
                    "active_members": {mid: m.get('name', '?') for mid, m in active_members.items()},
                    "note_count": len(notes),
                    "note_ids": list(notes.keys())[:10],
                    "updatedAt": fam.get('updatedAt', 0)
                }
            self.send_json({"ok": True, "families": result})
            return

        # 强制缓存刷新：根路径返回跳转页，清除SW缓存后跳转
        if (path == '/' or path == '') and 'fv' not in params:
            redirect_html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="Cache-Control" content="no-cache,no-store,must-revalidate"><style>body{display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#1a1a2e;color:#fff;margin:0}</style></head><body><p>🔄 正在更新...</p></body><script>if("serviceWorker" in navigator){navigator.serviceWorker.getRegistrations().then(function(rs){Promise.all(rs.map(function(r){return r.unregister();})).then(function(){if("caches" in window){caches.keys().then(function(ks){Promise.all(ks.map(function(k){return caches.delete(k);})).then(function(){location.replace("/?fv="+Date.now());});});}else{location.replace("/?fv="+Date.now());}});});}else{location.replace("/?fv="+Date.now());}</script></html>'
            body = redirect_html.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', len(body))
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            self.end_headers()
            self.wfile.write(body)
            return

        # 清理重复成员 + 外来便签
        if path == '/api/cleanup':
            code = params.get('code', [''])[0].upper()
            self._cleanup_members(code)
            self._cleanup_foreign_notes(code)
            self.send_json({"ok": True})
            return

        # 轻量版本检查：只返回updatedAt，极快
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
            if family:
                self.send_json({"ok": True, "exists": True, "members": family.get('members', {})})
            else:
                self.send_json({"ok": True, "exists": False})
            return

        self.serve_static(path)

    @with_lock
    def _save_note(self, code, note_id, note):
        data = load_data()
        if code not in data['families']:
            data['families'][code] = {"members": {}, "notes": {}, "updatedAt": time.time()}
        # 服务器端防护：拒绝不属于该家庭成员的便签，防止跨家庭污染
        author_name = note.get('authorName', '')
        if author_name:
            family_members = data['families'][code].get('members', {})
            is_member = any(m.get('name') == author_name for m in family_members.values())
            if not is_member:
                return -1  # 拒绝保存
        # 也检查_fc字段：如果便签标记了其他家庭，拒绝
        note_fc = note.get('_fc', '')
        if note_fc and note_fc != code:
            return -1  # 拒绝保存
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
        # 成员去重：同名活跃成员只保留最新的，旧的全部标记_left
        member_name = member.get('name', '')
        if member_name and not member.get('_left', False):
            for mid, m in data['families'][code].get('members', {}).items():
                if mid != member_id and m.get('name') == member_name and not m.get('_left', False):
                    m['_left'] = True
        data['families'][code]['members'][member_id] = member
        data['families'][code]['updatedAt'] = time.time()
        save_data(data)

    @with_lock
    def _delete_note(self, code, note_id):
        data = load_data()
        family = data.get('families', {}).get(code, None)
        if family and note_id in family.get('notes', {}):
            family['notes'][note_id]['_deleted'] = True
            family['notes'][note_id]['deletedAt'] = time.time()
            family['notes'][note_id]['updatedAt'] = time.time()
            family['updatedAt'] = time.time()
            # 清理超过1小时的已删除便签
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
            family['members'][member_id]['_left'] = True
            family['updatedAt'] = time.time()
            save_data(data)

    @with_lock
    def _cleanup_members(self, code):
        """清理重复成员：同名只保留1个活跃+1个_left，多余的真删"""
        data = load_data()
        family = data.get('families', {}).get(code, None)
        if not family:
            return
        members = family.get('members', {})
        # 按名字分组
        name_groups = {}
        for mid, m in members.items():
            name = m.get('name', '')
            if not name:
                continue
            if name not in name_groups:
                name_groups[name] = []
            name_groups[name].append((mid, m))
        # 对每组同名成员：有活跃则删所有_left，否则只保留1个_left
        to_delete = []
        for name, group in name_groups.items():
            active = [(mid, m) for mid, m in group if not m.get('_left', False)]
            left = [(mid, m) for mid, m in group if m.get('_left', False)]
            # 活跃超过1个：保留最后一个，其余标_left
            if len(active) > 1:
                for mid, m in active[:-1]:
                    members[mid]['_left'] = True
                    left.append((mid, members[mid]))
            # 有活跃成员时：所有_left都删（人已经回来了，留着没意义）
            if active:
                for mid, m in left:
                    to_delete.append(mid)
            # 没有活跃成员时：只保留1个_left，其余真删
            elif len(left) > 1:
                for mid, m in left[1:]:
                    to_delete.append(mid)
        # 真删多余的_left成员
        for mid in to_delete:
            del members[mid]
        if to_delete:
            family['updatedAt'] = time.time()
            save_data(data)

    @with_lock
    def _cleanup_foreign_notes(self, code):
        """清理外来便签：删除作者不属于该家庭成员的便签（真删）"""
        data = load_data()
        family = data.get('families', {}).get(code, None)
        if not family:
            return
        members = family.get('members', {})
        member_names = set(m.get('name', '') for m in members.values())
        notes = family.get('notes', {})
        to_delete = [nid for nid, n in notes.items() if n.get('authorName', '') not in member_names]
        if to_delete:
            for nid in to_delete:
                del notes[nid]
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
            if updated_at == -1:
                self.send_json({"ok": False, "error": "note author not in family"}, 403)
            else:
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
        # HTML/JS/CSS/JSON 不缓存，确保用户总是拿到最新版本
        if ext in ('.html', '.js', '.css', '.json'):
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        self.end_headers()
        self.wfile.write(content)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 9998))
    server = HTTPServer(('0.0.0.0', port), FridgeHandler)
    server.timeout = 30  # serve_forever循环超时，防止卡死
    server.max_request_size = 2 * 1024 * 1024  # 最大2MB请求体
    # 设置socket超时，防止连接挂死
    server.socket.settimeout(30)
    print(f'Fridge server running on http://localhost:{port}')
    server.serve_forever()
