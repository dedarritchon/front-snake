import {describe, expect, it} from 'vitest';

import * as server from '../../supabase/functions/_shared/engine';
import * as client from './engine';
import type {Direction} from './types';

function play(
  engine: typeof client,
  seed: number,
  inputs: Direction[],
) {
  let state = engine.createSimState('lockstep', seed);
  const directions: Direction[] = [];
  for (const input of inputs) {
    state = engine.queueDirection(state, input);
    if (state.status !== 'playing' && state.status !== 'gameover') {
      break;
    }
    directions.push(state.pendingDirection);
    state = engine.tick(state);
    if (state.status === 'gameover') {
      break;
    }
  }
  while (state.status === 'playing' && directions.length < 800) {
    directions.push(state.pendingDirection);
    state = engine.tick(state);
  }
  return {state, directions};
}

describe('client and Edge Function engines stay in lockstep', () => {
  it('shares ranked constants', () => {
    expect(server.GRID_WIDTH).toBe(client.GRID_WIDTH);
    expect(server.GRID_HEIGHT).toBe(client.GRID_HEIGHT);
    expect(server.BASE_TICK_MS).toBe(client.BASE_TICK_MS);
    expect(server.MIN_TICK_MS).toBe(client.MIN_TICK_MS);
    expect(server.MAX_BAITS).toBe(client.MAX_BAITS);
    expect(server.SCORE_PER_FOOD).toBe(client.SCORE_PER_FOOD);
    expect(server.LEVELS_PER_EXTRA_BAIT).toBe(client.LEVELS_PER_EXTRA_BAIT);
    expect(server.MAX_REPLAY_TICKS).toBe(client.MAX_REPLAY_TICKS);
    expect(server.DURATION_SLACK).toBe(client.DURATION_SLACK);
  });

  it('shares the mulberry32 stream', () => {
    const a = client.createRng(42);
    const b = server.createRng(42);
    for (let i = 0; i < 40; i += 1) {
      expect(a.next()).toBe(b.next());
      expect(a.nextInt(17)).toBe(b.nextInt(17));
      expect(a.state()).toBe(b.state());
    }
  });

  it('opens the same board for a seed', () => {
    const left = client.createSimState('x', 99_001);
    const right = server.createSimState('x', 99_001);
    expect(right.snake).toEqual(left.snake);
    expect(right.foods).toEqual(left.foods);
    expect(right.rngState).toBe(left.rngState);
    expect(right.gridWidth).toBe(left.gridWidth);
    expect(right.gridHeight).toBe(left.gridHeight);
  });

  it.each([7, 12345, 999_991, 1, 2_147_000_000])(
    'replays seed %s identically',
    (seed) => {
      const plan: Direction[] = [
        'right',
        'up',
        'up',
        'left',
        'left',
        'down',
        'right',
        'right',
        'up',
        'left',
      ];
      const live = play(client, seed, plan);
      const replay = server.replayGame(seed, live.directions);
      expect(replay.ended).toBe(live.state.status);
      expect(replay.score).toBe(live.state.score);
      expect(replay.ticks).toBe(live.directions.length);
      expect(replay.minDurationMs).toBe(
        client.replayGame(seed, live.directions).minDurationMs,
      );
    },
  );

  it('matches bait count and speed tables', () => {
    for (const score of [0, 45, 50, 100, 500, 10_000]) {
      expect(server.gameLevel(score)).toBe(client.gameLevel(score));
      expect(server.baitCountForScore(score)).toBe(
        client.baitCountForScore(score),
      );
      expect(server.tickMsForScore(score, 8)).toBe(
        client.tickMsForScore(score, 8),
      );
    }
  });
});
