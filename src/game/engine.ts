import type {Direction, GameState, Point} from './types';
import {DIRECTION_DELTA, OPPOSITE} from './types';

export const GRID_WIDTH = 11;
export const GRID_HEIGHT = 21;
export const BASE_TICK_MS = 140;
export const MIN_TICK_MS = 55;
export const MAX_BAITS = 5;
export const MAX_REPLAY_TICKS = 20_000;
export const DURATION_SLACK = 0.9;

export interface Rng {
  next: () => number;
  nextInt: (max: number) => number;
  state: () => number;
}

/** mulberry32 — same sequence on client and Edge Function. */
export function createRng(initialState: number): Rng {
  let t = initialState >>> 0;
  const next = (): number => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    nextInt: (max: number) => {
      if (max <= 0) {
        return 0;
      }
      return Math.floor(next() * max);
    },
    state: () => t >>> 0,
  };
}

export function randomSeed(): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] === 0 ? 1 : bytes[0];
}

export function tickMsForSnakeLength(length: number): number {
  const growth = Math.max(0, length - 3);
  return Math.max(MIN_TICK_MS, BASE_TICK_MS - growth * 5);
}

export function baitCountForSnakeLength(length: number): number {
  return Math.min(MAX_BAITS, 1 + Math.floor(length / 10));
}

function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function isOnSnake(point: Point, snake: Point[]): boolean {
  return snake.some((segment) => pointsEqual(segment, point));
}

function isOccupied(point: Point, occupied: Point[]): boolean {
  return occupied.some((other) => pointsEqual(other, point));
}

export function spawnFood(snake: Point[], occupied: Point[], rng: Rng): Point {
  const free: Point[] = [];
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const point = {x, y};
      if (!isOnSnake(point, snake) && !isOccupied(point, occupied)) {
        free.push(point);
      }
    }
  }
  if (free.length === 0) {
    return {x: 0, y: 0};
  }
  return free[rng.nextInt(free.length)] ?? {x: 0, y: 0};
}

export function spawnFoods(
  count: number,
  snake: Point[],
  existing: Point[],
  rng: Rng,
): Point[] {
  const foods = [...existing];
  while (foods.length < count) {
    const next = spawnFood(snake, foods, rng);
    if (isOccupied(next, foods) && foods.length > 0) {
      break;
    }
    foods.push(next);
    if (foods.length >= GRID_WIDTH * GRID_HEIGHT - snake.length) {
      break;
    }
  }
  return foods;
}

function refillFoods(snake: Point[], foods: Point[], rng: Rng): Point[] {
  const target = baitCountForSnakeLength(snake.length);
  if (foods.length >= target) {
    return foods.slice(0, target);
  }
  return spawnFoods(target, snake, foods, rng);
}

export function createSimState(
  levelId: string,
  seed: number,
  highScore = 0,
): GameState {
  const rng = createRng(seed);
  const start: Point = {
    x: Math.floor(GRID_WIDTH / 2),
    y: Math.floor(GRID_HEIGHT / 2),
  };
  const snake: Point[] = [
    start,
    {x: start.x - 1, y: start.y},
    {x: start.x - 2, y: start.y},
  ];
  const foods = spawnFoods(
    baitCountForSnakeLength(snake.length),
    snake,
    [],
    rng,
  );

  return {
    levelId,
    snake,
    foods,
    direction: 'right',
    pendingDirection: 'right',
    status: 'ready',
    score: 0,
    highScore,
    gridWidth: GRID_WIDTH,
    gridHeight: GRID_HEIGHT,
    seed,
    rngState: rng.state(),
  };
}

export function queueDirection(state: GameState, next: Direction): GameState {
  if (state.status !== 'playing' && state.status !== 'ready') {
    return state;
  }
  if (OPPOSITE[state.direction] === next) {
    return state;
  }
  return {
    ...state,
    pendingDirection: next,
    status: state.status === 'ready' ? 'playing' : state.status,
  };
}

export function togglePause(state: GameState): GameState {
  if (state.status === 'playing') {
    return {...state, status: 'paused'};
  }
  if (state.status === 'paused') {
    return {...state, status: 'playing'};
  }
  return state;
}

export function tick(state: GameState): GameState {
  if (state.status !== 'playing') {
    return state;
  }

  const rng = createRng(state.rngState);
  const direction = state.pendingDirection;
  const delta = DIRECTION_DELTA[direction];
  const head = state.snake[0];
  const nextHead: Point = {x: head.x + delta.x, y: head.y + delta.y};

  const hitWall =
    nextHead.x < 0 ||
    nextHead.x >= GRID_WIDTH ||
    nextHead.y < 0 ||
    nextHead.y >= GRID_HEIGHT;
  const hitSelf = isOnSnake(nextHead, state.snake);

  if (hitWall || hitSelf) {
    const highScore = Math.max(state.score, state.highScore);
    return {...state, status: 'gameover', highScore, direction};
  }

  const eatenIndex = state.foods.findIndex((food) =>
    pointsEqual(nextHead, food),
  );
  const ate = eatenIndex >= 0;
  const body = ate ? state.snake : state.snake.slice(0, -1);
  const snake = [nextHead, ...body];
  const score = ate ? state.score + 5 : state.score;
  const remainingFoods = ate
    ? state.foods.filter((_, index) => index !== eatenIndex)
    : state.foods;
  const foods = refillFoods(snake, remainingFoods, rng);
  const highScore = Math.max(score, state.highScore);

  return {
    ...state,
    snake,
    foods,
    direction,
    pendingDirection: direction,
    score,
    highScore,
    rngState: rng.state(),
  };
}

const DIRECTIONS = new Set<Direction>(['up', 'down', 'left', 'right']);

export function isDirection(value: unknown): value is Direction {
  return typeof value === 'string' && DIRECTIONS.has(value as Direction);
}

export interface ReplayResult {
  score: number;
  ticks: number;
  minDurationMs: number;
  ended: GameState['status'];
}

export function replayGame(
  seed: number,
  directions: Direction[],
): ReplayResult {
  if (directions.length === 0 || directions.length > MAX_REPLAY_TICKS) {
    return {score: 0, ticks: 0, minDurationMs: 0, ended: 'ready'};
  }

  let state = createSimState('replay', seed);
  let minDurationMs = 0;

  for (const [index, direction] of directions.entries()) {
    if (state.status === 'gameover') {
      return {
        score: state.score,
        ticks: index,
        minDurationMs,
        ended: 'gameover',
      };
    }
    minDurationMs += tickMsForSnakeLength(state.snake.length);
    state = tick({...state, pendingDirection: direction, status: 'playing'});
  }

  return {
    score: state.score,
    ticks: directions.length,
    minDurationMs,
    ended: state.status,
  };
}
