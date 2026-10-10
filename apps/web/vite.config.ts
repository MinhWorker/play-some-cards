import { execSync } from 'node:child_process';
import { cpSync, createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { PROTOCOL_VERSION } from '@xomdao/shared';
import { defaultClientConditions, defineConfig, type Plugin } from 'vite';

// Ports can be moved (e.g. to run a second copy of the repo next to the first one):
// WEB_PORT for this dev server, PORT for the game server it forwards to (same as the server's).
const webPort = Number(process.env.WEB_PORT ?? 5033);
const api = `http://localhost:${process.env.PORT ?? 8033}`;

// Shown small in the bottom-left corner (VersionTag). The version is bumped by release-please in the root package.json.
const version = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
  .version as string;
function commit() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

const deployment = {
  commit: commit(),
  protocol: PROTOCOL_VERSION,
  waitForServer: process.env.VERCEL_ENV === 'production',
};

// The Godot client's web build (npm run godot:export → apps/client/dist) lives at /godot/: served
// from there in dev, copied into this app's dist/ by `vite build` when it exists.
const godotDist = fileURLToPath(new URL('../client/dist', import.meta.url));
const GODOT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
};
function godot(): Plugin {
  let outDir = '';
  return {
    name: 'xomdao-godot',
    configResolved: (config) => {
      outDir = join(config.root, config.build.outDir);
    },
    configureServer: (server) => {
      server.middlewares.use('/godot', (req, res) => {
        const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
        if (req.originalUrl?.split('?')[0] === '/godot') {
          res.writeHead(302, { Location: req.originalUrl.replace('/godot', '/godot/') }).end();
          return;
        }
        const file = join(godotDist, path === '/' ? 'index.html' : path);
        if (!file.startsWith(godotDist) || !existsSync(file) || statSync(file).isDirectory()) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end(existsSync(godotDist) ? 'Not found' : 'No Godot build: npm run godot:export');
          return;
        }
        res.writeHead(200, {
          'Content-Type': GODOT_TYPES[extname(file)] ?? 'application/octet-stream',
          'Cache-Control': 'no-cache',
        });
        createReadStream(file).pipe(res);
      });
    },
    closeBundle: () => {
      if (existsSync(join(godotDist, 'index.html')))
        cpSync(godotDist, join(outDir, 'godot'), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    godot(),
    {
      name: 'xomdao-build',
      transformIndexHtml: () => [
        { tag: 'meta', attrs: { name: 'xomdao-build', content: JSON.stringify(deployment) } },
      ],
    },
  ],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(deployment.commit),
    __WAIT_FOR_SERVER__: JSON.stringify(deployment.waitForServer),
    // Work-in-progress games are locked on the production site only (not in dev or PR previews).
    __SHOW_WIP__: JSON.stringify(process.env.VERCEL_ENV !== 'production'),
    // The dev tools panel (lib/devTools.ts), also outside production only.
    __DEV_TOOLS__: JSON.stringify(process.env.VERCEL_ENV !== 'production'),
  },
  // `@/…` means `src/…` (also set in tsconfig.json), so imports don't need ../../
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    // Games and the SDK are used as TypeScript source (hot reload), not their built dist/.
    conditions: ['xomdao-source', ...defaultClientConditions],
  },
  // Phaser alone is ~1.2 MB minified; that is expected for a game engine.
  build: { chunkSizeWarningLimit: 2000 },
  server: {
    port: webPort,
    strictPort: true,
    // Forward API and websocket traffic to the Nest server so the browser only
    // talks to one origin (this also makes LAN play work without extra config).
    proxy: {
      '/api': api,
      '/socket.io': { target: api, ws: true },
      // The Godot client's WebSocket (/godot/ above).
      '^/ws$': { target: api, ws: true },
    },
  },
});
