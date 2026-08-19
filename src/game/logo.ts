import type {Point} from './types';

const LETTERS: Record<string, Point[]> = {
  F: [
    {x: 0, y: 0},
    {x: 1, y: 0},
    {x: 2, y: 0},
    {x: 0, y: 1},
    {x: 0, y: 2},
    {x: 1, y: 2},
    {x: 0, y: 3},
    {x: 0, y: 4},
  ],
  R: [
    {x: 0, y: 0},
    {x: 1, y: 0},
    {x: 0, y: 1},
    {x: 2, y: 1},
    {x: 0, y: 2},
    {x: 1, y: 2},
    {x: 0, y: 3},
    {x: 2, y: 3},
    {x: 0, y: 4},
    {x: 2, y: 4},
  ],
  O: [
    {x: 1, y: 0},
    {x: 0, y: 1},
    {x: 2, y: 1},
    {x: 0, y: 2},
    {x: 2, y: 2},
    {x: 0, y: 3},
    {x: 2, y: 3},
    {x: 1, y: 4},
  ],
  N: [
    {x: 0, y: 0},
    {x: 2, y: 0},
    {x: 0, y: 1},
    {x: 1, y: 1},
    {x: 0, y: 2},
    {x: 2, y: 2},
    {x: 0, y: 3},
    {x: 2, y: 3},
    {x: 0, y: 4},
    {x: 2, y: 4},
  ],
  T: [
    {x: 0, y: 0},
    {x: 1, y: 0},
    {x: 2, y: 0},
    {x: 1, y: 1},
    {x: 1, y: 2},
    {x: 1, y: 3},
    {x: 1, y: 4},
  ],
};

const GLYPH_WIDTH = 3;
const GLYPH_HEIGHT = 5;
const GAP = 1;
const WORD = ['F', 'R', 'O', 'N', 'T'] as const;

export function frontLogoCells(cols: number, rows: number): Point[] {
  const wordWidth = WORD.length * GLYPH_WIDTH + (WORD.length - 1) * GAP;
  const originX = Math.max(0, Math.floor((cols - wordWidth) / 2));
  const originY = Math.max(0, Math.floor(rows * 0.38) - Math.floor(GLYPH_HEIGHT / 2));

  const cells: Point[] = [];
  WORD.forEach((letter, index) => {
    const ox = originX + index * (GLYPH_WIDTH + GAP);
    for (const point of LETTERS[letter]) {
      const x = ox + point.x;
      const y = originY + point.y;
      if (x >= 0 && x < cols && y >= 0 && y < rows) {
        cells.push({x, y});
      }
    }
  });
  return cells;
}

export function frontLogoBait(cols: number, rows: number): Point {
  const cells = frontLogoCells(cols, rows);
  const maxY = cells.reduce((max, cell) => Math.max(max, cell.y), 0);
  return {
    x: Math.floor(cols / 2),
    y: Math.min(rows - 1, maxY + 3),
  };
}
