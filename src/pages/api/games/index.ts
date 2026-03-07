import type { APIRoute } from 'astro';
import { nanoid } from 'nanoid';
import { createGame } from '../../../lib/game-engine.js';
import { saveGame } from '../../../lib/db.js';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const hostName = (body.name ?? '').trim();
    if (!hostName) {
      return new Response(JSON.stringify({ error: 'Name is required' }), { status: 400 });
    }

    const gameId = nanoid();
    const code = generateCode();
    const playerId = nanoid();

    const state = createGame(code, gameId);
    state.players.push({
      id: playerId,
      name: hostName,
      hand: [],
      totalScore: 0,
      roundScore: null,
      connected: false,
    });

    saveGame(state);

    return new Response(
      JSON.stringify({ code, playerId, gameId }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
};
