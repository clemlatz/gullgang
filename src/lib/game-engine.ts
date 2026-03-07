import { buildDeck, shuffleDeck, type Card } from './deck.js';

export type GamePhase =
  | 'lobby'
  | 'initial-peek'   // players look at their 2 nearest cards
  | 'playing'
  | 'last-round'     // after "Gang de mouettes!" announced
  | 'round-end'
  | 'game-over';

export type TurnPhase =
  | 'await-draw'          // player must draw from pile or take discard
  | 'await-action'        // player has drawn, must choose action
  | 'await-power-target'  // player uses power, must pick target
  | 'await-power-swap'    // power 15: after looking, optionally swap
  | 'await-special-discard' // power 20: discard one of own cards
  | 'await-quick-discard' // window for other players to quick-discard
  | 'done';

export interface PlayerCard {
  cardId: string;
  value: number;
  revealed: boolean; // true = this player knows the value
}

export interface Player {
  id: string;
  name: string;
  hand: PlayerCard[];       // 4 cards in front of player
  totalScore: number;
  roundScore: number | null;
  connected: boolean;
}

export interface QuickDiscardWindow {
  triggeredBy: string;          // playerId who discarded
  discardedValue: number;
  deadline: number;             // timestamp ms
  attempts: string[];           // playerIds who already attempted
}

export interface GameState {
  id: string;
  code: string;
  phase: GamePhase;
  players: Player[];
  drawPile: Card[];
  discardPile: Card[];
  currentPlayerIndex: number;
  dealerIndex: number;
  turnPhase: TurnPhase;
  drawnCard: Card | null;          // card currently in hand (drawn this turn)
  drawnFromDiscard: boolean;
  pendingPower: {
    power: string;
    sourceCardId: string;
    peekResult?: { playerId: string; cardIndex: number; value: number } | null;
  } | null;
  lastRoundAnnouncerId: string | null;
  lastRoundTurnsLeft: number;
  quickDiscardWindow: QuickDiscardWindow | null;
  log: GameEvent[];
  createdAt: number;
  startedAt: number | null;
}

