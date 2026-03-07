import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import type { GameState } from './game-engine.js';
import type Database from 'better-sqlite3';

const require = createRequire(import.meta.url);
const BetterSqlite3 = require('better-sqlite3');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'games.db');

let _db: Database.Database | null = null;

function openDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new BetterSqlite3(DB_PATH) as Database.Database;
  _db.pragma('journal_mode = WAL');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      state TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_games_code ON games(code);
  `);
  return _db;
}

export function saveGame(state: GameState): void {
  const db = openDb();
  db.prepare(`
    INSERT INTO games (id, code, state, updated_at)
    VALUES (@id, @code, @state, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET state = @state, updated_at = @updatedAt
  `).run({ id: state.id, code: state.code, state: JSON.stringify(state), updatedAt: Date.now() });
}

export function loadGame(code: string): GameState | null {
  const db = openDb();
  const row = db.prepare('SELECT state FROM games WHERE code = ?').get(code) as { state: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.state) as GameState;
}

export function loadGameById(id: string): GameState | null {
  const db = openDb();
  const row = db.prepare('SELECT state FROM games WHERE id = ?').get(id) as { state: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.state) as GameState;
}

export function deleteOldGames(): void {
  const db = openDb();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  db.prepare('DELETE FROM games WHERE updated_at < ?').run(cutoff);
}
