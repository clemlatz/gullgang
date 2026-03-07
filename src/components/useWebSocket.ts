import { useState, useEffect, useRef, useCallback } from 'react';
import type { PlayerView } from '../lib/game-engine.js';

type WSStatus = 'connecting' | 'connected' | 'disconnected';

interface UseWebSocketReturn {
  state: PlayerView | null;
  status: WSStatus;
  peekData: any | null;
  send: (action: string, payload?: Record<string, unknown>) => void;
  clearPeek: () => void;
}

export function useWebSocket(code: string, playerId: string): UseWebSocketReturn {
  const [gameState, setGameState] = useState<PlayerView | null>(null);
  const [status, setStatus] = useState<WSStatus>('connecting');
  const [peekData, setPeekData] = useState<any | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!code || !playerId) return;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocol}://${window.location.host}/ws?code=${code}&playerId=${playerId}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => setStatus('connected');

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'state') {
          setGameState(msg.data);
        } else if (msg.type === 'peek' || msg.type === 'peek-initial') {
          setPeekData(msg);
        }
      } catch {}
    };

    ws.onclose = () => {
      setStatus('disconnected');
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [code, playerId]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((action: string, payload: Record<string, unknown> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action, ...payload }));
    }
  }, []);

  const clearPeek = useCallback(() => setPeekData(null), []);

  return { state: gameState, status, peekData, send, clearPeek };
}
