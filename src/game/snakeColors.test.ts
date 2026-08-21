import {describe, expect, it} from 'vitest';

import {
  assignUniqueColors,
  DEFAULT_SNAKE_COLOR,
  isSnakeColor,
  nextFreeColor,
  SNAKE_COLORS,
} from './snakeColors';

describe('snakeColors', () => {
  it('accepts palette values only', () => {
    expect(isSnakeColor(SNAKE_COLORS[2])).toBe(true);
    expect(isSnakeColor('#ffffff')).toBe(false);
    expect(isSnakeColor(null)).toBe(false);
  });

  it('keeps a free preferred color and fills the next slot otherwise', () => {
    const taken = new Set([SNAKE_COLORS[0]]);
    expect(nextFreeColor(taken, SNAKE_COLORS[2])).toBe(SNAKE_COLORS[2]);
    expect(nextFreeColor(taken, SNAKE_COLORS[0])).toBe(SNAKE_COLORS[1]);
    expect(nextFreeColor(taken)).toBe(SNAKE_COLORS[1]);
  });

  it('resolves duplicates by seating order', () => {
    const resolved = assignUniqueColors([
      {id: 'a', color: SNAKE_COLORS[2]},
      {id: 'b', color: SNAKE_COLORS[2]},
      {id: 'c', color: SNAKE_COLORS[4]},
    ]);
    expect(resolved.map((player) => player.color)).toEqual([
      SNAKE_COLORS[2],
      SNAKE_COLORS[0],
      SNAKE_COLORS[4],
    ]);
  });

  it('lets a later player keep a unique claim', () => {
    const resolved = assignUniqueColors([
      {id: 'a', color: SNAKE_COLORS[3]},
      {id: 'b', color: DEFAULT_SNAKE_COLOR},
    ]);
    expect(resolved[0].color).toBe(SNAKE_COLORS[3]);
    expect(resolved[1].color).toBe(DEFAULT_SNAKE_COLOR);
  });
});
