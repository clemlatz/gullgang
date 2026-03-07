// Custom Node.js entry point that wires up WebSocket support
import { createServer } from 'http';
import { handler } from './dist/server/entry.mjs';
import { initWebSocketServer } from './dist/server/chunks/ws-server.mjs';

const PORT = process.env.PORT ?? 4321;

const server = createServer(handler);

// Make the server accessible to middleware
globalThis.__gdmHttpServer = server;
initWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`[GDM] Server running on http://localhost:${PORT}`);
});
