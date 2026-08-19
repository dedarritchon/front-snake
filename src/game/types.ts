export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Point {
  x: number;
  y: number;
}

export type GameStatus = 'ready' | 'playing' | 'paused' | 'gameover';

export interface GameState {
  levelId: string;
  snake: Point[];
  foods: Point[];
  direction: Direction;
  pendingDirection: Direction;
  status: GameStatus;
  score: number;
  highScore: number;
  gridWidth: number;
  gridHeight: number;
}

export const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export const DIRECTION_DELTA: Record<Direction, Point> = {
  up: {x: 0, y: -1},
  down: {x: 0, y: 1},
  left: {x: -1, y: 0},
  right: {x: 1, y: 0},
};
