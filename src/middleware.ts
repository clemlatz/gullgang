// Astro middleware — initializes the WebSocket server on first request
let wsInitialized = false;

export function onRequest(context: any, next: () => Promise<Response>): Promise<Response> {
  if (!wsInitialized) {
    wsInitialized = true;
    try {
      const server = (globalThis as any).__gdmHttpServer;
      if (server) {
        import('./lib/ws-server.js').then(({ initWebSocketServer }) => {
          initWebSocketServer(server);
          console.log('[GDM] WebSocket server initialized');
        });
      }
    } catch (e) {
      console.error('[GDM] Failed to init WS:', e);
    }
  }
  return next();
}
