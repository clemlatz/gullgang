import type { APIRoute } from 'astro';
import { loadGame } from '../../../../lib/db.js';
import { buildPlayerView } from '../../../../lib/game-engine.js';

export const GET: APIRoute = async ({ params, request }) => {
  const code = (params.code ?? '').toUpperCase();
  const url = new URL(request.url);
  const playerId = url.searchParams.get('playerId') ?? '';

  const state = loadGame(code);
  if (!state) {
    return new Response(JSON.stringify({ error: 'Game not found' }), { status: 404 });
  }

  const view = playerId ? buildPlayerView(state, playerId) : null;
  return new Response(
    JSON.stringify(view ?? { error: 'playerId required' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
