const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8"
};

function jsString(value) {
  return JSON.stringify(String(value || ""));
}

function runtimeConfigScript() {
  const enabled = ["1", "true", "yes", "on"].includes(String(process.env.SUPABASE_ENABLED || "").toLowerCase());
  return `window.FridgeSupabaseConfig = {
  enabled: ${enabled && Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)},
  url: ${jsString(process.env.SUPABASE_URL)},
  anonKey: ${jsString(process.env.SUPABASE_ANON_KEY)},
  stateTable: ${jsString(process.env.SUPABASE_STATE_TABLE || "fridge_states")}
};`;
}

function safeFilePath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0]);
  const requestedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const filePath = path.normalize(path.join(root, requestedPath));
  if (!filePath.startsWith(root)) return null;
  return filePath;
}

const server = http.createServer((req, res) => {
  if ((req.url || "").split("?")[0] === "/runtime-config.js") {
    const content = runtimeConfigScript();
    res.writeHead(200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-cache"
    });
    res.end(content);
    return;
  }

  const filePath = safeFilePath(req.url || "/");
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      fs.readFile(path.join(root, "index.html"), (indexError, indexContent) => {
        if (indexError) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, {
          "Content-Type": mimeTypes[".html"],
          "Cache-Control": "no-cache"
        });
        res.end(indexContent);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const isServiceWorker = path.basename(filePath) === "sw.js";
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": isServiceWorker ? "no-cache" : "public, max-age=3600"
    });
    res.end(content);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`冰箱便签 PWA 已启动：http://0.0.0.0:${port}`);
});
