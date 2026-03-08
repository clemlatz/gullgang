import React, { useState, useEffect } from 'react';
import { Lobby } from './lobby/Lobby.js';
import { WaitingRoom } from './lobby/WaitingRoom.js';
import { Board } from './game/Board.js';
import { useWebSocket } from './useWebSocket.js';

interface Session {
  code: string;
  playerId: string;
}

const SESSION_KEY = 'gdm_session';

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(s: Session): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {}
}

export default function App({ initialCode }: { initialCode?: string }) {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  function handleJoined(code: string, playerId: string) {
    saveSession({ code, playerId });
    window.location.href = `/game/${code}`;
  }

  if (!session) {
    return <Lobby onJoined={handleJoined} initialCode={initialCode} />;
  }

  function handleLeave() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = '/';
  }

  return <GameApp session={session} onLeave={handleLeave} />;
}

function GameApp({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const { state, status, peekData, abandonedBy, send, clearPeek, clearAbandoned } = useWebSocket(session.code, session.playerId);

  // Handle game not found (stale session)
  if (status === 'connected' && !state) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'Nunito, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 18, marginBottom: 16 }}>Game not found or session expired.</p>
          <button onClick={onLeave} style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: '#38bdf8', color: '#0f172a', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Back to lobby
          </button>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'Nunito, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🐦</div>
          <p style={{ color: '#64748b' }}>Connecting{status === 'disconnected' ? ' (reconnecting…)' : '…'}</p>
        </div>
      </div>
    );
  }

  const isHost = state.players[0]?.id === session.playerId;

  if (state.phase === 'lobby') {
    return (
      <WaitingRoom
        state={state}
        isHost={isHost}
        onStartGame={() => send('start-game')}
        onLeave={onLeave}
      />
    );
  }

  return (
    <Board
      state={state}
      send={send}
      peekData={peekData}
      clearPeek={clearPeek}
      onLeave={onLeave}
      abandonedBy={abandonedBy}
      clearAbandoned={clearAbandoned}
    />
  );
}
