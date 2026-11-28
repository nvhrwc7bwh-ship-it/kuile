# -*- coding: utf-8 -*-
"""demo 本地静态服务器（固定端口，便于浏览器验证）"""
import http.server, socketserver, os, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9521
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
os.chdir(ROOT)

Handler = http.server.SimpleHTTPRequestHandler
Handler.extensions_map.update({'.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png'})


class Server(socketserver.TCPServer):
    allow_reuse_address = True


with Server(('127.0.0.1', PORT), Handler) as httpd:
    print('serving on http://127.0.0.1:%d/demo/DEMO.html' % PORT)
    httpd.serve_forever()
