import {createClient} from 'npm:@supabase/supabase-js@2';

import {
  DURATION_SLACK,
  type Direction,
  isDirection,
  MAX_REPLAY_TICKS,
  replayGame,
} from '../_shared/engine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type SessionRow = {
  id: string;
  teammate_email: string;
  seed: number | string;
  started_at: string;
  consumed_at: string | null;
};

type ScoreRow = {
  teammate_email: string;
  display_name: string;
  best_score: number;
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...corsHeaders, 'Content-Type': 'application/json'},
  });
}

function routeAction(url: URL): string {
  const parts = url.pathname.split('/').filter(Boolean);
  const index = parts.lastIndexOf('snake-leaderboard');
  return index >= 0 ? (parts[index + 1] ?? '') : (parts.at(-1) ?? '');
}

function parseEmail(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return email;
}

function displayName(raw: unknown, email: string): string {
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.trim().slice(0, 80);
  }
  return email.split('@')[0] ?? email;
}

function allowedDomains(): string[] {
  const raw = Deno.env.get('FRONT_EMAIL_DOMAINS') ?? '';
  return raw
    .split(',')
    .map((part) => part.trim().toLowerCase().replace(/^@/, ''))
    .filter((part) => part.length > 0);
}

function emailAllowed(email: string): boolean {
  const domains = allowedDomains();
  if (domains.length === 0) {
    return true;
  }
  const domain = email.split('@')[1]?.toLowerCase();
  return domain !== undefined && domains.includes(domain);
}

function parseDirections(value: unknown): Direction[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_REPLAY_TICKS) {
    return null;
  }
  if (!value.every(isDirection)) {
    return null;
  }
  return value;
}

async function board(supabase: ReturnType<typeof createClient>, email?: string) {
  const {data, error} = await supabase
    .from('snake_scores')
    .select('teammate_email, display_name, best_score')
    .order('best_score', {ascending: false})
    .order('updated_at', {ascending: true})
    .limit(10);

  if (error) {
    throw error;
  }

  const entries = (data ?? []) as ScoreRow[];
  let you: {rank: number; bestScore: number; displayName: string} | null = null;

  if (email) {
    const {data: mine} = await supabase
      .from('snake_scores')
      .select('teammate_email, display_name, best_score')
      .eq('teammate_email', email)
      .maybeSingle();

    if (mine) {
      const row = mine as ScoreRow;
      const {count} = await supabase
        .from('snake_scores')
        .select('*', {count: 'exact', head: true})
        .gt('best_score', row.best_score);
      you = {
        rank: (count ?? 0) + 1,
        bestScore: row.best_score,
        displayName: row.display_name,
      };
    }
  }

  return {entries, you};
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {headers: corsHeaders});
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    const url = new URL(req.url);
    const action = routeAction(url);

    if (req.method === 'GET' && (action === 'board' || action === '')) {
      return json(200, await board(supabase));
    }

    if (req.method !== 'POST') {
      return json(405, {error: 'method_not_allowed'});
    }

    if (action === 'start') {
      const payload = (await req.json()) as {email?: unknown; displayName?: unknown};
      const email = parseEmail(payload.email);
      if (!email) {
        return json(400, {error: 'invalid_player'});
      }
      if (!emailAllowed(email)) {
        return json(403, {error: 'forbidden'});
      }
      const seedBytes = new Uint32Array(1);
      crypto.getRandomValues(seedBytes);
      const seed = seedBytes[0] === 0 ? 1 : seedBytes[0];
      const {data, error} = await supabase
        .from('snake_sessions')
        .insert({teammate_email: email, seed})
        .select('id, seed')
        .single();
      if (error || !data) {
        throw error ?? new Error('session_insert_failed');
      }
      return json(200, {sessionId: data.id as string, seed: Number(data.seed)});
    }

    if (action === 'submit') {
      const payload = (await req.json()) as {
        sessionId?: unknown;
        directions?: unknown;
        displayName?: unknown;
      };
      if (typeof payload.sessionId !== 'string') {
        return json(400, {error: 'invalid_session'});
      }
      const directions = parseDirections(payload.directions);
      if (!directions) {
        return json(400, {error: 'invalid_replay'});
      }

      const {data: session, error: sessionError} = await supabase
        .from('snake_sessions')
        .select('id, teammate_email, seed, started_at, consumed_at')
        .eq('id', payload.sessionId)
        .maybeSingle();

      if (sessionError) {
        throw sessionError;
      }
      const row = session as SessionRow | null;
      if (!row) {
        return json(404, {error: 'session_not_found'});
      }
      if (row.consumed_at) {
        return json(409, {error: 'session_consumed'});
      }

      const email = row.teammate_email;
      const seed = Number(row.seed);
      const replay = replayGame(seed, directions);
      if (replay.ended !== 'gameover' || replay.ticks !== directions.length) {
        return json(400, {error: 'invalid_replay'});
      }

      const elapsedMs = Date.now() - new Date(row.started_at).getTime();
      if (elapsedMs < replay.minDurationMs * DURATION_SLACK) {
        return json(400, {error: 'too_fast'});
      }

      const {error: consumeError} = await supabase
        .from('snake_sessions')
        .update({consumed_at: new Date().toISOString()})
        .eq('id', row.id)
        .is('consumed_at', null);
      if (consumeError) {
        throw consumeError;
      }

      const {data: existing} = await supabase
        .from('snake_scores')
        .select('best_score, display_name')
        .eq('teammate_email', email)
        .maybeSingle();

      const previous = existing as {best_score?: number; display_name?: string} | null;
      const previousBest = previous?.best_score ?? 0;
      const bestScore = Math.max(previousBest, replay.score);
      const name = displayName(payload.displayName ?? previous?.display_name, email);

      if (replay.score >= previousBest) {
        const {error: upsertError} = await supabase.from('snake_scores').upsert({
          teammate_email: email,
          display_name: name,
          best_score: bestScore,
          updated_at: new Date().toISOString(),
        });
        if (upsertError) {
          throw upsertError;
        }
      }

      const boardResult = await board(supabase, email);
      return json(200, {
        score: replay.score,
        bestScore,
        rank: boardResult.you?.rank ?? 1,
        board: boardResult,
      });
    }

    return json(404, {error: 'not_found'});
  } catch (error) {
    console.error(error);
    return json(500, {error: 'server_error'});
  }
});
