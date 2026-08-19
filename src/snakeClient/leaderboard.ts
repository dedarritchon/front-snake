export interface LeaderboardEntry {
  teammate_email: string;
  display_name: string;
  best_score: number;
}

export interface LeaderboardBoard {
  domain: string | null;
  entries: LeaderboardEntry[];
  you: {rank: number; bestScore: number; displayName: string} | null;
}

export interface StartSessionResponse {
  sessionId: string;
  seed: number;
}

export type RankedSession = StartSessionResponse;

export interface SubmitRunResponse {
  score: number;
  bestScore: number;
  rank: number;
  board: LeaderboardBoard;
}

export interface PlayerIdentity {
  email: string;
  displayName: string;
}

const DEFAULT_API_URL =
  'https://rdiqgzimnkxqimhvhmwz.supabase.co/functions/v1/snake-leaderboard';
const DEFAULT_ANON_KEY = 'sb_publishable_jmVRwMMu1makeVVLm908ng_lYVZ51J5';

function apiUrl(): string {
  const base = import.meta.env.VITE_SNAKE_API_URL;
  const value = typeof base === 'string' && base !== '' ? base : DEFAULT_API_URL;
  return value.replace(/\/$/, '');
}

function anonKey(): string {
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return typeof key === 'string' && key !== '' ? key : DEFAULT_ANON_KEY;
}

export function isLeaderboardConfigured(): boolean {
  return apiUrl() !== '';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const key = anonKey();
  const response = await fetch(`${apiUrl()}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Leaderboard ${response.status}`);
  }
  return (await response.json()) as T;
}

export class LeaderboardClient {
  board(email: string): Promise<LeaderboardBoard> {
    const query = new URLSearchParams({email});
    return request<LeaderboardBoard>(`/board?${query.toString()}`);
  }

  start(player: PlayerIdentity): Promise<StartSessionResponse> {
    return request<StartSessionResponse>('/start', {
      method: 'POST',
      body: JSON.stringify(player),
    });
  }

  submit(
    sessionId: string,
    directions: string[],
    displayName: string,
  ): Promise<SubmitRunResponse> {
    return request<SubmitRunResponse>('/submit', {
      method: 'POST',
      body: JSON.stringify({sessionId, directions, displayName}),
    });
  }
}
