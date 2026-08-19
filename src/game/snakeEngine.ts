import type {Direction, GameState, Point} from './types';
import {DIRECTION_DELTA, OPPOSITE} from './types';

export const GRID_WIDTH = 17;
export const GRID_HEIGHT = 17;
export const MIN_GRID = 10;
export const MAX_GRID = 48;
export const TARGET_CELL_PX = 16;
export const BASE_TICK_MS = 140;
export const MIN_TICK_MS = 55;
export const TICK_MS = BASE_TICK_MS;
export const MAX_BAITS = 5;
export const HIGH_SCORE_KEY = 'front-snake-high-score';
export const GAME_STATE_KEY = 'front-snake-state';
export const LOBBY_LEVEL_ID = 'lobby';

/** Faster ticks as the snake grows (starts at length 3). */
export function tickMsForSnakeLength(length: number): number {
  const growth = Math.max(0, length - 3);
  return Math.max(MIN_TICK_MS, BASE_TICK_MS - growth * 5);
}

/** More baits as the snake grows: 1 until 9, 2 at 10, 3 at 20, … */
export function baitCountForSnakeLength(length: number): number {
  return Math.min(MAX_BAITS, 1 + Math.floor(length / 10));
}

export interface GridSize {
  gridWidth: number;
  gridHeight: number;
}

/** Pick cols/rows so each cell is ~square for the given board pixel size. */
export function computeGridSize(widthPx: number, heightPx: number): GridSize {
  if (widthPx <= 0 || heightPx <= 0) {
    return {gridWidth: GRID_WIDTH, gridHeight: GRID_HEIGHT};
  }

  const gridWidth = Math.min(MAX_GRID, Math.max(MIN_GRID, Math.round(widthPx / TARGET_CELL_PX)));
  const gridHeight = Math.min(MAX_GRID, Math.max(MIN_GRID, Math.round(heightPx / TARGET_CELL_PX)));
  return {gridWidth, gridHeight};
}

const DIRECTIONS = new Set<Direction>(['up', 'down', 'left', 'right']);
const STATUSES = new Set(['ready', 'playing', 'paused', 'gameover']);

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
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

function highScoreStorageKey(levelId: string): string {
  return `${HIGH_SCORE_KEY}:${levelId}`;
}

function gameStateStorageKey(levelId: string): string {
  return `${GAME_STATE_KEY}:${levelId}`;
}

function isPoint(value: unknown): value is Point {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const point = value as Point;
  return Number.isInteger(point.x) && Number.isInteger(point.y);
}

function inBounds(point: Point, gridWidth: number, gridHeight: number): boolean {
  return point.x >= 0 && point.x < gridWidth && point.y >= 0 && point.y < gridHeight;
}

function normalizeFoods(value: unknown): Point[] | null {
  if (Array.isArray(value) && value.length > 0 && value.every(isPoint)) {
    return value;
  }
  // Legacy single-food saves.
  if (isPoint(value)) {
    return [value];
  }
  return null;
}

interface SavedGameState {
  levelId: string;
  snake: Point[];
  foods?: Point[];
  food?: Point;
  direction: Direction;
  pendingDirection: Direction;
  status: GameState['status'];
  score: number;
  highScore: number;
  gridWidth: number;
  gridHeight: number;
}

function isValidSavedState(value: unknown, levelId: string): value is GameState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const raw = value as SavedGameState;
  const foods = normalizeFoods('foods' in raw ? raw.foods : raw.food);
  if (!foods) {
    return false;
  }

  if (
    raw.levelId !== levelId ||
    !Array.isArray(raw.snake) ||
    raw.snake.length === 0 ||
    !raw.snake.every(isPoint) ||
    !DIRECTIONS.has(raw.direction) ||
    !DIRECTIONS.has(raw.pendingDirection) ||
    !STATUSES.has(raw.status) ||
    !Number.isFinite(raw.score) ||
    !Number.isFinite(raw.highScore) ||
    !Number.isInteger(raw.gridWidth) ||
    !Number.isInteger(raw.gridHeight) ||
    raw.gridWidth < MIN_GRID ||
    raw.gridHeight < MIN_GRID ||
    raw.gridWidth > MAX_GRID ||
    raw.gridHeight > MAX_GRID
  ) {
    return false;
  }

  const inGrid = (point: Point) => inBounds(point, raw.gridWidth, raw.gridHeight);
  if (!raw.snake.every(inGrid) || !foods.every(inGrid)) {
    return false;
  }

  // Mutate into modern shape for callers.
  (value as GameState).foods = foods;
  return true;
}

export function loadGameState(levelId: string): GameState | null {
  try {
    const raw = localStorage.getItem(gameStateStorageKey(levelId));
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSavedState(parsed, levelId)) {
      return null;
    }
    const highScore = Math.max(parsed.highScore, loadHighScore(levelId));
    // Reopening mid-run should not instantly tick — land paused if it was playing.
    const status = parsed.status === 'playing' ? 'paused' : parsed.status;
    const foods = refillFoods(parsed.snake, parsed.foods, parsed.gridWidth, parsed.gridHeight);
    return {...parsed, highScore, status, foods};
  } catch {
    return null;
  }
}

