// A small stand-in for deploy/nginx/default.conf: /api goes to the backend, everything else to the web server. Same routing, no Docker.
import http from 'node:http';

const PORT = Number(process.env.EDGE_PORT ?? 24080);
const BACKEND = new URL(process.env.BACKEND ?? 'http://127.0.0.1:28080');
const WEB = new URL(process.env.WEB ?? 'http://127.0.0.1:24000');

http.createServer((req, res) => {
  const target = req.url.startsWith('/api/') ? BACKEND : WEB;
  const headers = { ...req.headers, 'x-forwarded-for': req.socket.remoteAddress ?? '', 'x-forwarded-proto': 'http' };
  const upstream = http.request({ host: target.hostname, port: target.port, method: req.method, path: req.url, headers }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  upstream.on('error', (e) => { if (!res.headersSent) res.writeHead(502); res.end('Bad gateway: ' + e.message); });
  req.pipe(upstream);
}).listen(PORT, '127.0.0.1', () => console.log(`edge listening on ${PORT}`));
