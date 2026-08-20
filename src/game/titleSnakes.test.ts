import {describe, expect, it} from 'vitest';

import {GRID_HEIGHT, GRID_WIDTH} from './engine';
import {frontLogoBait, frontLogoCells} from './logo';
import {
  blockedCells,
  createTitleSnakes,
  tickTitleSnakes,
  type TitleSnake,
} from './titleSnakes';

describe('titleSnakes', () => {
  it('spawns three snakes on the solo grid', () => {
    const snakes = createTitleSnakes(GRID_WIDTH, GRID_HEIGHT);
    expect(snakes).toHaveLength(3);
    for (const snake of snakes) {
      expect(snake.body.length).toBeGreaterThan(2);
      for (const point of snake.body) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThan(GRID_WIDTH);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThan(GRID_HEIGHT);
      }
    }
  });

  it('steps the head forward when the path is clear', () => {
    const snake: TitleSnake = {
      id: 0,
      direction: 'right',
      bias: 1,
      body: [
        {x: 2, y: 2},
        {x: 1, y: 2},
        {x: 0, y: 2},
      ],
    };
    const next = tickTitleSnakes([snake], 20, 40, new Set());
    expect(next[0].body[0]).toEqual({x: 3, y: 2});
    expect(next[0].body[2]).toEqual({x: 1, y: 2});
  });

  it('turns instead of walking into the logo', () => {
    const snake: TitleSnake = {
      id: 0,
      direction: 'right',
      bias: 1,
      body: [
        {x: 2, y: 2},
        {x: 1, y: 2},
        {x: 0, y: 2},
      ],
    };
    const next = tickTitleSnakes([snake], 20, 40, new Set(['3,2']));
    expect(next[0].body[0]).toEqual({x: 2, y: 3});
    expect(next[0].direction).toBe('down');
  });

  it('turns at a wall', () => {
    const snake: TitleSnake = {
      id: 0,
      direction: 'left',
      bias: 1,
      body: [
        {x: 0, y: 5},
        {x: 1, y: 5},
        {x: 2, y: 5},
      ],
    };
    const next = tickTitleSnakes([snake], 20, 40, new Set());
    expect(next[0].body[0]).toEqual({x: 0, y: 4});
    expect(next[0].direction).toBe('up');
  });

  it('never crawls onto FRONT or the title bait', () => {
    const logo = frontLogoCells(GRID_WIDTH, GRID_HEIGHT);
    const bait = frontLogoBait(GRID_WIDTH, GRID_HEIGHT);
    const blocked = blockedCells([...logo, bait]);
    let snakes = createTitleSnakes(GRID_WIDTH, GRID_HEIGHT);
    for (let i = 0; i < 80; i += 1) {
      snakes = tickTitleSnakes(snakes, GRID_WIDTH, GRID_HEIGHT, blocked);
    }
    for (const snake of snakes) {
      for (const point of snake.body) {
        expect(blocked.has(`${point.x},${point.y}`)).toBe(false);
      }
    }
  });
});
