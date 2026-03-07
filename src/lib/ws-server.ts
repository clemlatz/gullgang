import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { loadGame, saveGame } from './db.js';
import {
  buildPlayerView,
  startRound,
  playerPeekInitial,
  actionDraw,
  actionTakeDiscard,
  actionReplaceCard,
  actionDiscardDrawn,
  actionUsePower,
  actionPowerTarget,
  actionPowerSwapConfirm,
  actionPowerSwapBlind,
  actionSpecialDiscard,
  actionQuickDiscard,
  actionQuickDiscardOpponent,
  actionAnnounce,
  closeQuickDiscardWindow,
  type GameState,
} from './game-engine.js';

interface Client {
  ws: WebSocket;
  gameCode: string;
  playerId: string;
}

const clients = new Map<WebSocket, Client>();
// gameCode -> Set<playerId>
const gameRooms = new Map<string, Set<string>>();

let wss: WebSocketServer | null = null;

export function initWebSocketServer(server: any): void {
  if (wss) return;
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req: IncomingMessage, socket: any, head: any) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    if (url.pathname === '/ws') {
      wss!.handleUpgrade(req, socket, head, (ws) => {
        wss!.emit('connection', ws, req);
      });
    }
  });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const gameCode = url.searchParams.get('code') ?? '';
    const playerId = url.searchParams.get('playerId') ?? '';

    if (!gameCode || !playerId) {
      ws.close(4001, 'Missing code or playerId');
      return;
    }

    clients.set(ws, { ws, gameCode, playerId });
    if (!gameRooms.has(gameCode)) gameRooms.set(gameCode, new Set());
    gameRooms.get(gameCode)!.add(playerId);

    // Mark player connected
    const state = loadGame(gameCode);
    if (state) {
      const player = state.players.find((p) => p.id === playerId);
      if (player) {
        player.connected = true;
        saveGame(state);
        broadcastToGame(gameCode, { type: 'player-connected', playerId });
        // Send current state to joining client
        ws.send(JSON.stringify({ type: 'state', data: buildPlayerView(state, playerId) }));
      }
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleMessage(ws, msg);
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      }
    });

    ws.on('close', () => {
      const client = clients.get(ws);
      if (client) {
        clients.delete(ws);
        const state = loadGame(client.gameCode);
        if (state) {
          const player = state.players.find((p) => p.id === client.playerId);
          if (player) {
            player.connected = false;
            saveGame(state);
          }
        }
        broadcastToGame(client.gameCode, { type: 'player-disconnected', playerId: client.playerId });
      }
    });
  });
}

function handleMessage(ws: WebSocket, msg: any): void {
  const client = clients.get(ws);
  if (!client) return;

  const { gameCode, playerId } = client;
  const state = loadGame(gameCode);
  if (!state) {
    ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
    return;
  }

  let result: { ok: boolean; error?: string; events?: any[] } | null = null;
  let peekData: any = null;

  switch (msg.action) {
    case 'start-game': {
      if (state.phase !== 'lobby') break;
      if (state.players.length < 2) {
        ws.send(JSON.stringify({ type: 'error', message: 'Need at least 2 players' }));
        return;
      }
      state.startedAt = Date.now();
      startRound(state);
      result = { ok: true };
      break;
    }

    case 'peek-initial': {
      if (state.phase !== 'initial-peek') break;
      const peeked = playerPeekInitial(state, playerId);
      saveGame(state);
      ws.send(JSON.stringify({ type: 'peek-initial', cards: peeked }));
      // Check if all players peeked (all have their first 2 revealed)
      const allPeeked = state.players.every((p) => p.hand[0]?.revealed && p.hand[1]?.revealed);
      if (allPeeked) {
        for (const p of state.players) {
          p.hand[0].revealed = false;
          p.hand[1].revealed = false;
        }
        state.phase = 'playing';
        saveGame(state);
        broadcastState(state);
      }
      return;
    }

    case 'draw':
      result = actionDraw(state, playerId);
      break;

    case 'take-discard':
      result = actionTakeDiscard(state, playerId);
      break;

    case 'replace-card':
      result = actionReplaceCard(state, playerId, msg.handIndex);
      break;

    case 'discard-drawn':
      result = actionDiscardDrawn(state, playerId);
      break;

    case 'use-power':
      result = actionUsePower(state, playerId);
      break;

    case 'power-target':
      result = actionPowerTarget(state, playerId, msg.targetPlayerId, msg.targetCardIndex);
      if (result.ok && result.events?.length) {
        peekData = result.events[0];
      }
      break;

    case 'power-swap-confirm':
      result = actionPowerSwapConfirm(state, playerId, msg.ownCardIndex, msg.doSwap);
      break;

    case 'power-swap-blind':
      result = actionPowerSwapBlind(state, playerId, msg.ownCardIndex);
      break;

    case 'special-discard':
      result = actionSpecialDiscard(state, playerId, msg.cardIndex);
      break;

    case 'quick-discard':
      result = actionQuickDiscard(state, playerId, msg.cardIndex);
      break;

    case 'quick-discard-opponent':
      result = actionQuickDiscardOpponent(state, playerId, msg.targetPlayerId, msg.targetCardIndex);
      break;

    case 'close-quick-discard':
      closeQuickDiscardWindow(state);
      result = { ok: true };
      break;

    case 'announce':
      result = actionAnnounce(state, playerId);
      break;

    case 'next-round': {
      if (state.phase !== 'round-end') break;
      startRound(state);
      result = { ok: true };
      break;
    }

    default:
      ws.send(JSON.stringify({ type: 'error', message: `Unknown action: ${msg.action}` }));
      return;
  }

  if (result) {
    if (!result.ok) {
      ws.send(JSON.stringify({ type: 'error', message: result.error }));
      return;
    }
    saveGame(state);

    // Send peek data only to the acting player
    if (peekData) {
      ws.send(JSON.stringify({ type: 'peek', data: peekData.payload }));
    }

    broadcastState(state);
  }
}

export function broadcastState(state: GameState): void {
  for (const [ws, client] of clients) {
    if (client.gameCode !== state.code) continue;
    if (ws.readyState !== WebSocket.OPEN) continue;
    const view = buildPlayerView(state, client.playerId);
    ws.send(JSON.stringify({ type: 'state', data: view }));
  }
}

export function broadcastToGame(gameCode: string, payload: object): void {
  for (const [ws, client] of clients) {
    if (client.gameCode !== gameCode) continue;
    if (ws.readyState !== WebSocket.OPEN) continue;
    ws.send(JSON.stringify(payload));
  }
}
