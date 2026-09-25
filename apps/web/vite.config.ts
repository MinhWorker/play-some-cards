import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Ports can be moved (e.g. to run a second copy of the repo next to the first one):
// WEB_PORT for this dev server, PORT for the game server it forwards to (same as the server's).
const webPort = Number(process.env.WEB_PORT ?? 5033);
const api = `http://localhost:${process.env.PORT ?? 8033}`;

export default defineConfig({
  plugins: [react()],
  // `@/…` means `src/…` (also set in tsconfig.json), so imports don't need ../../
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
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
