import {describe, expect, it} from 'vitest';

import {GRID_HEIGHT, GRID_WIDTH} from './engine';
import {frontLogoBait, frontLogoCells} from './logo';

describe('FRONT logo', () => {
  it('paints FRONT inside the playfield', () => {
    const cells = frontLogoCells(GRID_WIDTH, GRID_HEIGHT);
    expect(cells.length).toBeGreaterThan(20);
    const keys = new Set(cells.map((cell) => `${cell.x},${cell.y}`));
    expect(keys.size).toBe(cells.length);
    for (const cell of cells) {
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.x).toBeLessThan(GRID_WIDTH);
      expect(cell.y).toBeGreaterThanOrEqual(0);
      expect(cell.y).toBeLessThan(GRID_HEIGHT);
    }
  });

  it('places bait under the word', () => {
    const cells = frontLogoCells(GRID_WIDTH, GRID_HEIGHT);
    const bait = frontLogoBait(GRID_WIDTH, GRID_HEIGHT);
    const maxY = Math.max(...cells.map((cell) => cell.y));
    expect(bait.y).toBeGreaterThan(maxY);
    expect(bait.x).toBe(Math.floor(GRID_WIDTH / 2));
  });
});
