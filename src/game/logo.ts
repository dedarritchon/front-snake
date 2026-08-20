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
  S: [
    {x: 1, y: 0},
    {x: 2, y: 0},
    {x: 0, y: 1},
    {x: 1, y: 2},
    {x: 2, y: 2},
    {x: 2, y: 3},
    {x: 0, y: 4},
    {x: 1, y: 4},
  ],
  A: [
    {x: 1, y: 0},
    {x: 0, y: 1},
    {x: 2, y: 1},
    {x: 0, y: 2},
    {x: 1, y: 2},
    {x: 2, y: 2},
    {x: 0, y: 3},
    {x: 2, y: 3},
    {x: 0, y: 4},
    {x: 2, y: 4},
  ],
  K: [
    {x: 0, y: 0},
    {x: 2, y: 0},
    {x: 0, y: 1},
    {x: 2, y: 1},
    {x: 0, y: 2},
    {x: 1, y: 2},
    {x: 0, y: 3},
    {x: 2, y: 3},
    {x: 0, y: 4},
    {x: 2, y: 4},
  ],
  E: [
    {x: 0, y: 0},
    {x: 1, y: 0},
    {x: 2, y: 0},
    {x: 0, y: 1},
    {x: 0, y: 2},
    {x: 1, y: 2},
    {x: 2, y: 2},
    {x: 0, y: 3},
    {x: 0, y: 4},
    {x: 1, y: 4},
    {x: 2, y: 4},
  ],
};

const GAP = 1;
const LINE_GAP = 2;
const FRONT = ['F', 'R', 'O', 'N', 'T'] as const;
const SNAKE = ['S', 'N', 'A', 'K', 'E'] as const;
const GLYPH_WIDTH: Record<string, number> = {
  F: 3,
  R: 3,
  O: 3,
  N: 4,
  T: 3,
  S: 3,
  A: 3,
  K: 3,
  E: 3,
};
const GLYPH_HEIGHT = 5;

function wordWidth(word: readonly string[]): number {
  return word.reduce(
    (width, letter, index) =>
      width + (GLYPH_WIDTH[letter] ?? 0) + (index > 0 ? GAP : 0),
    0,
  );
}

function paintWord(
  word: readonly string[],
  originX: number,
  originY: number,
  cols: number,
  rows: number,
): Point[] {
  const cells: Point[] = [];
  let ox = originX;
  for (const letter of word) {
    for (const point of LETTERS[letter] ?? []) {
      const x = ox + point.x;
      const y = originY + point.y;
      if (x >= 0 && x < cols && y >= 0 && y < rows) {
        cells.push({x, y});
      }
    }
    ox += (GLYPH_WIDTH[letter] ?? 0) + GAP;
  }
  return cells;
}

export function frontLogoCells(cols: number, rows: number): Point[] {
  const blockHeight = GLYPH_HEIGHT * 2 + LINE_GAP;
  const originY = Math.max(
    0,
    Math.floor(rows * 0.38) - Math.floor(blockHeight / 2),
  );
  const frontX = Math.max(0, Math.floor((cols - wordWidth(FRONT)) / 2));
  const snakeX = Math.max(0, Math.floor((cols - wordWidth(SNAKE)) / 2));
  return [
    ...paintWord(FRONT, frontX, originY, cols, rows),
    ...paintWord(SNAKE, snakeX, originY + GLYPH_HEIGHT + LINE_GAP, cols, rows),
  ];
}

export function frontLogoBait(cols: number, rows: number): Point {
  const cells = frontLogoCells(cols, rows);
  const maxY = cells.reduce((max, cell) => Math.max(max, cell.y), 0);
  return {
    x: Math.floor(cols / 2),
    y: Math.min(rows - 1, maxY + 3),
  };
}
