// The dev web server (`npm run dev`): serves the Godot client's web build (apps/client/dist, from
// `npm run godot:export`) at / and forwards /api and the /ws WebSocket to the game server, so the
// browser talks to one origin (this also makes LAN play work without extra config). Production
// serves the same build from Vercel (vercel.json).
//
// WEB_PORT moves this server (default 5033), PORT the game server it forwards to (default 8033).
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { connect } from 'node:net';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const webPort = Number(process.env.WEB_PORT ?? 5033);
const apiPort = Number(process.env.PORT ?? 8033);
const dist = fileURLToPath(new URL('../apps/client/dist', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return forward(req, res);
  // Old links to the client's former home.
  if (url.pathname === '/godot' || url.pathname.startsWith('/godot/')) {
    const path = url.pathname.slice('/godot'.length) || '/';
    res.writeHead(302, { Location: path + url.search }).end();
    return;
  }
  const path = normalize(decodeURIComponent(url.pathname));
  const file = join(dist, path === '/' ? 'index.html' : path);
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(existsSync(dist) ? 'Not found' : 'No Godot build: npm run godot:export -- --debug');
    return;
  }
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  createReadStream(file).pipe(res);
});

/** An /api request, passed to the game server as it is. */
function forward(req, res) {
  const upstream = request(
    { host: 'localhost', port: apiPort, path: req.url, method: req.method, headers: req.headers },
    (reply) => {
      res.writeHead(reply.statusCode ?? 502, reply.headers);
      reply.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Game server not reachable');
  });
  req.pipe(upstream);
}

// The WebSocket (/ws): the upgrade request is replayed to the game server, then both sockets are
// piped together.
server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url ?? '/', 'http://x').pathname !== '/ws') return socket.destroy();
  const upstream = connect(apiPort, 'localhost', () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    }
    upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (head.length) upstream.write(head);
    upstream.pipe(socket).pipe(upstream);
  });
  const close = () => {
    upstream.destroy();
    socket.destroy();
  };
  upstream.on('error', close);
  socket.on('error', close);
});

server.listen(webPort, '0.0.0.0', () => {
  console.log(`Web on http://localhost:${webPort} (the Godot build in apps/client/dist)`);
});
