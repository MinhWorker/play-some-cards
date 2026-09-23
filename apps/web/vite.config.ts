import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
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
