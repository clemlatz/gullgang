# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # install dependencies
npm run dev       # dev server at http://localhost:4321
npm run build     # production build
node server.mjs   # run production server (NOT npm start)
```

There is no test suite configured.

## Architecture

Online multiplayer implementation of the card game "Gang de Mouettes". Stack: Astro (SSR) + React islands + WebSocket server + SQLite.

### Request flow

1. REST API (`src/pages/api/games/`) handles game creation and join — returns a `code` + `playerId`.
2. The React client (`src/components/App.tsx`) stores `{ code, playerId }` in `sessionStorage` and opens a WebSocket to `/ws?code=<code>&playerId=<id>`.
3. `ws-server.ts` receives JSON messages with an `action` field, calls the corresponding function from `game-engine.ts`, persists via `db.ts`, then broadcasts updated state to all clients in the room.
4. Each client receives a `PlayerView` built by `buildPlayerView()` — opponent card values are hidden (null) unless the game is in `round-end` or `game-over` phase.

### Game engine (`src/lib/game-engine.ts`)

Pure, synchronous state machine with no I/O. All exported `action*` functions take a `GameState` and mutate it in place, returning `{ ok: true } | { ok: false; error: string }`. The two key state enums are:

- `GamePhase`: `lobby → initial-peek → playing → last-round → round-end → game-over`
- `TurnPhase`: `await-draw → await-action → await-power-target / await-power-swap / await-special-discard → await-quick-discard → done`

Special mechanics to be aware of:
- **Quick discard window**: opens for 10 seconds after any card is discarded. Other players can quick-discard a matching card from their own hand (or "vol en piqué" from an opponent's hand with `quick-discard-opponent`). Wrong guess = penalty card added to guesser's hand.
- **Last round**: triggered by `actionAnnounce`. All other players get one more turn, then `endRound` is called. If the announcer doesn't have the lowest score, they receive a +10 penalty.
- **Powers** (cards 8/9/10/15/20): can only be used on cards drawn from the draw pile, never from the discard.

### Persistence (`src/lib/db.ts`)

SQLite via `better-sqlite3`. The entire `GameState` is serialized as JSON in a single `state` column. The DB file lives at `data/games.db`. Games older than 24 hours are pruned by `deleteOldGames()`.

### WebSocket server (`src/lib/ws-server.ts`)

- Dev: registered as an Astro Vite plugin hook in `astro.config.mjs` — attaches to Vite's `httpServer`.
- Production: `server.mjs` creates a plain Node `http.Server`, wraps Astro's SSR handler, and calls `initWebSocketServer` on it.
- In-memory maps: `clients: Map<WebSocket, Client>` and `gameRooms: Map<string, Set<string>>`.
- `peek` events (look-opponent, look-and-swap) are sent **only** to the acting player; all other state updates are broadcast to the full room via `broadcastState`.

### Frontend (`src/components/`)

- `App.tsx` — root component; manages session and routes between `Lobby`, `WaitingRoom`, and `Board`.
- `useWebSocket.ts` — hook that manages WS lifecycle with auto-reconnect (3 s). Exposes `send(action, payload)` and a separate `peekData` state for private peek reveals.
- `Board.tsx` / `CardComponent.tsx` — game UI; cards with `value: null` are rendered face-down.

### i18n (`src/i18n/`)

`useTranslation.ts` detects locale from `navigator.language`. To add a language: create `src/i18n/xx.json`, add `xx` to the `Locale` type, and register it in the `translations` map.
