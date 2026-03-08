# Gull Gang — Web App

Online multiplayer implementation of **Gull Gang**, built with Astro + React + WebSockets.

## About

Gull Gang is inspired by the French card game [**Gang de Mouettes**](https://gang-de-mouettes.clemlatz.dev/), created by Clément Latzarus.

## Experiment

This project is a personal experiment: every line of code — and this README, including this very paragraph — was written by [Claude Code](https://claude.ai/code), Anthropic's AI coding assistant. I imposed a strict rule on myself: I would not write a single line of code manually. This is not an approach I would take on a production project; the point is to learn how Claude Code works, explore its capabilities, and sharpen my prompting skills.

## Stack

- **Frontend**: Astro (SSR) + React islands
- **Backend**: Astro API routes + WebSocket server (ws)
- **Database**: SQLite via better-sqlite3
- **i18n**: English (default) + French (auto-detected from browser)

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:4321

## Production build

```bash
npm run build
node server.mjs
```

## Project structure

```
src/
├── pages/
│   ├── index.astro              # Main SPA entry
│   └── api/games/               # REST API
│       ├── index.ts             # POST /api/games — create game
│       └── [code]/
│           ├── index.ts         # GET  /api/games/:code — game state
│           └── join.ts          # POST /api/games/:code/join
├── components/
│   ├── App.tsx                  # Root React component
│   ├── useWebSocket.ts          # WS hook
│   ├── useTranslation.ts        # i18n hook
│   ├── lobby/
│   │   ├── Lobby.tsx            # Create/join screen
│   │   └── WaitingRoom.tsx      # Pre-game lobby
│   └── game/
│       ├── Board.tsx            # Main game board
│       └── CardComponent.tsx    # Card visual
├── lib/
│   ├── deck.ts                  # Card definitions & deck builder
│   ├── game-engine.ts           # Pure game logic / state machine
│   ├── db.ts                    # SQLite persistence
│   └── ws-server.ts             # WebSocket server + message routing
└── i18n/
    ├── en.json                  # English strings
    └── fr.json                  # French strings
```

## Adding a language

1. Create `src/i18n/xx.json` copying the structure from `en.json`
2. Add `xx` to the `Locale` type in `src/components/useTranslation.ts`
3. Import and register it in the `translations` map

## Game rules

See [the official rules](https://gang-de-mouettes.fr) or the included Markdown docs.
