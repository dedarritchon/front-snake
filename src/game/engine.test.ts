import {describe, expect, it} from 'vitest';

import {
  baitCountForScore,
  createSimState,
  gameLevel,
  queueDirection,
  replayGame,
  tick,
} from './engine';
import type {Direction} from './types';

function play(seed: number, inputs: Direction[]) {
  let state = createSimState('test', seed);
  const recorded: Direction[] = [];
  for (const input of inputs) {
    state = queueDirection(state, input);
    if (state.status !== 'playing' && state.status !== 'gameover') {
      break;
    }
    recorded.push(state.pendingDirection);
    state = tick(state);
    if (state.status === 'gameover') {
      break;
    }
  }
  return {state, recorded};
}

describe('engine replay', () => {
  it('matches live ticks for the same seed', () => {
    const seed = 12345;
    let state = createSimState('test', seed);
    const directions: Direction[] = [];
    const plan: Direction[] = [
      'right',
      'right',
      'up',
      'up',
      'left',
      'left',
      'down',
      'down',
      'right',
    ];

    for (const input of plan) {
      state = queueDirection(state, input);
      directions.push(state.pendingDirection);
      state = tick(state);
      if (state.status === 'gameover') {
        break;
      }
    }

    while (state.status !== 'gameover' && directions.length < 400) {
      directions.push(state.pendingDirection);
      state = tick(state);
    }

    expect(state.status).toBe('gameover');
    const replay = replayGame(seed, directions);
    expect(replay.ended).toBe('gameover');
    expect(replay.score).toBe(state.score);
    expect(replay.ticks).toBe(directions.length);
    expect(replay.minDurationMs).toBeGreaterThan(0);
  });

  it('same seed produces the same first food', () => {
    const a = createSimState('a', 99);
    const b = createSimState('b', 99);
    expect(a.foods).toEqual(b.foods);
  });

  it('rejects an empty replay', () => {
    expect(replayGame(1, []).ended).toBe('ready');
  });

  it('records applied direction, not a reversed input', () => {
    const {state, recorded} = play(7, ['right', 'left', 'right']);
    expect(recorded.every((direction) => direction === 'right')).toBe(true);
    expect(state.direction).toBe('right');
  });

  it('adds a second apple from level 11', () => {
    expect(gameLevel(0)).toBe(1);
    expect(gameLevel(45)).toBe(10);
    expect(gameLevel(50)).toBe(11);
    expect(baitCountForScore(0)).toBe(1);
    expect(baitCountForScore(45)).toBe(1);
    expect(baitCountForScore(50)).toBe(2);
    expect(baitCountForScore(100)).toBe(3);
  });
});
