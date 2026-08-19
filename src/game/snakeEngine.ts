import {
  createSimState,
  GRID_HEIGHT,
  GRID_WIDTH,
  randomSeed,
  tick as simulateTick,
} from './engine';
import type {GameState, Point} from './types';

export {
  gameLevel,
  GRID_HEIGHT,
  GRID_WIDTH,
  queueDirection,
  tickMsForScore,
  togglePause,
} from './engine';

export const HIGH_SCORE_KEY = 'front-snake-high-score';
export const GAME_STATE_KEY = 'front-snake-state';
export const LOBBY_LEVEL_ID = 'lobby';

const DIRECTIONS = new Set(['up', 'down', 'left', 'right']);
const STATUSES = new Set(['ready', 'playing', 'paused', 'gameover']);

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

function inBounds(point: Point): boolean {
  return (
    point.x >= 0 &&
    point.x < GRID_WIDTH &&
    point.y >= 0 &&
    point.y < GRID_HEIGHT
  );
}

function normalizeFoods(value: unknown): Point[] | null {
  if (Array.isArray(value) && value.length > 0 && value.every(isPoint)) {
    return value;
  }
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
  direction: GameState['direction'];
  pendingDirection: GameState['direction'];
  status: GameState['status'];
  score: number;
  highScore: number;
  gridWidth: number;
  gridHeight: number;
  seed: number;
  rngState: number;
}

function isValidSavedState(
  value: unknown,
  levelId: string,
): value is GameState {
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
    raw.gridWidth !== GRID_WIDTH ||
    raw.gridHeight !== GRID_HEIGHT ||
    !Number.isFinite(raw.seed) ||
    !Number.isFinite(raw.rngState)
  ) {
    return false;
  }

  if (!raw.snake.every(inBounds) || !foods.every(inBounds)) {
    return false;
  }

  (value as GameState).foods = foods;
  return true;
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
    const status = parsed.status === 'playing' ? 'paused' : parsed.status;
    return {...parsed, highScore, status};
  } catch {
    return null;
  }
}

export function saveGameState(state: GameState): void {
  try {
    localStorage.setItem(
      gameStateStorageKey(state.levelId),
      JSON.stringify(state),
    );
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

export function createFreshState(
  levelId: string,
  seed = randomSeed(),
): GameState {
  return createSimState(levelId, seed, loadHighScore(levelId));
}

export function createInitialState(levelId: string): GameState {
  return loadGameState(levelId) ?? createFreshState(levelId);
}

export function tick(state: GameState): GameState {
  const next = simulateTick(state);
  if (next.highScore > state.highScore) {
    saveHighScore(state.levelId, next.highScore);
  }
  return next;
}
