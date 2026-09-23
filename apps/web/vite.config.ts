import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Phaser alone is ~1.2 MB minified; that is expected for a game engine.
  build: { chunkSizeWarningLimit: 2000 },
  server: {
    port: 5033,
    strictPort: true,
    // Forward API and websocket traffic to the Nest server so the browser only
    // talks to one origin (this also makes LAN play work without extra config).
    proxy: {
      '/api': 'http://localhost:8033',
      '/socket.io': { target: 'http://localhost:8033', ws: true },
    },
  },
});
