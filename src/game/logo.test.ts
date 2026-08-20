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

  it('does not put bait on a logo cell', () => {
    const cells = frontLogoCells(GRID_WIDTH, GRID_HEIGHT);
    const bait = frontLogoBait(GRID_WIDTH, GRID_HEIGHT);
    expect(
      cells.some((cell) => cell.x === bait.x && cell.y === bait.y),
    ).toBe(false);
  });

  it('uses a 4-wide N so FRONT does not read as FROKT', () => {
    const cells = frontLogoCells(GRID_WIDTH, GRID_HEIGHT);
    const originX = Math.max(0, Math.floor((GRID_WIDTH - 20) / 2));
    const originY = Math.max(0, Math.floor(GRID_HEIGHT * 0.38) - 2);
    const nX = originX + 3 + 1 + 3 + 1 + 3 + 1;
    const left = cells.filter((cell) => cell.x === nX);
    const right = cells.filter((cell) => cell.x === nX + 3);
    expect(left).toHaveLength(5);
    expect(right).toHaveLength(5);
    expect(left.every((cell) => cell.y >= originY && cell.y < originY + 5)).toBe(
      true,
    );
  });

  it('leaves a gutter on both sides of FRONT', () => {
    const cells = frontLogoCells(GRID_WIDTH, GRID_HEIGHT);
    const xs = cells.map((cell) => cell.x);
    expect(Math.min(...xs)).toBe(1);
    expect(Math.max(...xs)).toBe(GRID_WIDTH - 2);
  });

  it('clips to a tiny board without throwing', () => {
    const cells = frontLogoCells(4, 4);
    expect(cells.every((cell) => cell.x < 4 && cell.y < 4)).toBe(true);
    const bait = frontLogoBait(4, 4);
    expect(bait.x).toBeLessThan(4);
    expect(bait.y).toBeLessThan(4);
  });
});
