import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [
    react(),
    {
      name: 'gdm-websocket',
      hooks: {
        'astro:server:setup': ({ server }) => {
          // Vite dev server exposes httpServer
          const httpServer = server.httpServer;
          if (httpServer) {
            server.ssrLoadModule('./src/lib/ws-server.ts').then(({ initWebSocketServer }) => {
              initWebSocketServer(httpServer);
              console.log('[GDM] WebSocket dev server initialized');
            }).catch(console.error);
          }
        },
      },
    },
  ],
  server: { port: 4321 },
  vite: {
    server: {
      watch: {
        ignored: ['**/data/**'],
      },
    },
  },
});
