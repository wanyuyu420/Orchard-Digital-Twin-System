"""
Orchard 2.0 3D Tiles static server (CORS-enabled).

Serves the tiles/ directory of the 果园2.0 dataset on port 8765 so the
frontend Cesium viewer can load trees/orchard 3D Tiles cross-origin.
Data stays in place (no copying); this is a read-only static file server.

Usage:
    python scripts/serve_orchard.py [--port 8765]
"""
import argparse
import http.server
import os
import sys
import threading

# Directory that contains tiles/{trees,orchard,dom,...}. Adjust if moved.
DEFAULT_ROOT = r"D:\Esri_data_4people\qc_data"

MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".b3dm": "application/octet-stream",
    ".pnts": "application/octet-stream",
    ".i3dm": "application/octet-stream",
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".wasm": "application/wasm",
    ".xml": "text/xml",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
}


class CORSHandler(http.server.SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler that adds CORS headers so Cesium can load cross-origin."""

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        return MIME.get(ext, "application/octet-stream")

    def log_message(self, fmt, *args):
        print(f"[serve_orchard] {self.address_string()} {fmt % args}", flush=True)


def main():
    parser = argparse.ArgumentParser(description="Serve orchard 3D Tiles with CORS")
    parser.add_argument("--port", type=int, default=8766)
    parser.add_argument("--dir", default=DEFAULT_ROOT)
    args = parser.parse_args()

    root = os.path.abspath(args.dir)
    if not os.path.isdir(os.path.join(root, "trees")):
        print(f"[serve_orchard] ERROR: expected {root}\\trees to exist", file=sys.stderr)
        sys.exit(1)

    os.chdir(root)
    handler = lambda *a, **kw: CORSHandler(*a, directory=root, **kw)
    server = http.server.ThreadingHTTPServer(("0.0.0.0", args.port), handler)

    print(f"[serve_orchard] Serving {root}", flush=True)
    print(f"[serve_orchard] http://localhost:{args.port}/trees/tileset.json", flush=True)
    print(f"[serve_orchard] http://localhost:{args.port}/orchard/tileset.json", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
