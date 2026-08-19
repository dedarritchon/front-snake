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
    {x: 3, y: 0},
    {x: 0, y: 1},
    {x: 1, y: 1},
    {x: 3, y: 1},
    {x: 0, y: 2},
    {x: 2, y: 2},
    {x: 3, y: 2},
    {x: 0, y: 3},
    {x: 3, y: 3},
    {x: 0, y: 4},
    {x: 3, y: 4},
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

const GAP = 1;
const WORD = ['F', 'R', 'O', 'N', 'T'] as const;
const GLYPH_WIDTH: Record<(typeof WORD)[number], number> = {
  F: 3,
  R: 3,
  O: 3,
  N: 4,
  T: 3,
};
const GLYPH_HEIGHT = 5;

function wordWidth(): number {
  return WORD.reduce(
    (width, letter, index) =>
      width + GLYPH_WIDTH[letter] + (index > 0 ? GAP : 0),
    0,
  );
}

export function frontLogoCells(cols: number, rows: number): Point[] {
  const originX = Math.max(0, Math.floor((cols - wordWidth()) / 2));
  const originY = Math.max(
    0,
    Math.floor(rows * 0.38) - Math.floor(GLYPH_HEIGHT / 2),
  );

  const cells: Point[] = [];
  let ox = originX;
  for (const letter of WORD) {
    for (const point of LETTERS[letter]) {
      const x = ox + point.x;
      const y = originY + point.y;
      if (x >= 0 && x < cols && y >= 0 && y < rows) {
        cells.push({x, y});
      }
    }
    ox += GLYPH_WIDTH[letter] + GAP;
  }
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
