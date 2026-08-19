import {afterEach, describe, expect, it, vi} from 'vitest';

import {isLeaderboardConfigured, LeaderboardClient} from './leaderboard';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

function readBody(init?: RequestInit): unknown {
  if (typeof init?.body !== 'string') {
    return null;
  }
  return JSON.parse(init.body);
}

describe('LeaderboardClient', () => {
  it('is configured against the default API', () => {
    expect(isLeaderboardConfigured()).toBe(true);
  });

  it('loads a board with the player email', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      expect(url).toContain('/board?email=ada%40front.com');
      return Promise.resolve(
        jsonResponse({
          domain: 'front.com',
          entries: [],
          you: {rank: 1, bestScore: 0, displayName: 'Ada'},
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const board = await new LeaderboardClient().board('ada@front.com');
    expect(board.domain).toBe('front.com');
    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0][1];
    const headers = init?.headers as Record<string, string>;
    expect(headers.apikey).toBeTruthy();
    expect(headers.Authorization).toMatch(/^Bearer /);
  });

  it('starts a ranked session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        expect(init?.method).toBe('POST');
        expect(readBody(init)).toEqual({
          email: 'ada@front.com',
          displayName: 'Ada',
        });
        return Promise.resolve(jsonResponse({sessionId: 's1', seed: 9}));
      }),
    );
    await expect(
      new LeaderboardClient().start({
        email: 'ada@front.com',
        displayName: 'Ada',
      }),
    ).resolves.toEqual({sessionId: 's1', seed: 9});
  });

  it('submits a finished run', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        expect(readBody(init)).toEqual({
          sessionId: 's1',
          directions: ['right', 'up'],
          displayName: 'Ada',
        });
        return Promise.resolve(
          jsonResponse({
            score: 10,
            bestScore: 10,
            rank: 2,
            board: {domain: 'front.com', entries: [], you: null},
          }),
        );
      }),
    );
    const result = await new LeaderboardClient().submit('s1', ['right', 'up'], 'Ada');
    expect(result.score).toBe(10);
    expect(result.rank).toBe(2);
  });

  it('throws when the API rejects the run', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('nope', {status: 400}))),
    );
    await expect(
      new LeaderboardClient().submit('s1', ['right'], 'Ada'),
    ).rejects.toThrow('Leaderboard 400');
  });
});
