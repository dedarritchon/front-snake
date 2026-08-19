import {describe, expect, it} from 'vitest';

import {createFreshState, createInitialState, LOBBY_LEVEL_ID} from './snakeEngine';

describe('snakeEngine wrappers', () => {
  it('always starts a fresh ready board', () => {
    const state = createInitialState(LOBBY_LEVEL_ID);
    expect(state.levelId).toBe(LOBBY_LEVEL_ID);
    expect(state.status).toBe('ready');
    expect(state.score).toBe(0);
    expect(state.snake).toHaveLength(3);
  });

  it('honors an explicit seed', () => {
    const a = createFreshState('x', 42);
    const b = createFreshState('y', 42);
    expect(a.foods).toEqual(b.foods);
    expect(a.snake).toEqual(b.snake);
  });
});