export function saveGameState(state: GameState): void {
  try {
    localStorage.setItem(gameStateStorageKey(state.levelId), JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

export function clearGameState(levelId: string): void {
  try {
    localStorage.removeItem(gameStateStorageKey(levelId));
  } catch {
    // ignore
  }
}

export function spawnFood(
  snake: Point[],
  gridWidth: number,
  gridHeight: number,
  occupied: Point[] = [],
): Point {
  const free: Point[] = [];
  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const point = {x, y};
      if (!isOnSnake(point, snake) && !isOccupied(point, occupied)) {
        free.push(point);
      }
    }
  }
  if (free.length === 0) {
    return {x: 0, y: 0};
  }
  return free[randomInt(free.length)] ?? {x: 0, y: 0};
}

export function spawnFoods(
  count: number,
  snake: Point[],
  gridWidth: number,
  gridHeight: number,
  existing: Point[] = [],
): Point[] {
  const foods = [...existing];
  while (foods.length < count) {
    const next = spawnFood(snake, gridWidth, gridHeight, foods);
    if (isOccupied(next, foods) && foods.length > 0) {
      break;
    }
    foods.push(next);
    if (foods.length >= gridWidth * gridHeight - snake.length) {
      break;
    }
  }
  return foods;
}

function refillFoods(snake: Point[], foods: Point[], gridWidth: number, gridHeight: number): Point[] {
  const target = baitCountForSnakeLength(snake.length);
  if (foods.length >= target) {
    return foods.slice(0, target);
  }
  return spawnFoods(target, snake, gridWidth, gridHeight, foods);
}

export function loadHighScore(levelId: string): number {
  try {
    const raw = localStorage.getItem(highScoreStorageKey(levelId));
    const value = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(levelId: string, score: number): void {
  try {
    localStorage.setItem(highScoreStorageKey(levelId), String(score));
  } catch {
    // ignore quota / private mode
  }
}

export function createFreshState(
  levelId: string,
  gridWidth = GRID_WIDTH,
  gridHeight = GRID_HEIGHT,
): GameState {
  const highScore = loadHighScore(levelId);
  const start: Point = {
    x: Math.floor(gridWidth / 2),
    y: Math.floor(gridHeight / 2),
  };
  const snake: Point[] = [start, {x: start.x - 1, y: start.y}, {x: start.x - 2, y: start.y}];
  const foods = spawnFoods(baitCountForSnakeLength(snake.length), snake, gridWidth, gridHeight);

  return {
    levelId,
    snake,
    foods,
    direction: 'right',
    pendingDirection: 'right',
    status: 'ready',
    score: 0,
    highScore,
    gridWidth,
    gridHeight,
  };
}

export function createInitialState(
  levelId: string,
  gridWidth = GRID_WIDTH,
  gridHeight = GRID_HEIGHT,
): GameState {
  return loadGameState(levelId) ?? createFreshState(levelId, gridWidth, gridHeight);
}

export function queueDirection(state: GameState, next: Direction): GameState {
  if (state.status !== 'playing' && state.status !== 'ready') {
    return state;
  }
  if (OPPOSITE[state.direction] === next) {
    return state;
  }
  return {...state, pendingDirection: next, status: state.status === 'ready' ? 'playing' : state.status};
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

  const direction = state.pendingDirection;
  const delta = DIRECTION_DELTA[direction];
  const head = state.snake[0];
  const nextHead: Point = {x: head.x + delta.x, y: head.y + delta.y};

  const hitWall =
    nextHead.x < 0 || nextHead.x >= state.gridWidth || nextHead.y < 0 || nextHead.y >= state.gridHeight;
  const hitSelf = isOnSnake(nextHead, state.snake);

  if (hitWall || hitSelf) {
    const highScore = Math.max(state.score, state.highScore);
    if (highScore > state.highScore) {
      saveHighScore(state.levelId, highScore);
    }
    return {...state, status: 'gameover', highScore, direction};
  }

  const eatenIndex = state.foods.findIndex((food) => pointsEqual(nextHead, food));
  const ate = eatenIndex >= 0;
  const body = ate ? state.snake : state.snake.slice(0, -1);
  const snake = [nextHead, ...body];
  const score = ate ? state.score + 5 : state.score;
  const remainingFoods = ate ? state.foods.filter((_, index) => index !== eatenIndex) : state.foods;
  const foods = refillFoods(snake, remainingFoods, state.gridWidth, state.gridHeight);
  const highScore = Math.max(score, state.highScore);

  if (highScore > state.highScore) {
    saveHighScore(state.levelId, highScore);
  }

  return {
    ...state,
    snake,
    foods,
    direction,
    pendingDirection: direction,
    score,
    highScore,
  };
}
