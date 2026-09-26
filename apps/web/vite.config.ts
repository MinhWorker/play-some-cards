import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig } from 'vite';

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

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(commit()),
    // Work-in-progress games are locked on the production site only (not in dev or PR previews).
    __SHOW_WIP__: JSON.stringify(process.env.VERCEL_ENV !== 'production'),
    // The dev tools panel (lib/devTools.ts), also outside production only.
    __DEV_TOOLS__: JSON.stringify(process.env.VERCEL_ENV !== 'production'),
  },
  // `@/…` means `src/…` (also set in tsconfig.json), so imports don't need ../../
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    // Games and the SDK are used as TypeScript source (hot reload), not their built dist/.
    conditions: ['psc-source', ...defaultClientConditions],
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
    },
  },
});
