"""Local server for the longread (3D models can't load from file://).
Usage: python3 serve.py  ->  http://localhost:4173"""
import functools, http.server, os, sys, webbrowser, threading

args = [a for a in sys.argv[1:] if not a.startswith('--')]
ROOT = args[0] if args else os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get('PORT') or next((a.split('=')[1] for a in sys.argv if a.startswith('--port=')), 4173))

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.css': 'text/css'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *a):
        pass

if __name__ == '__main__':
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Handler, directory=ROOT))
    if '--no-open' not in sys.argv:
        threading.Timer(0.6, lambda: webbrowser.open(f'http://localhost:{PORT}/')).start()
    print(f'Spotify Wrapped: http://localhost:{PORT}/  (Ctrl+C — остановить)')
    srv.serve_forever()
