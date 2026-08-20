import type {Direction, Point} from './types';
import {DIRECTION_DELTA, OPPOSITE} from './types';

const CYCLE: Direction[] = ['right', 'down', 'left', 'up'];
const MAX_STRAIGHT = 6;

export interface TitleSnake {
  id: number;
  body: Point[];
  direction: Direction;
  bias: 1 | -1;
  straight: number;
}

function cellKey(point: Point): string {
  return `${point.x},${point.y}`;
}

function ahead(head: Point, direction: Direction): Point {
  const delta = DIRECTION_DELTA[direction];
  return {x: head.x + delta.x, y: head.y + delta.y};
}

function inBounds(point: Point, cols: number, rows: number): boolean {
  return point.x >= 0 && point.x < cols && point.y >= 0 && point.y < rows;
}

function rotate(direction: Direction, turn: 1 | -1): Direction {
  const index = CYCLE.indexOf(direction);
  return CYCLE[(index + turn + CYCLE.length) % CYCLE.length];
}

function edgeDist(point: Point, cols: number, rows: number): number {
  return Math.min(
    point.x,
    cols - 1 - point.x,
    point.y,
    rows - 1 - point.y,
  );
}

function trail(head: Point, direction: Direction, length: number): Point[] {
  const back = OPPOSITE[direction];
  const body: Point[] = [];
  let cursor = head;
  for (let i = 0; i < length; i += 1) {
    body.push(cursor);
    cursor = ahead(cursor, back);
  }
  return body;
}

export function blockedCells(points: Point[]): Set<string> {
  return new Set(points.map(cellKey));
}

export function createTitleSnakes(cols: number, rows: number): TitleSnake[] {
  const candidates: TitleSnake[] = [
    {
      id: 0,
      direction: 'right',
      bias: 1,
      straight: 0,
      body: trail({x: Math.min(4, cols - 1), y: 2}, 'right', 5),
    },
    {
      id: 1,
      direction: 'left',
      bias: -1,
      straight: 0,
      body: trail(
        {x: Math.max(0, cols - 8), y: Math.max(0, rows - 3)},
        'left',
        7,
      ),
    },
    {
      id: 2,
      direction: 'up',
      bias: 1,
      straight: 0,
      body: trail(
        {
          x: Math.max(0, cols - 3),
          y: Math.max(0, rows - 12),
        },
        'up',
        6,
      ),
    },
  ];
  return candidates.filter((snake) =>
    snake.body.every((point) => inBounds(point, cols, rows)),
  );
}

export function tickTitleSnakes(
  snakes: TitleSnake[],
  cols: number,
  rows: number,
  blocked: Set<string>,
): TitleSnake[] {
  return snakes.map((snake) => {
    const head = snake.body[0];
    if (!head) {
      return snake;
    }
    const self = new Set(snake.body.slice(0, -1).map(cellKey));
    const order: Direction[] = [
      snake.direction,
      rotate(snake.direction, snake.bias),
      rotate(snake.direction, snake.bias === 1 ? -1 : 1),
      OPPOSITE[snake.direction],
    ];
    const valid: {direction: Direction; next: Point}[] = [];
    for (const direction of order) {
      const next = ahead(head, direction);
      if (!inBounds(next, cols, rows) || blocked.has(cellKey(next))) {
        continue;
      }
      if (self.has(cellKey(next))) {
        continue;
      }
      valid.push({direction, next});
    }
    if (valid.length === 0) {
      return snake;
    }
    const nearEdge = edgeDist(head, cols, rows) <= 1;
    const dueTurn = snake.straight >= MAX_STRAIGHT;
    let pick = valid[0];
    if (nearEdge) {
      let best = -1;
      for (const option of valid) {
        const score = edgeDist(option.next, cols, rows);
        if (score > best) {
          best = score;
          pick = option;
        }
      }
    } else if (dueTurn) {
      pick = valid.find((option) => option.direction !== snake.direction) ?? valid[0];
    }
    return {
      ...snake,
      direction: pick.direction,
      straight:
        pick.direction === snake.direction ? snake.straight + 1 : 0,
      body: [pick.next, ...snake.body.slice(0, -1)],
    };
  });
}
