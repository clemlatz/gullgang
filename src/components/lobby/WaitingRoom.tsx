import React, { useState, useEffect } from 'react';
import { useTranslation } from '../useTranslation.js';
import type { PlayerView } from '../../lib/game-engine.js';

interface WaitingRoomProps {
  state: PlayerView;
  onStartGame: () => void;
  onLeave: () => void;
  isHost: boolean;
}

export function WaitingRoom({ state, onStartGame, onLeave, isHost }: WaitingRoomProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const canStart = state.players.length >= 2;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0ea5e9 0%, #0284c7 40%, #075985 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Nunito', sans-serif" }}>
      <div style={{ maxWidth: 460, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ color: 'white', fontSize: 28, fontWeight: 900, margin: 0 }}>{t('app.title')}</h1>
        </div>

        <div style={{ background: 'white', borderRadius: 20, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
          {/* Share code */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: 13 }}>{t('lobby.shareCode')}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0f9ff', border: '2px solid #bae6fd', borderRadius: 10, padding: '8px 12px' }}>
              <span style={{ flex: 1, fontSize: 13, color: '#0284c7', fontFamily: 'monospace', wordBreak: 'break-all', textAlign: 'left' }}>
                {typeof window !== 'undefined' ? window.location.href : ''}
              </span>
              <button onClick={copyCode} style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 8, border: '2px solid #0284c7', background: 'transparent', color: '#0284c7', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                {copied ? t('lobby.codeCopied') : t('lobby.copyCode')}
              </button>
            </div>
          </div>

          {/* Players list */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('lobby.players')} ({state.players.length}/8)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {state.players.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: p.isMe ? '#eff6ff' : '#f8fafc', border: p.isMe ? '2px solid #bfdbfe' : '2px solid transparent' }}>
                  <span style={{ fontSize: 20 }}>🐦</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{p.name}</span>
                  {i === 0 && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '2px 8px', borderRadius: 20 }}>HOST</span>}
                  {p.isMe && i > 0 && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#7c3aed', background: '#ede9fe', padding: '2px 8px', borderRadius: 20 }}>YOU</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Waiting / Start */}
          {isHost ? (
            <>
              {!canStart && (
                <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', margin: '0 0 16px' }}>
                  {t('lobby.minPlayers')}
                </p>
              )}
              <button
                onClick={onStartGame}
                disabled={!canStart}
                style={{ width: '100%', padding: '14px 20px', borderRadius: 12, border: 'none', background: canStart ? '#0ea5e9' : '#e2e8f0', color: canStart ? 'white' : '#94a3b8', fontWeight: 800, fontSize: 16, cursor: canStart ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                {t('lobby.startGame')} 🐦
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: '#64748b', fontSize: 14 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#0ea5e9', animation: 'pulse 1.5s infinite' }} />
                {t('lobby.waitingFor')}
              </div>
            </div>
          )}
          <button
            onClick={onLeave}
            style={{ width: '100%', marginTop: 12, padding: '10px 20px', borderRadius: 12, border: '2px solid #94a3b8', background: 'transparent', color: '#94a3b8', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}
