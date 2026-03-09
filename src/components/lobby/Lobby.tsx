import React, { useState } from 'react';
import { useTranslation } from '../useTranslation.js';

interface LobbyProps {
  onJoined: (code: string, playerId: string) => void;
  initialCode?: string;
}

export function Lobby({ onJoined, initialCode }: LobbyProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'home' | 'create' | 'join'>(initialCode ? 'join' : 'home');
  const [name, setName] = useState(() => localStorage.getItem('playerName') ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!name.trim()) { setError(t('errors.nameRequired')); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem('playerName', name.trim());
      onJoined(data.code, data.playerId);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!name.trim()) { setError(t('errors.nameRequired')); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/games/${initialCode!.trim().toUpperCase()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem('playerName', name.trim());
      onJoined(data.code, data.playerId);
    } catch (e: any) {
      setError(e.message ?? t('errors.gameNotFound'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0ea5e9 0%, #0284c7 40%, #075985 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Nunito', sans-serif" }}>
      <div style={{ maxWidth: 420, width: '100%' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: -10, marginBottom: 16 }}>
            {[0, 1, 2].map((i) => (
              <img key={i} src="/cards/card_back.png" alt="" style={{ width: 60, height: 84, borderRadius: 6, border: '2px solid white', marginLeft: i > 0 ? -20 : 0, transform: `rotate(${(i - 1) * 12}deg)`, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }} />
            ))}
          </div>
          <h1 style={{ color: 'white', fontSize: 36, fontWeight: 900, margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.3)', letterSpacing: '-0.5px' }}>
            {t('app.title')}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', margin: '4px 0 0', fontSize: 14 }}>
            {t('app.subtitle')}
          </p>
        </div>

        {/* Card */}
        <div style={{ background: 'white', borderRadius: 20, padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
          {mode === 'home' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <button onClick={() => setMode('create')} style={btnStyle('#0ea5e9')}>
                🐦 {t('lobby.create')}
              </button>
            </div>
          )}

          {mode === 'create' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: 20, fontWeight: 800 }}>
                {t('lobby.create')}
              </h2>
              <input
                style={inputStyle}
                placeholder={t('lobby.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
                maxLength={24}
              />
              {error && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{error}</p>}
              <button onClick={handleCreate} disabled={loading} style={btnStyle('#0ea5e9')}>
                {loading ? '…' : t('lobby.createBtn')}
              </button>
              <button onClick={() => { setMode('home'); setError(''); }} style={btnStyle('#94a3b8', true)}>
                ← Back
              </button>
            </div>
          )}

          {mode === 'join' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: 20, fontWeight: 800 }}>
                {t('lobby.join')}
              </h2>
              <input
                style={inputStyle}
                placeholder={t('lobby.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                maxLength={24}
                autoFocus
              />
              {error && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{error}</p>}
              <button onClick={handleJoin} disabled={loading} style={btnStyle('#0ea5e9')}>
                {loading ? '…' : t('lobby.joinBtn')}
              </button>
              <button onClick={() => { window.location.href = '/'; }} style={btnStyle('#94a3b8', true)}>
                ← Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: '2px solid #e2e8f0',
  fontSize: 16,
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
  width: '100%',
  boxSizing: 'border-box',
};

function btnStyle(bg: string, ghost?: boolean): React.CSSProperties {
  return {
    padding: '13px 20px',
    borderRadius: 12,
    border: ghost ? `2px solid ${bg}` : 'none',
    background: ghost ? 'transparent' : bg,
    color: ghost ? bg : 'white',
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.15s, transform 0.1s',
  };
}
