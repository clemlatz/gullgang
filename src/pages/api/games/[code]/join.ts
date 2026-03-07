import type { APIRoute } from 'astro';
import { nanoid } from 'nanoid';
import { loadGame, saveGame } from '../../../../lib/db.js';

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const code = (params.code ?? '').toUpperCase();
    const body = await request.json();
    const name = (body.name ?? '').trim();

    if (!name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), { status: 400 });
    }

    const state = loadGame(code);
    if (!state) {
      return new Response(JSON.stringify({ error: 'Game not found' }), { status: 404 });
    }

    if (state.phase !== 'lobby') {
      return new Response(JSON.stringify({ error: 'Game already started' }), { status: 409 });
    }

    if (state.players.length >= 8) {
      return new Response(JSON.stringify({ error: 'Game is full' }), { status: 409 });
    }

    const playerId = nanoid();
    state.players.push({
      id: playerId,
      name,
      hand: [],
      totalScore: 0,
      roundScore: null,
      connected: false,
    });

    saveGame(state);

    return new Response(
      JSON.stringify({ code, playerId, gameId: state.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
};
