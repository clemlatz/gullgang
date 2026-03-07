// Dev helper: hooks WebSocket server into Astro's Node HTTP server
// This is called from the custom astro.config.mjs hook
import { initWebSocketServer } from './lib/ws-server.js';

export function setupDevServer(server: any) {
  globalThis.__gdmHttpServer = server;
  initWebSocketServer(server);
  console.log('[GDM] WebSocket dev server ready');
}