export interface GameEvent {
  ts: number;
  type: string;
  playerId?: string;
  playerName?: string;
  payload?: Record<string, unknown>;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createGame(code: string, gameId: string): GameState {
  return {
    id: gameId,
    code,
    phase: 'lobby',
    players: [],
    drawPile: [],
    discardPile: [],
    currentPlayerIndex: 0,
    dealerIndex: 0,
    turnPhase: 'await-draw',
    drawnCard: null,
    drawnFromDiscard: false,
    pendingPower: null,
    lastRoundAnnouncerId: null,
    lastRoundTurnsLeft: 0,
    quickDiscardWindow: null,
    log: [],
    createdAt: Date.now(),
    startedAt: null,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function logEvent(state: GameState, type: string, playerId?: string, payload?: Record<string, unknown>): void {
  const player = playerId ? state.players.find((p) => p.id === playerId) : undefined;
  state.log.push({
    ts: Date.now(),
    type,
    playerId,
    playerName: player?.name,
    payload,
  });
  // Keep log bounded
  if (state.log.length > 200) state.log = state.log.slice(-150);
}

function currentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex];
}

function advanceTurn(state: GameState): void {
  const n = state.players.length;
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % n;
  state.turnPhase = 'await-draw';
  state.drawnCard = null;
  state.drawnFromDiscard = false;
  state.pendingPower = null;

  // Last round management
  if (state.phase === 'last-round') {
    state.lastRoundTurnsLeft -= 1;
    if (state.lastRoundTurnsLeft <= 0) {
      endRound(state);
      return;
    }
  }
}

function reshuffleDiscardIntoDraw(state: GameState): void {
  if (state.discardPile.length <= 1) return;
  const top = state.discardPile[state.discardPile.length - 1];
  const rest = state.discardPile.slice(0, -1);
  // Shuffle rest back into draw
  state.drawPile = shuffleDeck(rest);
  state.discardPile = [top];
  logEvent(state, 'reshuffle');
}

function topDiscard(state: GameState): Card | null {
  return state.discardPile[state.discardPile.length - 1] ?? null;
}

// ─── Round setup ──────────────────────────────────────────────────────────────

export function startRound(state: GameState): void {
  const deck = shuffleDeck(buildDeck());

  // Deal 4 cards to each player
  for (const player of state.players) {
    player.hand = [];
    player.roundScore = null;
    for (let i = 0; i < 4; i++) {
      const card = deck.pop()!;
      player.hand.push({ cardId: card.id, value: card.value, revealed: false });
    }
  }

  // Remaining cards form the draw pile; flip one to start discard
  const firstDiscard = deck.pop()!;
  state.drawPile = deck;
  state.discardPile = [firstDiscard];
  state.drawnCard = null;
  state.drawnFromDiscard = false;
  state.pendingPower = null;
  state.lastRoundAnnouncerId = null;
  state.lastRoundTurnsLeft = 0;
  state.quickDiscardWindow = null;
  state.phase = 'initial-peek';
  state.turnPhase = 'await-draw';
  // Player after dealer starts
  state.currentPlayerIndex = (state.dealerIndex + 1) % state.players.length;

  logEvent(state, 'round-start');
}

export function playerPeekInitial(state: GameState, playerId: string): {
  cardIndex: number;
  value: number;
}[] {
  const player = state.players.find((p) => p.id === playerId)!;
  // Cards 0 and 1 are the "nearest" (indices 0 and 1 by convention)
  player.hand[0].revealed = true;
  player.hand[1].revealed = true;
  return [
    { cardIndex: 0, value: player.hand[0].value },
    { cardIndex: 1, value: player.hand[1].value },
  ];
}

export function allPlayersReady(state: GameState, readySet: Set<string>): boolean {
  return state.players.every((p) => readySet.has(p.id));
}

// ─── Turn actions ─────────────────────────────────────────────────────────────

export type ActionResult =
  | { ok: true; events: GameEvent[] }
  | { ok: false; error: string };

export function actionDraw(state: GameState, playerId: string): ActionResult {
  if (state.turnPhase !== 'await-draw') return { ok: false, error: 'Not your draw phase' };
  if (currentPlayer(state).id !== playerId) return { ok: false, error: 'Not your turn' };

  if (state.drawPile.length === 0) reshuffleDiscardIntoDraw(state);
  if (state.drawPile.length === 0) return { ok: false, error: 'Draw pile empty' };

  const card = state.drawPile.pop()!;
  state.drawnCard = card;
  state.drawnFromDiscard = false;
  state.turnPhase = 'await-action';

  logEvent(state, 'draw', playerId, { cardId: card.id });
  return { ok: true, events: [] };
}

export function actionTakeDiscard(state: GameState, playerId: string): ActionResult {
  if (state.turnPhase !== 'await-draw') return { ok: false, error: 'Not your draw phase' };
  if (currentPlayer(state).id !== playerId) return { ok: false, error: 'Not your turn' };

  const card = topDiscard(state);
  if (!card) return { ok: false, error: 'Discard pile empty' };

  state.discardPile.pop();
  state.drawnCard = card;
  state.drawnFromDiscard = true;
  state.turnPhase = 'await-action';

  logEvent(state, 'take-discard', playerId, { cardId: card.id, value: card.value });
  return { ok: true, events: [] };
}

export function actionReplaceCard(state: GameState, playerId: string, handIndex: number): ActionResult {
  if (state.turnPhase !== 'await-action') return { ok: false, error: 'Wrong phase' };
  if (currentPlayer(state).id !== playerId) return { ok: false, error: 'Not your turn' };
  if (!state.drawnCard) return { ok: false, error: 'No drawn card' };

  const player = state.players.find((p) => p.id === playerId)!;
  if (handIndex < 0 || handIndex >= player.hand.length) return { ok: false, error: 'Invalid card index' };

  const replaced = player.hand[handIndex];
  const discarded: Card = { id: replaced.cardId, value: replaced.value };

  // Put drawn card in hand
  player.hand[handIndex] = {
    cardId: state.drawnCard.id,
    value: state.drawnCard.value,
    revealed: true,
  };

  // Old card goes to discard
  state.discardPile.push(discarded);
  const discardedValue = discarded.value;

  logEvent(state, 'replace-card', playerId, { handIndex, discardedValue });

  // Open quick-discard window
  openQuickDiscardWindow(state, playerId, discardedValue);

  state.drawnCard = null;
  state.turnPhase = 'await-quick-discard';
  return { ok: true, events: [] };
}

export function actionDiscardDrawn(state: GameState, playerId: string): ActionResult {
  if (state.turnPhase !== 'await-action') return { ok: false, error: 'Wrong phase' };
  if (currentPlayer(state).id !== playerId) return { ok: false, error: 'Not your turn' };
  if (!state.drawnCard) return { ok: false, error: 'No drawn card' };

  const card = state.drawnCard;
  state.discardPile.push(card);
  const discardedValue = card.value;

  logEvent(state, 'discard-drawn', playerId, { value: discardedValue });

  openQuickDiscardWindow(state, playerId, discardedValue);
  state.drawnCard = null;
  state.turnPhase = 'await-quick-discard';
  return { ok: true, events: [] };
}

export function actionUsePower(state: GameState, playerId: string): ActionResult {
  if (state.turnPhase !== 'await-action') return { ok: false, error: 'Wrong phase' };
  if (currentPlayer(state).id !== playerId) return { ok: false, error: 'Not your turn' };
  if (!state.drawnCard) return { ok: false, error: 'No drawn card' };
  // Can only use power if card was drawn from draw pile (not discard)
  if (state.drawnFromDiscard) return { ok: false, error: 'Cannot use power of discard card' };

  const card = state.drawnCard;
  const defs: Record<number, string> = { 8: 'look-own', 9: 'look-opponent', 10: 'swap-blind', 15: 'look-and-swap', 20: 'discard-own' };
  const power = defs[card.value];
  if (!power) return { ok: false, error: 'This card has no power' };

  state.pendingPower = { power, sourceCardId: card.id };
  state.discardPile.push(card);
  state.drawnCard = null;

  if (power === 'discard-own') {
    state.turnPhase = 'await-special-discard';
  } else {
    state.turnPhase = 'await-power-target';
  }

  logEvent(state, 'use-power', playerId, { power, cardValue: card.value });
  return { ok: true, events: [] };
}

export function actionPowerTarget(
  state: GameState,
  playerId: string,
  targetPlayerId: string,
  targetCardIndex: number,
): ActionResult {
  if (state.turnPhase !== 'await-power-target') return { ok: false, error: 'Wrong phase' };
  if (currentPlayer(state).id !== playerId) return { ok: false, error: 'Not your turn' };
  if (!state.pendingPower) return { ok: false, error: 'No pending power' };

  const { power } = state.pendingPower;
  const targetPlayer = state.players.find((p) => p.id === targetPlayerId);
  if (!targetPlayer) return { ok: false, error: 'Target player not found' };
  if (targetCardIndex < 0 || targetCardIndex >= targetPlayer.hand.length)
    return { ok: false, error: 'Invalid target card index' };

  if (power === 'look-own') {
    if (targetPlayerId !== playerId) return { ok: false, error: 'Must target own card' };
    const card = targetPlayer.hand[targetCardIndex];
    card.revealed = true;
    state.pendingPower = null;
    logEvent(state, 'power-look-own', playerId, { cardIndex: targetCardIndex, value: card.value });
    advanceTurn(state);
    return { ok: true, events: [] };
  }

  if (power === 'look-opponent') {
    if (targetPlayerId === playerId) return { ok: false, error: 'Must target opponent card' };
    const card = targetPlayer.hand[targetCardIndex];
    // Reveal to acting player only (stored in peek result, not persisted to all)
    state.pendingPower = {
      ...state.pendingPower,
      peekResult: { playerId: targetPlayerId, cardIndex: targetCardIndex, value: card.value },
    };
    logEvent(state, 'power-look-opponent', playerId, { targetPlayerId, cardIndex: targetCardIndex });
    // No card state change; advance turn
    state.pendingPower = null;
    advanceTurn(state);
    return { ok: true, events: [{ ts: Date.now(), type: 'peek', playerId, payload: { targetPlayerId, cardIndex: targetCardIndex, value: card.value } }] };
  }

  if (power === 'swap-blind') {
    if (targetPlayerId === playerId) return { ok: false, error: 'Must target opponent' };
    const myPlayer = state.players.find((p) => p.id === playerId)!;
    // actionPowerSwap will be called with own card index too — this call picks target
    state.pendingPower = {
      ...state.pendingPower,
      peekResult: { playerId: targetPlayerId, cardIndex: targetCardIndex, value: targetPlayer.hand[targetCardIndex].value },
    };
    logEvent(state, 'power-swap-target', playerId, { targetPlayerId, cardIndex: targetCardIndex });
    // We need own card index next — stay in await-power-target but we need a second step
    // For simplicity: require client to send own card index in same call via a separate action
    state.turnPhase = 'await-power-target'; // still waiting for own card index
    return { ok: true, events: [] };
  }

  if (power === 'look-and-swap') {
    if (targetPlayerId === playerId) return { ok: false, error: 'Must target opponent' };
    const card = targetPlayer.hand[targetCardIndex];
    state.pendingPower = {
      ...state.pendingPower,
      peekResult: { playerId: targetPlayerId, cardIndex: targetCardIndex, value: card.value },
    };
    state.turnPhase = 'await-power-swap';
    logEvent(state, 'power-look-and-swap', playerId, { targetPlayerId, cardIndex: targetCardIndex });
    return { ok: true, events: [{ ts: Date.now(), type: 'peek', playerId, payload: { targetPlayerId, cardIndex: targetCardIndex, value: card.value } }] };
  }

  return { ok: false, error: 'Unknown power' };
}

export function actionPowerSwapConfirm(
  state: GameState,
  playerId: string,
  ownCardIndex: number,
  doSwap: boolean,
): ActionResult {
  const player = state.players.find((p) => p.id === playerId)!;
  if (!state.pendingPower?.peekResult) return { ok: false, error: 'No pending power swap' };

  const { peekResult } = state.pendingPower;
  const targetPlayer = state.players.find((p) => p.id === peekResult.playerId)!;

  if (doSwap) {
    if (ownCardIndex < 0 || ownCardIndex >= player.hand.length) return { ok: false, error: 'Invalid own card index' };
    const myCard = { ...player.hand[ownCardIndex] };
    const theirCard = { ...targetPlayer.hand[peekResult.cardIndex] };
    player.hand[ownCardIndex] = { ...theirCard, revealed: false };
    targetPlayer.hand[peekResult.cardIndex] = { ...myCard, revealed: false };
    logEvent(state, 'power-swap-done', playerId, { ownCardIndex, targetPlayerId: peekResult.playerId, targetCardIndex: peekResult.cardIndex });
  } else {
    logEvent(state, 'power-swap-declined', playerId);
  }

  state.pendingPower = null;
  advanceTurn(state);
  return { ok: true, events: [] };
}

export function actionPowerSwapBlind(
  state: GameState,
  playerId: string,
  ownCardIndex: number,
): ActionResult {
  if (!state.pendingPower?.peekResult) return { ok: false, error: 'No pending swap target' };
  const player = state.players.find((p) => p.id === playerId)!;
  if (ownCardIndex < 0 || ownCardIndex >= player.hand.length) return { ok: false, error: 'Invalid own card index' };

  const { peekResult } = state.pendingPower;
  const targetPlayer = state.players.find((p) => p.id === peekResult.playerId)!;

  const myCard = { ...player.hand[ownCardIndex] };
  const theirCard = { ...targetPlayer.hand[peekResult.cardIndex] };
  player.hand[ownCardIndex] = { ...theirCard, revealed: false };
  targetPlayer.hand[peekResult.cardIndex] = { ...myCard, revealed: false };

  logEvent(state, 'power-swap-blind-done', playerId, { ownCardIndex, targetPlayerId: peekResult.playerId, targetCardIndex: peekResult.cardIndex });

  state.pendingPower = null;
  advanceTurn(state);
  return { ok: true, events: [] };
}

export function actionSpecialDiscard(state: GameState, playerId: string, cardIndex: number): ActionResult {
  if (state.turnPhase !== 'await-special-discard') return { ok: false, error: 'Wrong phase' };
  if (currentPlayer(state).id !== playerId) return { ok: false, error: 'Not your turn' };

  const player = state.players.find((p) => p.id === playerId)!;
  if (cardIndex < 0 || cardIndex >= player.hand.length) return { ok: false, error: 'Invalid card index' };

  const removed = player.hand.splice(cardIndex, 1)[0];
  state.discardPile.push({ id: removed.cardId, value: removed.value });

  logEvent(state, 'power-discard-own', playerId, { cardIndex, value: removed.value });

  state.pendingPower = null;
  advanceTurn(state);
  return { ok: true, events: [] };
}

// ─── Quick discard (Vol en rase-mottes / piqué) ───────────────────────────────

function openQuickDiscardWindow(state: GameState, triggeredBy: string, value: number): void {
  state.quickDiscardWindow = {
    triggeredBy,
    discardedValue: value,
    deadline: Date.now() + 10_000, // 10 second window
    attempts: [triggeredBy], // triggerer can't participate
  };
}

export function actionQuickDiscard(
  state: GameState,
  playerId: string,
  cardIndex: number,
): ActionResult {
  if (!state.quickDiscardWindow) return { ok: false, error: 'No quick discard window open' };
  if (Date.now() > state.quickDiscardWindow.deadline) return { ok: false, error: 'Window expired' };
  if (state.quickDiscardWindow.attempts.includes(playerId)) return { ok: false, error: 'Already attempted' };

  const player = state.players.find((p) => p.id === playerId)!;
  if (!player) return { ok: false, error: 'Player not found' };
  if (cardIndex < 0 || cardIndex >= player.hand.length) return { ok: false, error: 'Invalid card index' };

  const card = player.hand[cardIndex];
  if (card.value !== state.quickDiscardWindow.discardedValue) {
    // Wrong card — penalty: draw an extra card
    state.quickDiscardWindow.attempts.push(playerId);
    if (state.drawPile.length === 0) reshuffleDiscardIntoDraw(state);
    if (state.drawPile.length > 0) {
      const penalty = state.drawPile.pop()!;
      player.hand.push({ cardId: penalty.id, value: penalty.value, revealed: false });
    }
    logEvent(state, 'quick-discard-fail', playerId, { cardIndex, penaltyAdded: true });
    return { ok: false, error: 'Wrong card value — penalty card added' };
  }

  // ─ Vol en piqué: if card belongs to another player and quick-discarding their card ─
  // In this digital implementation: player selects from their own hand only.
  // Piqué (stealing from opponent) is handled by selecting opponent's card index via a special variant.

  state.quickDiscardWindow.attempts.push(playerId);
  const removed = player.hand.splice(cardIndex, 1)[0];
  state.discardPile.push({ id: removed.cardId, value: removed.value });

  logEvent(state, 'quick-discard-success', playerId, { cardIndex, value: removed.value });
  return { ok: true, events: [] };
}

export function actionQuickDiscardOpponent(
  state: GameState,
  playerId: string,         // the player performing the quick discard
  targetPlayerId: string,   // the opponent whose card is targeted
  targetCardIndex: number,
): ActionResult {
  if (state.players.length < 3) return { ok: false, error: 'Vol en piqué requires 3+ players' };
  if (!state.quickDiscardWindow) return { ok: false, error: 'No quick discard window open' };
  if (Date.now() > state.quickDiscardWindow.deadline) return { ok: false, error: 'Window expired' };
  if (state.quickDiscardWindow.attempts.includes(playerId)) return { ok: false, error: 'Already attempted' };
  if (targetPlayerId === playerId) return { ok: false, error: 'Use regular quick discard for own cards' };

  const targetPlayer = state.players.find((p) => p.id === targetPlayerId);
  if (!targetPlayer) return { ok: false, error: 'Target player not found' };
  if (targetCardIndex < 0 || targetCardIndex >= targetPlayer.hand.length)
    return { ok: false, error: 'Invalid target card index' };

  const card = targetPlayer.hand[targetCardIndex];
  if (card.value !== state.quickDiscardWindow.discardedValue) {
    state.quickDiscardWindow.attempts.push(playerId);
    // Penalty for the attempting player
    const player = state.players.find((p) => p.id === playerId)!;
    if (state.drawPile.length === 0) reshuffleDiscardIntoDraw(state);
    if (state.drawPile.length > 0) {
      const penalty = state.drawPile.pop()!;
      player.hand.push({ cardId: penalty.id, value: penalty.value, revealed: false });
    }
    logEvent(state, 'quick-discard-pique-fail', playerId, { targetPlayerId, targetCardIndex, penaltyAdded: true });
    return { ok: false, error: 'Wrong card value — penalty card added' };
  }

  // Success: discard their card; they receive one of ours
  const player = state.players.find((p) => p.id === playerId)!;
  const removedFromTarget = targetPlayer.hand.splice(targetCardIndex, 1)[0];
  state.discardPile.push({ id: removedFromTarget.cardId, value: removedFromTarget.value });

  // Give one of player's cards to target (last card in hand)
  if (player.hand.length > 0) {
    const given = player.hand.pop()!;
    targetPlayer.hand.push({ ...given, revealed: false });
  }

  state.quickDiscardWindow.attempts.push(playerId);
  logEvent(state, 'quick-discard-pique-success', playerId, { targetPlayerId, targetCardIndex, value: removedFromTarget.value });
  return { ok: true, events: [] };
}

export function closeQuickDiscardWindow(state: GameState): void {
  if (!state.quickDiscardWindow) return;
  state.quickDiscardWindow = null;
  if (state.turnPhase === 'await-quick-discard') {
    advanceTurn(state);
  }
}

// ─── Gang de mouettes announcement ───────────────────────────────────────────

export function actionAnnounce(state: GameState, playerId: string): ActionResult {
  if (state.phase !== 'playing') return { ok: false, error: 'Can only announce during playing phase' };
  if (currentPlayer(state).id !== playerId) return { ok: false, error: 'Can only announce after finishing your turn' };
  if (state.turnPhase !== 'await-draw') return { ok: false, error: 'Must announce at start of your turn (before drawing)' };

  state.phase = 'last-round';
  state.lastRoundAnnouncerId = playerId;
  state.lastRoundTurnsLeft = state.players.length;
  // Advance past announcer so they play last
  const n = state.players.length;
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % n;
  state.turnPhase = 'await-draw';
  state.drawnCard = null;
  state.drawnFromDiscard = false;
  state.pendingPower = null;
  state.quickDiscardWindow = null;

  logEvent(state, 'announce', playerId);
  return { ok: true, events: [] };
}

// ─── Round end & scoring ──────────────────────────────────────────────────────

function endRound(state: GameState): void {
  state.phase = 'round-end';
  state.turnPhase = 'done';

  let minScore = Infinity;
  for (const player of state.players) {
    const score = player.hand.reduce((sum, c) => sum + c.value, 0);
    player.roundScore = score;
    if (score < minScore) minScore = score;
    // Reveal all cards
    player.hand.forEach((c) => (c.revealed = true));
  }

  // Announcer penalty
  if (state.lastRoundAnnouncerId) {
    const announcer = state.players.find((p) => p.id === state.lastRoundAnnouncerId)!;
    if (announcer.roundScore! > minScore) {
      announcer.roundScore! ; // will add below
      announcer.roundScore = announcer.roundScore! + 10;
    } else if (announcer.roundScore === minScore) {
      // They tied for lowest — they still win (0 penalty), score stays as is
    }
  }

  // Add round scores to total
  for (const player of state.players) {
    player.totalScore += player.roundScore ?? 0;
  }

  // Check game over (any player >= 100)
  const eliminated = state.players.filter((p) => p.totalScore >= 100);
  if (eliminated.length > 0) {
    state.phase = 'game-over';
  }

  // Advance dealer for next round
  state.dealerIndex = (state.dealerIndex + 1) % state.players.length;

  logEvent(state, 'round-end');
}

// ─── View filtering (what a given player is allowed to see) ───────────────────

export interface PlayerView {
  gameId: string;
  code: string;
  phase: GamePhase;
  turnPhase: TurnPhase;
  myId: string;
  players: PlayerViewEntry[];
  drawPileSize: number;
  topDiscard: { value: number; id: string } | null;
  currentPlayerIndex: number;
  dealerIndex: number;
  myDrawnCard: { id: string; value: number } | null;
  drawnFromDiscard: boolean;
  pendingPower: { power: string } | null;
  quickDiscardWindow: { discardedValue: number; deadline: number } | null;
  lastRoundAnnouncerId: string | null;
  log: GameEvent[];
  winner: string | null;
}

export interface PlayerViewEntry {
  id: string;
  name: string;
  isMe: boolean;
  hand: CardViewEntry[];
  totalScore: number;
  roundScore: number | null;
  connected: boolean;
  isCurrentPlayer: boolean;
}

export interface CardViewEntry {
  cardId: string;
  value: number | null; // null = hidden
  revealed: boolean;
  index: number;
}

export function buildPlayerView(state: GameState, myId: string): PlayerView {
  const myPlayer = state.players.find((p) => p.id === myId);

  const players: PlayerViewEntry[] = state.players.map((p, pi) => {
    const isMe = p.id === myId;
    const hand: CardViewEntry[] = p.hand.map((c, ci) => {
      // Show value if: it's my card and I've revealed it, OR game is over/round-end
      const canSee =
        isMe
          ? c.revealed || state.phase === 'round-end' || state.phase === 'game-over'
          : state.phase === 'round-end' || state.phase === 'game-over';
      return {
        cardId: c.cardId,
        value: canSee ? c.value : null,
        revealed: c.revealed,
        index: ci,
      };
    });
    return {
      id: p.id,
      name: p.name,
      isMe,
      hand,
      totalScore: p.totalScore,
      roundScore: p.roundScore,
      connected: p.connected,
      isCurrentPlayer: pi === state.currentPlayerIndex,
    };
  });

  const top = topDiscard(state);
  const winner =
    state.phase === 'game-over'
      ? state.players.reduce((a, b) => (a.totalScore <= b.totalScore ? a : b)).id
      : null;

  return {
    gameId: state.id,
    code: state.code,
    phase: state.phase,
    turnPhase: state.turnPhase,
    myId,
    players,
    drawPileSize: state.drawPile.length,
    topDiscard: top ? { value: top.value, id: top.id } : null,
    currentPlayerIndex: state.currentPlayerIndex,
    dealerIndex: state.dealerIndex,
    myDrawnCard: myPlayer && state.drawnCard && currentPlayer(state).id === myId
      ? { id: state.drawnCard.id, value: state.drawnCard.value }
      : null,
    drawnFromDiscard: state.drawnFromDiscard,
    pendingPower: state.pendingPower ? { power: state.pendingPower.power } : null,
    quickDiscardWindow: state.quickDiscardWindow
      ? { discardedValue: state.quickDiscardWindow.discardedValue, deadline: state.quickDiscardWindow.deadline }
      : null,
    lastRoundAnnouncerId: state.lastRoundAnnouncerId,
    log: state.log.slice(-20),
    winner,
  };
}
