import React, { useState, useEffect } from 'react';
import { useTranslation } from '../useTranslation.js';
import { CardComponent } from './CardComponent.js';
import type { PlayerView, PlayerViewEntry } from '../../lib/game-engine.js';

interface BoardProps {
  state: PlayerView;
  send: (action: string, payload?: Record<string, unknown>) => void;
  peekData: any | null;
  clearPeek: () => void;
}

type SelectionMode =
  | null
  | 'replace'          // pick own card to replace with drawn card
  | 'power-own'        // power: look at own card
  | 'power-opponent'   // power: look at opponent card
  | 'power-swap-pick-target'   // power 10: pick opponent card
  | 'power-swap-pick-own'      // power 10: pick own card to swap
  | 'power-look-swap-target'   // power 15: pick opponent card
  | 'power-look-swap-own'      // power 15 after peek: pick own card (optional)
  | 'special-discard'  // power 20: pick own card to discard
  | 'quick-discard-own'
  | 'quick-discard-pique';

export function Board({ state, send, peekData, clearPeek }: BoardProps) {
  const { t } = useTranslation();
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(null);
  const [swapTargetPlayer, setSwapTargetPlayer] = useState<string | null>(null);
  const [swapTargetIndex, setSwapTargetIndex] = useState<number | null>(null);
  const [quickDiscardPiqueTarget, setQuickDiscardPiqueTarget] = useState<string | null>(null);
  const [qwTimer, setQwTimer] = useState<number>(0);
  const [hasInitiallyPeeked, setHasInitiallyPeeked] = useState(false);

  const me = state.players.find((p) => p.isMe)!;
  const isMyTurn = state.players[state.currentPlayerIndex]?.isMe;
  const opponents = state.players.filter((p) => !p.isMe);

  // Quick discard countdown
  useEffect(() => {
    if (!state.quickDiscardWindow) return;
    const interval = setInterval(() => {
      const secs = Math.max(0, Math.ceil((state.quickDiscardWindow!.deadline - Date.now()) / 1000));
      setQwTimer(secs);
      if (secs === 0) {
        setSelectionMode(null);
        clearInterval(interval);
        if (isMyTurn) send('close-quick-discard');
      }
    }, 200);
    return () => clearInterval(interval);
  }, [state.quickDiscardWindow]);

  // Reset selection on turn change
  useEffect(() => {
    setSelectionMode(null);
    setSwapTargetPlayer(null);
    setSwapTargetIndex(null);
    setQuickDiscardPiqueTarget(null);
  }, [state.currentPlayerIndex, state.turnPhase]);

  function handleCardClick(playerId: string, cardIndex: number, cardValue: number | null) {
    if (!selectionMode) return;

    if (selectionMode === 'replace') {
      send('replace-card', { handIndex: cardIndex });
      setSelectionMode(null);
    } else if (selectionMode === 'power-own') {
      send('power-target', { targetPlayerId: playerId, targetCardIndex: cardIndex });
      setSelectionMode(null);
    } else if (selectionMode === 'power-opponent') {
      send('power-target', { targetPlayerId: playerId, targetCardIndex: cardIndex });
      setSelectionMode(null);
    } else if (selectionMode === 'power-swap-pick-target') {
      setSwapTargetPlayer(playerId);
      setSwapTargetIndex(cardIndex);
      send('power-target', { targetPlayerId: playerId, targetCardIndex: cardIndex });
      setSelectionMode('power-swap-pick-own');
    } else if (selectionMode === 'power-swap-pick-own') {
      send('power-swap-blind', { ownCardIndex: cardIndex });
      setSelectionMode(null);
    } else if (selectionMode === 'power-look-swap-target') {
      send('power-target', { targetPlayerId: playerId, targetCardIndex: cardIndex });
      setSelectionMode(null); // peek result will be shown via peekData
    } else if (selectionMode === 'power-look-swap-own') {
      send('power-swap-confirm', { ownCardIndex: cardIndex, doSwap: true });
      setSelectionMode(null);
    } else if (selectionMode === 'special-discard') {
      send('special-discard', { cardIndex });
      setSelectionMode(null);
    } else if (selectionMode === 'quick-discard-own') {
      send('quick-discard', { cardIndex });
      setSelectionMode(null);
    } else if (selectionMode === 'quick-discard-pique') {
      if (!quickDiscardPiqueTarget) {
        setQuickDiscardPiqueTarget(playerId);
      } else {
        send('quick-discard-opponent', { targetPlayerId: playerId, targetCardIndex: cardIndex });
        setSelectionMode(null);
        setQuickDiscardPiqueTarget(null);
      }
    }
  }

  function cardIsSelectable(playerId: string, isMe: boolean): boolean {
    if (!selectionMode) return false;
    switch (selectionMode) {
      case 'replace': return isMe;
      case 'power-own': return isMe;
      case 'power-opponent': return !isMe;
      case 'power-swap-pick-target': return !isMe;
      case 'power-swap-pick-own': return isMe;
      case 'power-look-swap-target': return !isMe;
      case 'power-look-swap-own': return isMe;
      case 'special-discard': return isMe;
      case 'quick-discard-own': return isMe;
      case 'quick-discard-pique': return !isMe;
      default: return false;
    }
  }

  const currentPlayerName = state.players[state.currentPlayerIndex]?.name ?? '?';

  // Banner message
  function getBannerText(): string {
    if (state.phase === 'initial-peek' && !hasInitiallyPeeked) return t('game.peekInitial');
    if (state.phase === 'last-round') return t('game.lastRound', { name: state.players.find((p) => p.id === state.lastRoundAnnouncerId)?.name ?? '?' });
    if (state.phase === 'round-end') return t('game.roundEnd');
    if (state.phase === 'game-over') return state.winner ? t('game.winner', { name: state.players.find((p) => p.id === state.winner)?.name ?? '?' }) : t('game.gameOver');
    if (isMyTurn) {
      if (state.turnPhase === 'await-draw') return t('game.yourTurn');
      if (state.turnPhase === 'await-action') return me.hand.length > 0 ? t('cards.selectToReplace') : '…';
    }
    if (selectionMode) {
      const msgs: Record<string, string> = {
        'replace': t('cards.selectToReplace'),
        'power-own': t('cards.selectOwn'),
        'power-opponent': t('cards.selectOpponent'),
        'power-swap-pick-target': t('cards.selectOpponent'),
        'power-swap-pick-own': t('cards.selectSwap'),
        'power-look-swap-target': t('cards.selectOpponent'),
        'power-look-swap-own': t('cards.selectSwap'),
        'special-discard': t('cards.selectOwn'),
        'quick-discard-own': t('game.quickDiscardOwn', { value: state.quickDiscardWindow?.discardedValue ?? '' }),
        'quick-discard-pique': t('game.quickDiscardOpponent', { value: state.quickDiscardWindow?.discardedValue ?? '' }),
      };
      return msgs[selectionMode] ?? '';
    }
    return t('game.waitingFor', { name: currentPlayerName });
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', fontFamily: "'Nunito', sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ fontWeight: 900, fontSize: 16, color: '#38bdf8' }}>{t('app.title')}</span>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#94a3b8' }}>
          {state.players.map((p) => (
            <span key={p.id} style={{ fontWeight: p.isMe ? 700 : 400, color: p.isMe ? '#38bdf8' : '#94a3b8' }}>
              {p.name}: <strong style={{ color: p.totalScore >= 80 ? '#f87171' : 'inherit' }}>{p.totalScore}</strong>
            </span>
          ))}
        </div>
        <span style={{ fontWeight: 700, color: '#64748b', fontSize: 13, fontFamily: 'monospace' }}>{state.code}</span>
      </div>

      {/* Status banner */}
      <div style={{ background: isMyTurn && state.phase === 'playing' ? 'linear-gradient(90deg, #0ea5e9, #38bdf8)' : 'rgba(255,255,255,0.08)', padding: '10px 20px', textAlign: 'center', fontWeight: 700, fontSize: 14, color: isMyTurn ? '#fff' : '#94a3b8', transition: 'background 0.3s' }}>
        {getBannerText()}
        {state.quickDiscardWindow && (
          <span style={{ marginLeft: 10, background: '#f59e0b', color: '#1e293b', borderRadius: 20, padding: '2px 10px', fontSize: 12 }}>
            {qwTimer}s
          </span>
        )}
      </div>

      {/* Peek modal */}
      {peekData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={clearPeek}>
          <div style={{ background: '#1e293b', borderRadius: 16, padding: 28, textAlign: 'center', maxWidth: 280 }}>
            {peekData.type === 'peek-initial' ? (
              <>
                <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: 14 }}>{t('game.peekInitial')}</p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  {peekData.cards?.map((c: any) => (
                    <CardComponent key={c.cardIndex} value={c.value} size="lg" />
                  ))}
                </div>
              </>
            ) : (
              <>
                <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: 14 }}>{t('game.peek')}</p>
                <CardComponent value={peekData.data?.value ?? null} size="lg" />
              </>
            )}
            <button onClick={clearPeek} style={{ marginTop: 20, padding: '10px 24px', borderRadius: 10, border: 'none', background: '#38bdf8', color: '#0f172a', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              OK
            </button>
          </div>
        </div>
      )}

      {/* Round end modal */}
      {(state.phase === 'round-end' || state.phase === 'game-over') && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1e293b', borderRadius: 20, padding: 32, maxWidth: 380, width: '90%', textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 22, color: '#f0f9ff' }}>
              {state.phase === 'game-over' ? t('game.gameOver') : t('game.roundEnd')}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {[...state.players].sort((a, b) => (a.roundScore ?? 0) - (b.roundScore ?? 0)).map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderRadius: 10, background: p.isMe ? 'rgba(56,189,248,0.1)' : 'rgba(255,255,255,0.05)', border: p.id === state.lastRoundAnnouncerId ? '2px solid #38bdf8' : '2px solid transparent' }}>
                  <span style={{ fontWeight: 700 }}>{p.name} {p.id === state.lastRoundAnnouncerId ? '🐦' : ''}</span>
                  <span>
                    <strong style={{ fontSize: 18 }}>{p.roundScore ?? '?'}</strong>
                    <span style={{ color: '#64748b', fontSize: 13, marginLeft: 8 }}>({p.totalScore} {t('game.totalScore')})</span>
                  </span>
                </div>
              ))}
            </div>
            {state.phase === 'game-over' && state.winner && (
              <p style={{ fontSize: 20, fontWeight: 900, color: '#fbbf24', marginBottom: 20 }}>
                🏆 {t('game.winner', { name: state.players.find((p) => p.id === state.winner)?.name ?? '' })}
              </p>
            )}
            {state.phase === 'round-end' && me && (
              <button onClick={() => send('next-round')} style={{ padding: '14px 28px', borderRadius: 12, border: 'none', background: '#38bdf8', color: '#0f172a', fontWeight: 800, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>
                {t('game.nextRound')} →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Initial peek button */}
      {state.phase === 'initial-peek' && !hasInitiallyPeeked && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1e293b', borderRadius: 16, padding: 28, textAlign: 'center', maxWidth: 300 }}>
            <p style={{ margin: '0 0 20px', fontSize: 15, color: '#cbd5e1' }}>{t('game.peekInitial')}</p>
            <button
              onClick={() => { send('peek-initial'); setHasInitiallyPeeked(true); }}
              style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: '#38bdf8', color: '#0f172a', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 15 }}>
              {t('game.peek')} 👀
            </button>
          </div>
        </div>
      )}

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, gap: 16, overflow: 'auto' }}>

        {/* Opponents */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
          {opponents.map((p) => (
            <OpponentArea key={p.id} player={p} selectable={cardIsSelectable(p.id, false)} onCardClick={(i, v) => handleCardClick(p.id, i, v)} isCurrentPlayer={p.isCurrentPlayer} />
          ))}
        </div>

        {/* Center: draw pile + discard */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
          {/* Draw pile */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{t('game.drawPile')} ({state.drawPileSize})</span>
            <div
              onClick={() => {
                if (!isMyTurn || state.turnPhase !== 'await-draw') return;
                send('draw');
              }}
              style={{ cursor: isMyTurn && state.turnPhase === 'await-draw' ? 'pointer' : 'default' }}
            >
              <CardComponent value={null} size="lg" selectable={isMyTurn && state.turnPhase === 'await-draw'} />
            </div>
          </div>

          {/* Discard pile */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{t('game.discard')}</span>
            <div
              onClick={() => {
                if (!isMyTurn || state.turnPhase !== 'await-draw') return;
                send('take-discard');
              }}
              style={{ cursor: isMyTurn && state.turnPhase === 'await-draw' ? 'pointer' : 'default' }}
            >
              <CardComponent
                value={state.topDiscard?.value ?? null}
                size="lg"
                selectable={isMyTurn && state.turnPhase === 'await-draw'}
              />
            </div>
          </div>
        </div>

        {/* My area */}
        <div style={{ marginTop: 'auto' }}>
          <MyArea
            me={me}
            state={state}
            isMyTurn={isMyTurn}
            selectionMode={selectionMode}
            setSelectionMode={setSelectionMode}
            onCardClick={(i, v) => handleCardClick(me.id, i, v)}
            send={send}
          />
        </div>
      </div>

      {/* Quick discard bar */}
      {state.quickDiscardWindow && state.phase === 'playing' && (
        <div style={{ background: '#f59e0b', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
          <span style={{ fontWeight: 800, color: '#1e293b', fontSize: 14 }}>
            {t('game.quickDiscardWindow', { seconds: qwTimer, value: state.quickDiscardWindow.discardedValue })}
          </span>
          <button onClick={() => setSelectionMode('quick-discard-own')} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#1e293b', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
            {t('game.quickDiscardOwn', { value: state.quickDiscardWindow.discardedValue })}
          </button>
          {state.players.length >= 3 && (
            <button onClick={() => setSelectionMode('quick-discard-pique')} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#dc2626', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
              {t('game.quickDiscardOpponent', { value: state.quickDiscardWindow.discardedValue })}
            </button>
          )}
        </div>
      )}

      {/* Event log */}
      <EventLog log={state.log} players={state.players} />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OpponentArea({ player, selectable, onCardClick, isCurrentPlayer }: {
  player: PlayerViewEntry;
  selectable: boolean;
  onCardClick: (index: number, value: number | null) => void;
  isCurrentPlayer: boolean;
}) {
  return (
    <div style={{ background: isCurrentPlayer ? 'rgba(56,189,248,0.1)' : 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '12px 16px', border: isCurrentPlayer ? '2px solid #38bdf8' : '2px solid transparent', transition: 'all 0.3s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#cbd5e1' }}>{player.name}</span>
        <span style={{ fontSize: 12, color: '#475569' }}>{player.totalScore} pts</span>
        {isCurrentPlayer && <span style={{ fontSize: 11, background: '#38bdf8', color: '#0f172a', borderRadius: 20, padding: '1px 8px', fontWeight: 700 }}>▶</span>}
        {!player.connected && <span style={{ fontSize: 11, color: '#ef4444' }}>●</span>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {player.hand.map((c) => (
          <CardComponent
            key={c.cardId}
            value={c.value}
            size="sm"
            selectable={selectable}
            onClick={selectable ? () => onCardClick(c.index, c.value) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function MyArea({ me, state, isMyTurn, selectionMode, setSelectionMode, onCardClick, send }: {
  me: PlayerViewEntry;
  state: PlayerView;
  isMyTurn: boolean;
  selectionMode: SelectionMode;
  setSelectionMode: (m: SelectionMode) => void;
  onCardClick: (i: number, v: number | null) => void;
  send: (action: string, payload?: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const hasPower = state.myDrawnCard && [8, 9, 10, 15, 20].includes(state.myDrawnCard.value);
  const canUsePower = hasPower && !state.drawnFromDiscard;

  function startPowerSelection() {
    if (!state.myDrawnCard) return;
    const v = state.myDrawnCard.value;
    if (v === 8) setSelectionMode('power-own');
    else if (v === 9) setSelectionMode('power-opponent');
    else if (v === 10) setSelectionMode('power-swap-pick-target');
    else if (v === 15) setSelectionMode('power-look-swap-target');
    else if (v === 20) {
      send('use-power');
      setSelectionMode('special-discard');
    }
    if (v !== 20) send('use-power');
  }

  return (
    <div style={{ background: 'rgba(56,189,248,0.08)', borderRadius: 16, padding: '16px', border: '2px solid rgba(56,189,248,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#38bdf8' }}>{me.name} ({t('game.score')}: {me.totalScore})</span>
        {isMyTurn && <span style={{ fontSize: 12, background: '#38bdf8', color: '#0f172a', borderRadius: 20, padding: '2px 10px', fontWeight: 700 }}>{t('game.yourTurn')}</span>}
      </div>

      {/* My hand */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {me.hand.map((c) => (
          <div key={c.cardId} style={{ position: 'relative' }}>
            <CardComponent
              value={c.value}
              size="md"
              selectable={!!selectionMode && ['replace', 'power-own', 'power-swap-pick-own', 'power-look-swap-own', 'special-discard', 'quick-discard-own'].includes(selectionMode)}
              onClick={() => onCardClick(c.index, c.value)}
              revealed={c.revealed}
            />
            {c.revealed && c.value !== null && (
              <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', fontSize: 10, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '1px 6px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                {c.value}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Drawn card */}
      {state.myDrawnCard && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, padding: '12px 14px', background: 'rgba(56,189,248,0.1)', borderRadius: 12, border: '1px dashed rgba(56,189,248,0.4)' }}>
          <CardComponent value={state.myDrawnCard.value} size="md" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => setSelectionMode('replace')} style={actionBtn('#38bdf8', '#0f172a')}>
              {t('game.replace')}
            </button>
            <button onClick={() => send('discard-drawn')} style={actionBtn('#475569', 'white')}>
              {t('game.discardDrawn')}
            </button>
            {canUsePower && (
              <button onClick={startPowerSelection} style={actionBtn('#7c3aed', 'white')}>
                ✨ {t('game.usePower')}
              </button>
            )}
          </div>
          {hasPower && state.myDrawnCard && (
            <div style={{ fontSize: 12, color: '#a78bfa', maxWidth: 160 }}>
              {t(`powers.${['look-own','look-opponent','swap-blind','look-and-swap','discard-own'][[8,9,10,15,20].indexOf(state.myDrawnCard.value)] ?? 'look-own'}`)}
            </div>
          )}
        </div>
      )}

      {/* Actions when it's my turn, no drawn card */}
      {isMyTurn && !state.myDrawnCard && state.turnPhase === 'await-draw' && state.phase === 'playing' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => send('announce')} style={actionBtn('#f59e0b', '#1e293b')}>
            🐦 {t('game.announce')}
          </button>
        </div>
      )}

      {/* Power look-and-swap: after peek, offer to swap or pass */}
      {state.pendingPower?.power === 'look-and-swap' && isMyTurn && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={() => setSelectionMode('power-look-swap-own')} style={actionBtn('#7c3aed', 'white')}>
            ↔ Swap
          </button>
          <button onClick={() => send('power-swap-confirm', { ownCardIndex: 0, doSwap: false })} style={actionBtn('#475569', 'white')}>
            ✗ Pass
          </button>
        </div>
      )}
    </div>
  );
}

function EventLog({ log, players }: { log: any[]; players: any[] }) {
  const { t } = useTranslation();
  if (!log.length) return null;
  return (
    <div style={{ maxHeight: 80, overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      {[...log].reverse().slice(0, 8).map((e, i) => {
        const name = e.playerName ?? '';
        const value = e.payload?.value ?? e.payload?.discardedValue ?? e.payload?.cardValue ?? '';
        const key = `log.${e.type}`;
        const text = t(key, { name, value: String(value) });
        return (
          <div key={i} style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>{text}</div>
        );
      })}
    </div>
  );
}

function actionBtn(bg: string, color: string): React.CSSProperties {
  return {
    padding: '8px 14px',
    borderRadius: 8,
    border: 'none',
    background: bg,
    color,
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  };
}
